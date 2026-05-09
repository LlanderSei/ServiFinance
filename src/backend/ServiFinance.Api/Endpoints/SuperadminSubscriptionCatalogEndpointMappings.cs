namespace ServiFinance.Api.Endpoints;

using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Onboarding;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

internal static class SuperadminSubscriptionCatalogEndpointMappings {
  private const int ReadOnlyGracePeriodDays = ProgramEndpointSupport.BillingRecoveryReadOnlyGracePeriodDays;
  private const int SuspensionReviewGracePeriodDays = ProgramEndpointSupport.BillingRecoverySuspensionReviewGracePeriodDays;

  private static readonly string[] ActiveAccessLevels = ["Included", "Limited"];
  private static readonly string[] RemovedAccessLevels = ["", "Not Included", "Excluded", "None"];

  public static RouteGroupBuilder MapSuperadminSubscriptionCatalogEndpoints(this RouteGroupBuilder superadminApi) {
    superadminApi.MapGet("/subscriptions/catalog", GetCatalogAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapGet("/subscriptions/recovery", GetRecoveryAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPost("/subscriptions/recovery/{tenantId:guid}/provider-sync", SyncRecoveryProviderAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPost("/subscriptions/recovery/{tenantId:guid}/force-suspension", ForceRecoverySuspensionAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPost("/subscriptions/tiers", CreateTierAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPut("/subscriptions/tiers/{tierId:guid}", UpdateTierAsync)
        .RequireRootPermission("root.subscriptions.manage");

    return superadminApi;
  }

  private static async Task<IResult> GetCatalogAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) =>
    Results.Ok(await BuildCatalogResponseAsync(dbContext, cancellationToken));

  private static async Task<IResult> GetRecoveryAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var tenants = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.Id != ServiFinanceDatabaseDefaults.PlatformTenantId)
        .Include(entity => entity.BillingRecords)
        .Include(entity => entity.PendingSubscriptionTier)
        .OrderBy(entity => entity.Name)
        .ToListAsync(cancellationToken);
    var tiers = await dbContext.SubscriptionTiers
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .ToListAsync(cancellationToken);
    var rows = tenants
        .Select(tenant => ToRecoveryRow(tenant, ResolveCurrentTier(tiers, tenant)))
        .OrderByDescending(row => GetRecoveryStageRank(row.RecoveryStage))
        .ThenByDescending(row => GetRecoveryRiskRank(row.SuspensionRisk))
        .ThenBy(row => row.NextRenewalDateUtc ?? DateTime.MaxValue)
        .ThenBy(row => row.TenantName)
        .ToArray();
    var summary = new SuperadminSubscriptionRecoverySummaryResponse(
        tenants.Count,
        rows.Count(row => string.Equals(row.SuspensionRisk, "High", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row =>
          string.Equals(row.AccountStanding, "Payment failed", StringComparison.OrdinalIgnoreCase) ||
          string.Equals(row.LatestBillingStatus, "Payment failed", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row => string.Equals(row.AccountStanding, "Renewal due soon", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row => string.Equals(row.RecoveryStage, "Past due", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row => string.Equals(row.RecoveryStage, "Read-only recommended", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row => string.Equals(row.RecoveryStage, "Suspension review", StringComparison.OrdinalIgnoreCase)),
        rows.Count(row => !string.IsNullOrWhiteSpace(row.PendingPlanChange)),
        rows.Count(row => row.CooldownUntilUtc.HasValue && row.CooldownUntilUtc.Value > DateTime.UtcNow));

    return Results.Ok(new SuperadminSubscriptionRecoveryResponse(summary, rows));
  }

  private static async Task<IResult> SyncRecoveryProviderAsync(
      Guid tenantId,
      HttpContext httpContext,
      IPlatformTenantOnboardingService onboardingService,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    if (!onboardingService.IsConfigured) {
      return Results.BadRequest(new { error = "The online billing provider is not configured for provider sync." });
    }

    TenantSubscriptionProviderSyncResult syncResult;
    try {
      syncResult = await onboardingService.SyncTenantSubscriptionAsync(tenantId, cancellationToken);
    } catch (InvalidOperationException ex) {
      return Results.BadRequest(new { error = ex.Message });
    } catch (Exception ex) {
      return Results.BadRequest(new { error = $"Provider sync failed: {ex.Message}" });
    }

    dbContext.ChangeTracker.Clear();
    var row = await LoadRecoveryRowAsync(dbContext, tenantId, cancellationToken);
    if (row is null) {
      return Results.NotFound(new { error = "The selected tenant was not found after provider sync." });
    }

    await WriteRootSubscriptionAuditAsync(
        auditLogService,
        httpContext,
        "SubscriptionProviderSync",
        "Synced",
        row.TenantId,
        row.TenantName,
        $"Synced {syncResult.Provider} subscription state. Provider status: {syncResult.ProviderStatus}; tenant status: {syncResult.SubscriptionStatus}; active: {syncResult.IsActive}.",
        cancellationToken);

    return Results.Ok(new SuperadminSubscriptionRecoveryActionResponse(
        $"Provider sync completed. {row.TenantName} is now {row.SubscriptionStatus}.",
        row));
  }

  private static async Task<IResult> ForceRecoverySuspensionAsync(
      Guid tenantId,
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .Include(entity => entity.BillingRecords)
        .Include(entity => entity.PendingSubscriptionTier)
        .SingleOrDefaultAsync(entity => entity.Id == tenantId, cancellationToken);
    if (tenant is null) {
      return Results.NotFound(new { error = "The selected tenant was not found." });
    }

    var activeTiers = await LoadActiveSubscriptionTiersAsync(dbContext, cancellationToken);
    var recoveryRow = ToRecoveryRow(tenant, ResolveCurrentTier(activeTiers, tenant));
    if (!string.Equals(recoveryRow.RecoveryStage, "Suspension review", StringComparison.OrdinalIgnoreCase)) {
      return Results.BadRequest(new { error = "Force suspension is only available after the tenant reaches suspension review." });
    }

    tenant.SubscriptionStatus = "Suspended";
    tenant.IsActive = false;
    await dbContext.SaveChangesAsync(cancellationToken);

    await WriteRootSubscriptionAuditAsync(
        auditLogService,
        httpContext,
        "SubscriptionForceSuspension",
        "Suspended",
        tenant.Id,
        tenant.Name,
        $"Forced subscription suspension for tenant {tenant.DomainSlug} after recovery reached suspension review.",
        cancellationToken);

    dbContext.ChangeTracker.Clear();
    var row = await LoadRecoveryRowAsync(dbContext, tenantId, cancellationToken);
    if (row is null) {
      return Results.NotFound(new { error = "The selected tenant was not found after suspension." });
    }

    return Results.Ok(new SuperadminSubscriptionRecoveryActionResponse(
        $"{tenant.Name} was suspended from tenant workspace access.",
        row));
  }

  private static async Task<IResult> CreateTierAsync(
      [FromBody] UpsertSuperadminSubscriptionTierRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var validationError = ValidateTierRequest(request);
    if (validationError is not null) {
      return Results.BadRequest(new { error = validationError });
    }

    var normalizedCode = NormalizeCode(request.Code);
    if (await dbContext.SubscriptionTiers.AnyAsync(
      entity => entity.Code == normalizedCode,
      cancellationToken)) {
      return Results.BadRequest(new { error = "A subscription tier with that code already exists." });
    }

    var tier = new SubscriptionTier();
    dbContext.SubscriptionTiers.Add(tier);
    ApplyTierFields(tier, request, normalizedCode);
    await ApplyModuleAssignmentsAsync(tier, request.Modules ?? [], dbContext, cancellationToken);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Ok(await BuildTierResponseAsync(dbContext, tier.Id, cancellationToken));
  }

  private static async Task<IResult> UpdateTierAsync(
      Guid tierId,
      [FromBody] UpsertSuperadminSubscriptionTierRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var validationError = ValidateTierRequest(request);
    if (validationError is not null) {
      return Results.BadRequest(new { error = validationError });
    }

    var tier = await dbContext.SubscriptionTiers
        .Include(entity => entity.Modules)
        .SingleOrDefaultAsync(entity => entity.Id == tierId, cancellationToken);
    if (tier is null) {
      return Results.NotFound(new { error = "The selected subscription tier was not found." });
    }

    var normalizedCode = NormalizeCode(request.Code);
    if (await dbContext.SubscriptionTiers.AnyAsync(
      entity => entity.Id != tierId && entity.Code == normalizedCode,
      cancellationToken)) {
      return Results.BadRequest(new { error = "A subscription tier with that code already exists." });
    }

    ApplyTierFields(tier, request, normalizedCode);
    await ApplyModuleAssignmentsAsync(tier, request.Modules ?? [], dbContext, cancellationToken);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Ok(await BuildTierResponseAsync(dbContext, tier.Id, cancellationToken));
  }

  private static async Task ApplyModuleAssignmentsAsync(
      SubscriptionTier tier,
      IReadOnlyList<SuperadminSubscriptionTierModuleAssignmentRequest> requestModules,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var modulesById = await dbContext.PlatformModules
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);
    var existingAssignments = await dbContext.SubscriptionTierModules
        .Where(entity => entity.SubscriptionTierId == tier.Id)
        .ToDictionaryAsync(entity => entity.PlatformModuleId, cancellationToken);
    var requestedIds = new HashSet<Guid>();

    foreach (var moduleRequest in requestModules) {
      if (!modulesById.ContainsKey(moduleRequest.PlatformModuleId) ||
          !requestedIds.Add(moduleRequest.PlatformModuleId)) {
        continue;
      }

      var accessLevel = NormalizeAccessLevel(moduleRequest.AccessLevel);
      if (RemovedAccessLevels.Contains(accessLevel, StringComparer.OrdinalIgnoreCase)) {
        if (existingAssignments.TryGetValue(moduleRequest.PlatformModuleId, out var existingRemovedAssignment)) {
          dbContext.SubscriptionTierModules.Remove(existingRemovedAssignment);
        }

        continue;
      }

      if (!ActiveAccessLevels.Contains(accessLevel, StringComparer.OrdinalIgnoreCase)) {
        accessLevel = "Limited";
      }

      if (!existingAssignments.TryGetValue(moduleRequest.PlatformModuleId, out var assignment)) {
        assignment = new SubscriptionTierModule {
          SubscriptionTierId = tier.Id,
          PlatformModuleId = moduleRequest.PlatformModuleId
        };
        dbContext.SubscriptionTierModules.Add(assignment);
      }

      assignment.AccessLevel = accessLevel;
      assignment.SortOrder = moduleRequest.SortOrder;
    }

    foreach (var existingAssignment in existingAssignments.Values) {
      if (!requestedIds.Contains(existingAssignment.PlatformModuleId)) {
        dbContext.SubscriptionTierModules.Remove(existingAssignment);
      }
    }
  }

  private static async Task<SuperadminSubscriptionCatalogResponse> BuildCatalogResponseAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var tierEntities = await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .OrderBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.BusinessSizeSegment)
        .ThenBy(entity => entity.SubscriptionEdition)
        .ThenBy(entity => entity.DisplayName)
        .ToListAsync(cancellationToken);
    var moduleEntities = await dbContext.PlatformModules
        .AsNoTracking()
        .OrderBy(entity => entity.Channel)
        .ThenBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.Name)
        .ToListAsync(cancellationToken);

    return new SuperadminSubscriptionCatalogResponse(
      tierEntities.Select(ToTierResponse).ToArray(),
        moduleEntities.Select(ToModuleResponse).ToArray());
  }

  private static async Task<IReadOnlyList<SubscriptionTier>> LoadActiveSubscriptionTiersAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) =>
    await dbContext.SubscriptionTiers
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .ToListAsync(cancellationToken);

  private static async Task<SuperadminSubscriptionRecoveryRowResponse?> LoadRecoveryRowAsync(
      ServiFinanceDbContext dbContext,
      Guid tenantId,
      CancellationToken cancellationToken) {
    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Include(entity => entity.BillingRecords)
        .Include(entity => entity.PendingSubscriptionTier)
        .SingleOrDefaultAsync(entity => entity.Id == tenantId, cancellationToken);
    if (tenant is null) {
      return null;
    }

    var activeTiers = await LoadActiveSubscriptionTiersAsync(dbContext, cancellationToken);
    return ToRecoveryRow(tenant, ResolveCurrentTier(activeTiers, tenant));
  }

  private static Task WriteRootSubscriptionAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      string actionType,
      string outcome,
      Guid subjectId,
      string subjectLabel,
      string detail,
      CancellationToken cancellationToken) =>
    auditLogService.WriteAsync(
        new AuditLogEntry(
            ServiFinanceDatabaseDefaults.PlatformTenantId,
            "Superadmin",
            "System",
            actionType,
            outcome,
            ProgramEndpointSupport.TryGetCurrentUserId(httpContext.User, out var userId) ? userId : null,
            httpContext.User.FindFirstValue(ClaimTypes.Name),
            httpContext.User.FindFirstValue(ClaimTypes.Email),
            "Tenant",
            subjectId,
            subjectLabel,
            detail,
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.Request.Headers.UserAgent.ToString()),
        cancellationToken);

  private static SuperadminSubscriptionRecoveryRowResponse ToRecoveryRow(
      Tenant tenant,
      SubscriptionTier? currentTier) {
    var billingRecords = tenant.BillingRecords
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .ToArray();
    var latestBillingRecord = billingRecords.FirstOrDefault();
    var latestConfirmedCoverage = billingRecords
        .Where(entity => string.Equals(entity.Status, "Confirmed", StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(entity => entity.CoverageEndUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .FirstOrDefault();
    var futureSubmittedCoverage = billingRecords
        .Where(entity => entity.CoverageStartUtc > (latestConfirmedCoverage?.CoverageEndUtc ?? DateTime.MinValue))
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .FirstOrDefault();
    var nextRenewalDateUtc = futureSubmittedCoverage?.CoverageStartUtc
        ?? latestConfirmedCoverage?.CoverageEndUtc;
    var pendingReviewCount = billingRecords.Count(entity =>
      string.Equals(entity.Status, "Pending Review", StringComparison.OrdinalIgnoreCase));
    var standing = ResolveRecoveryStanding(tenant, latestBillingRecord, nextRenewalDateUtc, pendingReviewCount);
    var recoveryStage = ResolveRecoveryStage(tenant, standing.AccountStanding, latestBillingRecord, nextRenewalDateUtc);
    var pendingPlanChange = tenant.PendingSubscriptionTier is null
        ? null
        : $"{tenant.PendingSubscriptionTier.DisplayName} on renewal";

    return new SuperadminSubscriptionRecoveryRowResponse(
        tenant.Id,
        tenant.Name,
        tenant.DomainSlug,
        tenant.BusinessSizeSegment,
        tenant.SubscriptionEdition,
        tenant.SubscriptionPlan,
        tenant.SubscriptionStatus,
        tenant.IsActive,
        tenant.BillingProvider,
        standing.AccountStanding,
        standing.SuspensionRisk,
        recoveryStage.Stage,
        recoveryStage.Description,
        recoveryStage.OverdueDays,
        recoveryStage.ReadOnlyRecommendedAtUtc,
        recoveryStage.SuspensionReviewAtUtc,
        nextRenewalDateUtc,
        currentTier?.MonthlyPriceAmount,
        currentTier?.CurrencyCode,
        latestConfirmedCoverage?.CoverageEndUtc,
        latestBillingRecord?.Status,
        latestBillingRecord?.SubmittedAtUtc,
        pendingReviewCount,
        pendingPlanChange,
        tenant.PendingSubscriptionChangeEffectiveAtUtc,
        tenant.SubscriptionChangeCooldownUntilUtc,
        BuildRecoveryAction(tenant, standing.AccountStanding, recoveryStage, latestBillingRecord, pendingReviewCount, pendingPlanChange));
  }

  private static (string AccountStanding, string SuspensionRisk) ResolveRecoveryStanding(
      Tenant tenant,
      TenantBillingRecord? latestBillingRecord,
      DateTime? nextRenewalDateUtc,
      int pendingReviewCount) {
    var utcToday = DateTime.UtcNow.Date;

    if (!tenant.IsActive ||
        string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) {
      return ("Suspended", "High");
    }

    if (string.Equals(tenant.SubscriptionStatus, "Past due", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(latestBillingRecord?.Status, "Payment failed", StringComparison.OrdinalIgnoreCase)) {
      return ("Payment failed", "High");
    }

    if (pendingReviewCount > 0) {
      return nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date < utcToday
          ? ("Awaiting billing review", "High")
          : ("Awaiting billing review", "Medium");
    }

    if (nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date < utcToday) {
      return ("Renewal overdue", "High");
    }

    if (nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date <= utcToday.AddDays(7)) {
      return ("Renewal due soon", "Medium");
    }

    return ("Active", "Low");
  }

  private static RecoveryStagePolicy ResolveRecoveryStage(
      Tenant tenant,
      string accountStanding,
      TenantBillingRecord? latestBillingRecord,
      DateTime? nextRenewalDateUtc) {
    var recoveryAnchorUtc = ResolveRecoveryAnchorUtc(latestBillingRecord, nextRenewalDateUtc);
    int? overdueDays = recoveryAnchorUtc.HasValue
        ? Math.Max(0, (DateTime.UtcNow.Date - recoveryAnchorUtc.Value.Date).Days)
        : null;
    var readOnlyRecommendedAtUtc = recoveryAnchorUtc?.Date.AddDays(ReadOnlyGracePeriodDays);
    var suspensionReviewAtUtc = recoveryAnchorUtc?.Date.AddDays(SuspensionReviewGracePeriodDays);

    if (!tenant.IsActive ||
        string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) {
      return new RecoveryStagePolicy(
        "Suspension review",
        "Tenant is inactive or suspended; platform review is required before reactivation.",
        overdueDays,
        readOnlyRecommendedAtUtc,
        suspensionReviewAtUtc);
    }

    if (!IsRecoveryFailure(accountStanding, tenant, latestBillingRecord, nextRenewalDateUtc)) {
      return new RecoveryStagePolicy(
        "Active",
        "No read-only or suspension grace action is currently due.",
        overdueDays,
        readOnlyRecommendedAtUtc,
        suspensionReviewAtUtc);
    }

    if (overdueDays.HasValue && overdueDays.Value >= SuspensionReviewGracePeriodDays) {
      return new RecoveryStagePolicy(
        "Suspension review",
        "Recovery is at or beyond the 14-day suspension-review threshold.",
        overdueDays,
        readOnlyRecommendedAtUtc,
        suspensionReviewAtUtc);
    }

    if (overdueDays.HasValue && overdueDays.Value >= ReadOnlyGracePeriodDays) {
      return new RecoveryStagePolicy(
        "Read-only recommended",
        "Recovery is past the 7-day read-only threshold but not yet at suspension review.",
        overdueDays,
        readOnlyRecommendedAtUtc,
        suspensionReviewAtUtc);
    }

    return new RecoveryStagePolicy(
      "Past due",
      "Recovery is inside the first 7 days after the failed or overdue renewal.",
      overdueDays,
      readOnlyRecommendedAtUtc,
      suspensionReviewAtUtc);
  }

  private static bool IsRecoveryFailure(
      string accountStanding,
      Tenant tenant,
      TenantBillingRecord? latestBillingRecord,
      DateTime? nextRenewalDateUtc) {
    var utcToday = DateTime.UtcNow.Date;

    return string.Equals(accountStanding, "Payment failed", StringComparison.OrdinalIgnoreCase) ||
      string.Equals(accountStanding, "Renewal overdue", StringComparison.OrdinalIgnoreCase) ||
      string.Equals(tenant.SubscriptionStatus, "Past due", StringComparison.OrdinalIgnoreCase) ||
      string.Equals(latestBillingRecord?.Status, "Payment failed", StringComparison.OrdinalIgnoreCase) ||
      (string.Equals(accountStanding, "Awaiting billing review", StringComparison.OrdinalIgnoreCase) &&
        nextRenewalDateUtc.HasValue &&
        nextRenewalDateUtc.Value.Date < utcToday);
  }

  private static DateTime? ResolveRecoveryAnchorUtc(
      TenantBillingRecord? latestBillingRecord,
      DateTime? nextRenewalDateUtc) =>
    nextRenewalDateUtc ??
      latestBillingRecord?.CoverageEndUtc ??
      latestBillingRecord?.SubmittedAtUtc;

  private static string BuildRecoveryAction(
      Tenant tenant,
      string accountStanding,
      RecoveryStagePolicy recoveryStage,
      TenantBillingRecord? latestBillingRecord,
      int pendingReviewCount,
      string? pendingPlanChange) {
    if (!tenant.IsActive ||
        string.Equals(accountStanding, "Suspended", StringComparison.OrdinalIgnoreCase)) {
      return "Review whether the tenant should remain suspended, recover billing, or be reactivated after provider confirmation.";
    }

    if (string.Equals(recoveryStage.Stage, "Suspension review", StringComparison.OrdinalIgnoreCase)) {
      return "Review final suspension or reinstatement because the recovery window has passed the suspension-review threshold.";
    }

    if (string.Equals(recoveryStage.Stage, "Read-only recommended", StringComparison.OrdinalIgnoreCase)) {
      return "Move the tenant toward read-only recovery posture until renewal succeeds or the owner updates the billing method.";
    }

    if (string.Equals(accountStanding, "Payment failed", StringComparison.OrdinalIgnoreCase)) {
      return string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase)
          ? "Ask the tenant owner to update the hosted billing payment method, then wait for Stripe invoice recovery."
          : "Confirm the manual recovery path or move the tenant to the configured online billing provider.";
    }

    if (pendingReviewCount > 0) {
      return "Clear pending billing review records so tenant coverage and account standing do not drift.";
    }

    if (string.Equals(accountStanding, "Renewal overdue", StringComparison.OrdinalIgnoreCase)) {
      return "Escalate renewal recovery before enforcing read-only or suspension policy.";
    }

    if (!string.IsNullOrWhiteSpace(pendingPlanChange)) {
      return "Monitor the scheduled plan switch and confirm locked-module cleanup before the next renewal.";
    }

    if (latestBillingRecord is null) {
      return "No billing ledger record is available yet; verify provider sync after the first renewal invoice.";
    }

    return "No immediate platform intervention is required.";
  }

  private static SubscriptionTier? ResolveCurrentTier(
      IReadOnlyList<SubscriptionTier> activeTiers,
      Tenant tenant) =>
    activeTiers.FirstOrDefault(entity => entity.DisplayName == tenant.SubscriptionPlan)
        ?? activeTiers.FirstOrDefault(entity =>
          entity.BusinessSizeSegment == tenant.BusinessSizeSegment &&
          entity.SubscriptionEdition == tenant.SubscriptionEdition);

  private static int GetRecoveryRiskRank(string suspensionRisk) =>
    suspensionRisk switch {
      "High" => 3,
      "Medium" => 2,
      "Low" => 1,
      _ => 0
    };

  private static int GetRecoveryStageRank(string recoveryStage) =>
    recoveryStage switch {
      "Suspension review" => 4,
      "Read-only recommended" => 3,
      "Past due" => 2,
      "Active" => 1,
      _ => 0
    };

  private sealed record RecoveryStagePolicy(
      string Stage,
      string Description,
      int? OverdueDays,
      DateTime? ReadOnlyRecommendedAtUtc,
      DateTime? SuspensionReviewAtUtc);

  private static async Task<SuperadminSubscriptionTierResponse> BuildTierResponseAsync(
      ServiFinanceDbContext dbContext,
      Guid tierId,
      CancellationToken cancellationToken) =>
    ToTierResponse(await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .Where(entity => entity.Id == tierId)
        .SingleAsync(cancellationToken));

  private static SuperadminSubscriptionTierResponse ToTierResponse(SubscriptionTier tier) =>
    new(
      tier.Id,
      tier.Code,
      tier.DisplayName,
      tier.BusinessSizeSegment,
      tier.SubscriptionEdition,
      tier.AudienceSummary,
      tier.Description,
      tier.MonthlyPriceAmount,
      tier.CurrencyCode,
      FormatPriceDisplay(tier.MonthlyPriceAmount, tier.CurrencyCode),
      tier.BillingLabel,
      tier.PlanSummary,
      tier.HighlightLabel,
      tier.SortOrder,
      tier.IncludesServiceManagementWeb,
      tier.IncludesMicroLendingDesktop,
      tier.IsActive,
      tier.Modules
          .Where(module => module.PlatformModule is not null)
          .OrderBy(module => module.SortOrder)
          .ThenBy(module => module.PlatformModule!.SortOrder)
          .ThenBy(module => module.PlatformModule!.Name)
          .Select(module => new SuperadminSubscriptionTierModuleResponse(
              module.Id,
              module.PlatformModuleId,
              module.PlatformModule!.Code,
              module.PlatformModule.Name,
              module.PlatformModule.Channel,
              module.AccessLevel,
              module.PlatformModule.Summary,
              module.SortOrder,
              module.PlatformModule.IsActive))
          .ToArray());

  private static SuperadminCatalogModuleResponse ToModuleResponse(PlatformModule module) =>
    new(
      module.Id,
      module.Code,
      module.Name,
      module.Channel,
      module.Summary,
      module.SortOrder,
      module.IsActive);

  private static void ApplyTierFields(
      SubscriptionTier tier,
      UpsertSuperadminSubscriptionTierRequest request,
      string normalizedCode) {
    tier.Code = normalizedCode;
    tier.DisplayName = request.DisplayName.Trim();
    tier.BusinessSizeSegment = request.BusinessSizeSegment.Trim();
    tier.SubscriptionEdition = request.SubscriptionEdition.Trim();
    tier.AudienceSummary = request.AudienceSummary.Trim();
    tier.Description = request.Description.Trim();
    tier.MonthlyPriceAmount = request.MonthlyPriceAmount;
    tier.CurrencyCode = NormalizeCurrencyCode(request.CurrencyCode);
    tier.PriceDisplay = FormatPriceDisplay(tier.MonthlyPriceAmount, tier.CurrencyCode);
    tier.BillingLabel = request.BillingLabel.Trim();
    tier.PlanSummary = request.PlanSummary.Trim();
    tier.HighlightLabel = request.HighlightLabel.Trim();
    tier.SortOrder = request.SortOrder;
    tier.IncludesServiceManagementWeb = request.IncludesServiceManagementWeb;
    tier.IncludesMicroLendingDesktop = request.IncludesMicroLendingDesktop;
    tier.IsActive = request.IsActive;
  }

  private static string? ValidateTierRequest(UpsertSuperadminSubscriptionTierRequest request) {
    if (string.IsNullOrWhiteSpace(NormalizeCode(request.Code))) {
      return "Tier code is required.";
    }

    if (string.IsNullOrWhiteSpace(request.DisplayName)) {
      return "Tier display name is required.";
    }

    if (string.IsNullOrWhiteSpace(request.BusinessSizeSegment)) {
      return "Business size segment is required.";
    }

    if (string.IsNullOrWhiteSpace(request.SubscriptionEdition)) {
      return "Subscription edition is required.";
    }

    if (request.MonthlyPriceAmount <= 0m) {
      return "Monthly price amount must be greater than zero.";
    }

    var requestedCurrencyCode = request.CurrencyCode?.Trim() ?? string.Empty;
    if (!string.IsNullOrWhiteSpace(requestedCurrencyCode) &&
        (requestedCurrencyCode.Length != 3 || !requestedCurrencyCode.All(char.IsLetter))) {
      return "Currency code must be a 3-letter ISO code.";
    }

    return null;
  }

  private static string FormatPriceDisplay(decimal amount, string currencyCode) =>
    $"Starts at {NormalizeCurrencyCode(currencyCode)} {amount.ToString("N0", CultureInfo.InvariantCulture)}";

  private static string NormalizeCurrencyCode(string? value) {
    if (string.IsNullOrWhiteSpace(value)) {
      return "PHP";
    }

    return value.Trim().ToUpperInvariant();
  }

  private static string NormalizeCode(string value) {
    var normalizedCharacters = (value ?? string.Empty)
        .Trim()
        .ToUpperInvariant()
        .Select(character => char.IsLetterOrDigit(character) ? character : '_')
        .ToArray();
    var normalizedCode = new string(normalizedCharacters);

    while (normalizedCode.Contains("__", StringComparison.Ordinal)) {
      normalizedCode = normalizedCode.Replace("__", "_", StringComparison.Ordinal);
    }

    return normalizedCode.Trim('_');
  }

  private static string NormalizeAccessLevel(string? value) =>
    string.IsNullOrWhiteSpace(value)
      ? string.Empty
      : value.Trim();
}
