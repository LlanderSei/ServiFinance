namespace ServiFinance.Api.Endpoints.TenantBilling;

using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Onboarding;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantBillingEndpointMappings {
  private const string ChangeDirectionDowngrade = "Downgrade";
  private const string ChangeDirectionUpgrade = "Upgrade";
  private const string ChangeDirectionLateral = "Lateral";

  public static RouteGroupBuilder MapTenantBillingEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/billing/overview", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromQuery] string? scope,
        IPlatformTenantOnboardingService onboardingService,
        ServiFinanceDbContext dbContext,
        IRolePermissionAuthorizationService rolePermissionAuthorizationService,
        CancellationToken cancellationToken) => {
          var workspaceScope = ResolveBillingScope(httpContext, scope);
          var accessError = await RequireBillingPermissionAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              rolePermissionAuthorizationService,
              cancellationToken,
              workspaceScope,
              requireManage: false);
          if (accessError is not null) {
            return accessError;
          }

          var tenant = await LoadTenantAsync(dbContext, tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          var activeTiers = await LoadActiveTiersAsync(dbContext, cancellationToken);
          var currentTier = ResolveCurrentTier(activeTiers, tenant);
          var history = await LoadBillingHistoryAsync(dbContext, tenant.Id, cancellationToken);
          var standing = BuildStanding(tenant, history, currentTier?.MonthlyPriceAmount, onboardingService.IsConfigured);
          var availableTiers = activeTiers
              .OrderBy(entity => entity.SortOrder)
              .ThenBy(entity => entity.MonthlyPriceAmount)
              .ThenBy(entity => entity.DisplayName)
              .Select(ToTierOptionResponse)
              .ToList();
          var pendingPlanChange = tenant.PendingSubscriptionTierId.HasValue && tenant.PendingSubscriptionTier is not null
              ? await BuildPendingPlanChangeAsync(dbContext, currentTier, tenant.PendingSubscriptionTier, tenant, cancellationToken)
              : null;

          return Results.Ok(new TenantBillingOverviewResponse(
              new TenantBillingPlanSummaryResponse(
                  tenant.BusinessSizeSegment,
                  tenant.SubscriptionEdition,
                  tenant.SubscriptionPlan,
                  tenant.SubscriptionStatus,
                  currentTier?.MonthlyPriceAmount,
                  currentTier?.CurrencyCode,
                  currentTier is null ? null : FormatPriceDisplay(currentTier.MonthlyPriceAmount, currentTier.CurrencyCode),
                  currentTier?.BillingLabel,
                  currentTier?.AudienceSummary,
                  currentTier?.PlanSummary,
                  currentTier is null ? [] : BuildModuleRows(currentTier)),
              standing,
              history,
              availableTiers,
              pendingPlanChange,
              BuildChangeControls(tenant)));
        });

    tenantApi.MapPost("/billing/portal-session", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromQuery] string? scope,
        IPlatformTenantOnboardingService onboardingService,
        ServiFinanceDbContext dbContext,
        IRolePermissionAuthorizationService rolePermissionAuthorizationService,
        CancellationToken cancellationToken) => {
          var workspaceScope = ResolveBillingScope(httpContext, scope);
          var accessError = await RequireBillingPermissionAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              rolePermissionAuthorizationService,
              cancellationToken,
              workspaceScope,
              requireManage: true);
          if (accessError is not null) {
            return accessError;
          }

          var tenant = await LoadTenantAsync(dbContext, tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          try {
            var returnUrl = BuildBillingReturnUrl(httpContext, tenantDomainSlug, workspaceScope);
            var portalSession = await onboardingService.CreateBillingPortalSessionAsync(tenant.Id, returnUrl, cancellationToken);
            return Results.Ok(new TenantBillingPortalSessionResponse(portalSession.Url));
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });

    tenantApi.MapPost("/billing/subscription-change-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromQuery] string? scope,
        [FromBody] TenantBillingPlanChangeRequest request,
        ServiFinanceDbContext dbContext,
        IRolePermissionAuthorizationService rolePermissionAuthorizationService,
        IPlatformTenantOnboardingService onboardingService,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var workspaceScope = ResolveBillingScope(httpContext, scope);
          var accessError = await RequireBillingPermissionAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              rolePermissionAuthorizationService,
              cancellationToken,
              workspaceScope,
              requireManage: true);
          if (accessError is not null) {
            return accessError;
          }

          var tenant = await dbContext.Tenants
              .Include(entity => entity.PendingSubscriptionTier)
              .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          if (tenant.PendingSubscriptionTierId.HasValue) {
            return Results.BadRequest(new { error = "A subscription tier or edition switch is already pending for the next renewal cycle." });
          }

          var utcNow = DateTime.UtcNow;
          if (tenant.SubscriptionChangeCooldownUntilUtc.HasValue &&
              tenant.SubscriptionChangeCooldownUntilUtc.Value > utcNow) {
            return Results.BadRequest(new {
              error = $"A switch cancellation cooldown is active until {tenant.SubscriptionChangeCooldownUntilUtc.Value:MMM d, yyyy h:mm tt} UTC."
            });
          }

          var activeTiers = await LoadActiveTiersAsync(dbContext, cancellationToken);
          var currentTier = ResolveCurrentTier(activeTiers, tenant);
          if (currentTier is null) {
            return Results.BadRequest(new { error = "The current tenant subscription tier could not be resolved." });
          }

          var targetTier = activeTiers.SingleOrDefault(entity => entity.Id == request.TargetTierId);
          if (targetTier is null) {
            return Results.BadRequest(new { error = "The selected target tier is not active or does not exist." });
          }

          if (targetTier.Id == currentTier.Id) {
            return Results.BadRequest(new { error = "The selected tier is already active for this tenant." });
          }

          var impact = await BuildDowngradeImpactAsync(dbContext, currentTier, targetTier, cancellationToken);
          if (impact.IsDowngrade && !request.ConfirmDowngrade) {
            return Results.BadRequest(new { error = "Downgrade confirmation is required before this switch can be scheduled.", impact });
          }

          var effectiveAtUtc = ResolveNextRenewalDateUtc(tenant, await LoadBillingHistoryAsync(dbContext, tenant.Id, cancellationToken));
          var stripeSyncError = await TrySyncStripeRenewalPriceAsync(
              onboardingService,
              tenant,
              targetTier.Id,
              cancellationToken);
          if (stripeSyncError is not null) {
            return stripeSyncError;
          }

          tenant.PendingSubscriptionTierId = targetTier.Id;
          tenant.PendingSubscriptionChangeRequestedAtUtc = utcNow;
          tenant.PendingSubscriptionChangeEffectiveAtUtc = effectiveAtUtc;
          tenant.PendingSubscriptionChangeCancelledAtUtc = null;

          await dbContext.SaveChangesAsync(cancellationToken);

          var pendingChange = await BuildPendingPlanChangeAsync(dbContext, currentTier, targetTier, tenant, cancellationToken);
          await WriteBillingAuditAsync(
              auditLogService,
              httpContext,
              tenant.Id,
              "SubscriptionChangeRequested",
              "Scheduled",
              targetTier.Id,
              targetTier.DisplayName,
              $"Scheduled {pendingChange.ChangeDirection.ToLowerInvariant()} from {currentTier.DisplayName} to {targetTier.DisplayName} for {effectiveAtUtc:yyyy-MM-dd}.",
              cancellationToken);

          return Results.Ok(new TenantBillingPlanChangeResponse(
              $"The {targetTier.DisplayName} switch is scheduled for the next renewal cycle.",
              pendingChange,
              impact));
        });

    tenantApi.MapDelete("/billing/subscription-change-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromQuery] string? scope,
        ServiFinanceDbContext dbContext,
        IRolePermissionAuthorizationService rolePermissionAuthorizationService,
        IPlatformTenantOnboardingService onboardingService,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var workspaceScope = ResolveBillingScope(httpContext, scope);
          var accessError = await RequireBillingPermissionAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              rolePermissionAuthorizationService,
              cancellationToken,
              workspaceScope,
              requireManage: true);
          if (accessError is not null) {
            return accessError;
          }

          var tenant = await dbContext.Tenants
              .Include(entity => entity.PendingSubscriptionTier)
              .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          if (!tenant.PendingSubscriptionTierId.HasValue) {
            return Results.BadRequest(new { error = "There is no pending tier or edition switch to cancel." });
          }

          var targetLabel = tenant.PendingSubscriptionTier?.DisplayName ?? "pending subscription switch";
          var activeTiers = await LoadActiveTiersAsync(dbContext, cancellationToken);
          var currentTier = ResolveCurrentTier(activeTiers, tenant);
          if (currentTier is null) {
            return Results.BadRequest(new { error = "The current tenant subscription tier could not be resolved." });
          }

          var stripeSyncError = await TrySyncStripeRenewalPriceAsync(
              onboardingService,
              tenant,
              currentTier.Id,
              cancellationToken);
          if (stripeSyncError is not null) {
            return stripeSyncError;
          }

          var utcNow = DateTime.UtcNow;
          var cooldownUntilUtc = utcNow.AddDays(7);
          tenant.PendingSubscriptionTierId = null;
          tenant.PendingSubscriptionChangeRequestedAtUtc = null;
          tenant.PendingSubscriptionChangeEffectiveAtUtc = null;
          tenant.PendingSubscriptionChangeCancelledAtUtc = utcNow;
          tenant.SubscriptionChangeCooldownUntilUtc = cooldownUntilUtc;

          await dbContext.SaveChangesAsync(cancellationToken);
          await WriteBillingAuditAsync(
              auditLogService,
              httpContext,
              tenant.Id,
              "SubscriptionChangeCancelled",
              "Cancelled",
              null,
              targetLabel,
              $"Cancelled the pending {targetLabel} switch. New switch requests are locked until {cooldownUntilUtc:yyyy-MM-dd}.",
              cancellationToken);

          return Results.Ok(new TenantBillingCancelPlanChangeResponse(
              "The pending tier or edition switch was cancelled. A 1 week cooldown is now active.",
              cooldownUntilUtc));
        });

    tenantApi.MapPost("/billing/submissions", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromQuery] string? scope,
        ServiFinanceDbContext dbContext,
        IRolePermissionAuthorizationService rolePermissionAuthorizationService,
        CancellationToken cancellationToken) => {
          var workspaceScope = ResolveBillingScope(httpContext, scope);
          var accessError = await RequireBillingPermissionAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              rolePermissionAuthorizationService,
              cancellationToken,
              workspaceScope,
              requireManage: true);
          if (accessError is not null) {
            return accessError;
          }

          return Results.BadRequest(new { error = "Manual tenant billing proof submission has been discontinued. Use the online billing provider and hosted billing portal for recurring renewal." });
        });

    return tenantApi;
  }

  private static async Task<IResult?> RequireBillingPermissionAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      CancellationToken cancellationToken,
      string workspaceScope,
      bool requireManage) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    var permissionKey = normalizedScope == PlatformRolePolicy.MlsScope
        ? requireManage ? "mls.billing.manage" : "mls.billing.view"
        : requireManage ? "sms.billing.manage" : "sms.billing.view";

    return await RequireTenantWorkspacePermissionAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        rolePermissionAuthorizationService,
        cancellationToken,
        normalizedScope,
        permissionKey,
        allowBillingRecoveryActions: true);
  }

  private static async Task<IResult?> TrySyncStripeRenewalPriceAsync(
      IPlatformTenantOnboardingService onboardingService,
      Tenant tenant,
      Guid targetTierId,
      CancellationToken cancellationToken) {
    if (!ShouldSyncStripeRenewalPrice(tenant)) {
      return null;
    }

    if (!onboardingService.IsConfigured) {
      return Results.BadRequest(new { error = "Stripe billing is not configured, so the renewal price cannot be updated." });
    }

    try {
      await onboardingService.ScheduleSubscriptionRenewalPriceChangeAsync(tenant.Id, targetTierId, cancellationToken);
      return null;
    } catch (InvalidOperationException ex) {
      return Results.BadRequest(new { error = ex.Message });
    } catch (Exception ex) {
      return Results.BadRequest(new { error = $"Stripe could not update the renewal price: {ex.Message}" });
    }
  }

  private static bool ShouldSyncStripeRenewalPrice(Tenant tenant) =>
    string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase) &&
    !string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId);

  private static string ResolveBillingScope(HttpContext httpContext, string? requestedScope) {
    if (!string.IsNullOrWhiteSpace(requestedScope)) {
      return RolePermissionCatalog.NormalizeWorkspaceScope(requestedScope);
    }

    var surfaceText = httpContext.User.FindFirstValue("surface");
    return string.Equals(surfaceText, AuthenticationSurface.TenantDesktop.ToString(), StringComparison.OrdinalIgnoreCase)
        ? PlatformRolePolicy.MlsScope
        : PlatformRolePolicy.SmsScope;
  }

  private static async Task<Tenant?> LoadTenantAsync(
      ServiFinanceDbContext dbContext,
      string tenantDomainSlug,
      CancellationToken cancellationToken) =>
    await dbContext.Tenants
        .Include(entity => entity.PendingSubscriptionTier)
        .ThenInclude(entity => entity!.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);

  private static async Task<List<SubscriptionTier>> LoadActiveTiersAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) =>
    await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .ToListAsync(cancellationToken);

  private static async Task<List<TenantBillingRecordRowResponse>> LoadBillingHistoryAsync(
      ServiFinanceDbContext dbContext,
      Guid tenantId,
      CancellationToken cancellationToken) =>
    await dbContext.TenantBillingRecords
        .AsNoTracking()
        .Where(entity => entity.TenantId == tenantId)
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .Select(entity => new TenantBillingRecordRowResponse(
            entity.Id,
            entity.BillingPeriodLabel,
            entity.CoverageStartUtc,
            entity.CoverageEndUtc,
            entity.DueDateUtc,
            entity.AmountDue,
            entity.AmountSubmitted,
            entity.PaymentMethod,
            entity.ReferenceNumber,
            entity.Status,
            entity.Note,
            entity.ReviewRemarks,
            entity.ProofOriginalFileName,
            entity.ProofRelativeUrl,
            entity.SubmittedByUser!.FullName,
            entity.SubmittedAtUtc,
            entity.ReviewedAtUtc))
        .ToListAsync(cancellationToken);

  private static TenantBillingStandingResponse BuildStanding(
      Tenant tenant,
      IReadOnlyList<TenantBillingRecordRowResponse> history,
      decimal? expectedRenewalAmount,
      bool stripeIsConfigured) {
    var utcToday = DateTime.UtcNow.Date;
    var isStripeManaged = string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase);
    var pendingReviewCount = history.Count(entity => entity.Status == "Pending Review");
    var latestSubmission = history
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .FirstOrDefault();
    var latestConfirmedCoverage = history
        .Where(entity => entity.Status == "Confirmed")
        .OrderByDescending(entity => entity.CoverageEndUtc)
        .FirstOrDefault();
    var futureSubmittedCoverage = history
        .Where(entity => entity.CoverageStartUtc > (latestConfirmedCoverage?.CoverageEndUtc ?? DateTime.MinValue))
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .FirstOrDefault();
    var nextRenewalDateUtc = futureSubmittedCoverage?.CoverageStartUtc
        ?? latestConfirmedCoverage?.CoverageEndUtc;

    var accountStanding = "Active";
    var suspensionRisk = "Low";

    if (tenant.SubscriptionStatus == "Suspended") {
      accountStanding = "Suspended";
      suspensionRisk = "High";
    }
    else if (tenant.SubscriptionStatus == "Past due") {
      accountStanding = "Payment failed";
      suspensionRisk = "High";
    }
    else if (pendingReviewCount > 0) {
      accountStanding = "Awaiting billing review";
      suspensionRisk = nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date < utcToday
          ? "High"
          : "Medium";
    }
    else if (nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date < utcToday) {
      accountStanding = "Renewal overdue";
      suspensionRisk = "High";
    }
    else if (nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date <= utcToday.AddDays(7)) {
      accountStanding = "Renewal due soon";
      suspensionRisk = "Medium";
    }

    return new TenantBillingStandingResponse(
        accountStanding,
        suspensionRisk,
        tenant.BillingProvider,
        nextRenewalDateUtc,
        expectedRenewalAmount,
        latestSubmission?.SubmittedAtUtc,
        latestSubmission?.Status,
        latestConfirmedCoverage?.CoverageEndUtc,
        pendingReviewCount,
        false,
        isStripeManaged && stripeIsConfigured && !string.IsNullOrWhiteSpace(tenant.StripeCustomerId));
  }

  private static TenantBillingChangeControlsResponse BuildChangeControls(Tenant tenant) {
    if (tenant.PendingSubscriptionTierId.HasValue) {
      return new TenantBillingChangeControlsResponse(false, null, "A tier or edition switch is already scheduled.");
    }

    if (tenant.SubscriptionChangeCooldownUntilUtc.HasValue &&
        tenant.SubscriptionChangeCooldownUntilUtc.Value > DateTime.UtcNow) {
      return new TenantBillingChangeControlsResponse(
          false,
          tenant.SubscriptionChangeCooldownUntilUtc,
          "A 1 week cooldown is active because the previous pending switch was cancelled.");
    }

    return new TenantBillingChangeControlsResponse(true, null, null);
  }

  private static async Task<TenantBillingPendingPlanChangeResponse> BuildPendingPlanChangeAsync(
      ServiFinanceDbContext dbContext,
      SubscriptionTier? currentTier,
      SubscriptionTier targetTier,
      Tenant tenant,
      CancellationToken cancellationToken) {
    var impact = currentTier is null
        ? EmptyImpact()
        : await BuildDowngradeImpactAsync(dbContext, currentTier, targetTier, cancellationToken);
    var requestedAtUtc = tenant.PendingSubscriptionChangeRequestedAtUtc ?? DateTime.UtcNow;
    var effectiveAtUtc = tenant.PendingSubscriptionChangeEffectiveAtUtc ?? DateTime.UtcNow.Date.AddMonths(1);

    return new TenantBillingPendingPlanChangeResponse(
        targetTier.Id,
        targetTier.DisplayName,
        targetTier.SubscriptionEdition,
        targetTier.BusinessSizeSegment,
        DetermineChangeDirection(currentTier, targetTier, impact),
        requestedAtUtc,
        effectiveAtUtc,
        impact);
  }

  private static async Task<TenantBillingDowngradeImpactResponse> BuildDowngradeImpactAsync(
      ServiFinanceDbContext dbContext,
      SubscriptionTier currentTier,
      SubscriptionTier targetTier,
      CancellationToken cancellationToken) {
    var currentModules = currentTier.Modules
        .Where(entity => entity.PlatformModule is not null && entity.PlatformModule.IsActive)
        .ToDictionary(entity => entity.PlatformModule!.Code, StringComparer.OrdinalIgnoreCase);
    var targetModules = targetTier.Modules
        .Where(entity => entity.PlatformModule is not null && entity.PlatformModule.IsActive)
        .ToDictionary(entity => entity.PlatformModule!.Code, StringComparer.OrdinalIgnoreCase);
    var lockedModules = currentModules.Values
        .Select(entity => {
          targetModules.TryGetValue(entity.PlatformModule!.Code, out var targetModule);
          return new {
            Current = entity,
            Target = targetModule
          };
        })
        .Where(entity => GetAccessRank(entity.Target?.AccessLevel) < GetAccessRank(entity.Current.AccessLevel))
        .OrderBy(entity => entity.Current.PlatformModule!.Channel)
        .ThenBy(entity => entity.Current.PlatformModule!.SortOrder)
        .Select(entity => new TenantBillingModuleImpactRowResponse(
            entity.Current.PlatformModule!.Code,
            entity.Current.PlatformModule.Name,
            entity.Current.PlatformModule.Channel,
            entity.Current.AccessLevel,
            entity.Target?.AccessLevel))
        .ToList();
    var workloadWarnings = await BuildWorkloadWarningsAsync(dbContext, lockedModules, cancellationToken);
    var isDowngrade = targetTier.MonthlyPriceAmount < currentTier.MonthlyPriceAmount ||
        lockedModules.Count > 0 ||
        (!targetTier.IncludesMicroLendingDesktop && currentTier.IncludesMicroLendingDesktop) ||
        (!targetTier.IncludesServiceManagementWeb && currentTier.IncludesServiceManagementWeb);
    var affectedRecords = workloadWarnings.Sum(entity => entity.ActiveWorkCount);
    var summary = isDowngrade
        ? $"This downgrade reduces access to {lockedModules.Count} module(s) and flags {affectedRecords} active record(s) for cleanup before renewal."
        : "No locked-module workload impact was detected for this switch.";

    return new TenantBillingDowngradeImpactResponse(
        isDowngrade,
        lockedModules,
        workloadWarnings,
        summary);
  }

  private static async Task<List<TenantBillingWorkloadImpactRowResponse>> BuildWorkloadWarningsAsync(
      ServiFinanceDbContext dbContext,
      IReadOnlyList<TenantBillingModuleImpactRowResponse> impactedModules,
      CancellationToken cancellationToken) {
    var warnings = new List<TenantBillingWorkloadImpactRowResponse>();
    foreach (var module in impactedModules) {
      var count = module.ModuleCode switch {
        SmsModuleCodeScheduling or SmsModuleCodeJobUpdates or SmsModuleCodeWorkforceOverview => await dbContext.Assignments.CountAsync(
            entity => entity.AssignmentStatus == "Pending Acceptance" ||
                entity.AssignmentStatus == "Scheduled" ||
                entity.AssignmentStatus == "In Progress" ||
                entity.AssignmentStatus == "On Hold",
            cancellationToken),
        SmsModuleCodeInvoicing => await dbContext.Invoices.CountAsync(
            entity => entity.InvoiceStatus != "Paid" && entity.InvoiceStatus != "Cancelled",
            cancellationToken),
        SmsModuleCodeSlaEscalations => await dbContext.ServiceRequests.CountAsync(
            entity => entity.CurrentStatus != "Completed" &&
                entity.CurrentStatus != "Closed" &&
                entity.CurrentStatus != "Cancelled" &&
                entity.RequestedServiceDate.HasValue &&
                entity.RequestedServiceDate.Value < DateTime.UtcNow.Date,
            cancellationToken),
        SmsModuleCodeFeedbackCrm => await dbContext.ServiceRequests.CountAsync(
            entity => entity.CompletedAtUtc.HasValue &&
                entity.Rating == null &&
                entity.FeedbackExpiresAtUtc.HasValue &&
                entity.FeedbackExpiresAtUtc.Value >= DateTime.UtcNow,
            cancellationToken),
        SmsModuleCodePartsCostControl => await dbContext.ServiceCostSheets.CountAsync(
            entity => entity.Status != "Finalized",
            cancellationToken),
        MlsModuleCodeServiceLinkedLoans => await dbContext.Invoices.CountAsync(
            entity => entity.InvoiceStatus == "Finalized" && entity.MicroLoan == null,
            cancellationToken),
        MlsModuleCodeStandaloneLoans or MlsModuleCodeFinancialRecords or MlsModuleCodePortfolioRiskDashboard => await dbContext.MicroLoans.CountAsync(
            entity => entity.LoanStatus != "Paid",
            cancellationToken),
        MlsModuleCodeAmortization or MlsModuleCodeCollectionsQueue => await dbContext.AmortizationSchedules.CountAsync(
            entity => entity.InstallmentStatus != "Paid",
            cancellationToken),
        MlsModuleCodeLoanApprovalWorkflow => await dbContext.Invoices.CountAsync(
            entity => entity.InvoiceStatus == "Finalized" && entity.MicroLoan == null && entity.OutstandingAmount > 0m,
            cancellationToken),
        _ => 0
      };

      if (count <= 0) {
        continue;
      }

      warnings.Add(new TenantBillingWorkloadImpactRowResponse(
          module.ModuleCode,
          module.ModuleName,
          count,
          BuildWorkloadWarningDetail(module.ModuleCode, count)));
    }

    return warnings;
  }

  private static string BuildWorkloadWarningDetail(string moduleCode, int count) =>
    moduleCode switch {
      SmsModuleCodeScheduling or SmsModuleCodeJobUpdates or SmsModuleCodeWorkforceOverview =>
        $"{count} active dispatch assignment(s) should be completed, cancelled, or reassigned before this module locks.",
      SmsModuleCodeInvoicing =>
        $"{count} open service invoice(s) may need settlement, loan conversion, or closure before invoicing locks.",
      SmsModuleCodeSlaEscalations =>
        $"{count} overdue open request(s) will lose SLA visibility after downgrade.",
      SmsModuleCodeFeedbackCrm =>
        $"{count} pending customer feedback follow-up record(s) will no longer appear in Feedback CRM.",
      SmsModuleCodePartsCostControl =>
        $"{count} draft cost sheet(s) should be finalized before cost control locks.",
      MlsModuleCodeServiceLinkedLoans or MlsModuleCodeLoanApprovalWorkflow =>
        $"{count} finance-ready invoice(s) should be converted, paid, or intentionally left outside MLS before downgrade.",
      MlsModuleCodeStandaloneLoans or MlsModuleCodeFinancialRecords or MlsModuleCodePortfolioRiskDashboard =>
        $"{count} active loan record(s) remain in MLS and will become read-limited or hidden after downgrade.",
      MlsModuleCodeAmortization or MlsModuleCodeCollectionsQueue =>
        $"{count} unpaid installment row(s) still need payment posting or collections handling.",
      _ => $"{count} active record(s) are linked to this module."
    };

  private static TenantBillingTierOptionResponse ToTierOptionResponse(SubscriptionTier tier) =>
    new(
        tier.Id,
        tier.Code,
        tier.DisplayName,
        tier.BusinessSizeSegment,
        tier.SubscriptionEdition,
        tier.MonthlyPriceAmount,
        tier.CurrencyCode,
        FormatPriceDisplay(tier.MonthlyPriceAmount, tier.CurrencyCode),
        tier.BillingLabel,
        tier.AudienceSummary,
        tier.PlanSummary,
        tier.IncludesServiceManagementWeb,
        tier.IncludesMicroLendingDesktop,
        BuildModuleRows(tier));

  private static List<TenantBillingModuleAccessRowResponse> BuildModuleRows(SubscriptionTier tier) =>
    tier.Modules
        .Where(module => module.PlatformModule is not null && module.PlatformModule.IsActive)
        .OrderBy(module => module.PlatformModule!.Channel)
        .ThenBy(module => module.SortOrder)
        .ThenBy(module => module.PlatformModule!.SortOrder)
        .ThenBy(module => module.PlatformModule!.Name)
        .Select(module => new TenantBillingModuleAccessRowResponse(
            module.PlatformModule!.Code,
            module.PlatformModule.Name,
            module.PlatformModule.Channel,
            module.AccessLevel))
        .ToList();

  private static SubscriptionTier? ResolveCurrentTier(
      IReadOnlyList<SubscriptionTier> activeTiers,
      Tenant tenant) =>
    activeTiers.FirstOrDefault(entity => entity.DisplayName == tenant.SubscriptionPlan)
        ?? activeTiers.FirstOrDefault(entity =>
            entity.BusinessSizeSegment == tenant.BusinessSizeSegment &&
            entity.SubscriptionEdition == tenant.SubscriptionEdition);

  private static string DetermineChangeDirection(
      SubscriptionTier? currentTier,
      SubscriptionTier targetTier,
      TenantBillingDowngradeImpactResponse impact) {
    if (currentTier is null) {
      return ChangeDirectionLateral;
    }

    if (impact.IsDowngrade) {
      return ChangeDirectionDowngrade;
    }

    return targetTier.MonthlyPriceAmount > currentTier.MonthlyPriceAmount
        ? ChangeDirectionUpgrade
        : ChangeDirectionLateral;
  }

  private static DateTime ResolveNextRenewalDateUtc(
      Tenant tenant,
      IReadOnlyList<TenantBillingRecordRowResponse> history) {
    var latestConfirmedCoverageEnd = history
        .Where(entity => entity.Status == "Confirmed")
        .OrderByDescending(entity => entity.CoverageEndUtc)
        .Select(entity => (DateTime?)entity.CoverageEndUtc.Date)
        .FirstOrDefault();
    var nextRenewalDateUtc = latestConfirmedCoverageEnd ?? DateTime.UtcNow.Date.AddMonths(1);

    if (nextRenewalDateUtc <= DateTime.UtcNow.Date) {
      nextRenewalDateUtc = DateTime.UtcNow.Date.AddMonths(1);
    }

    if (tenant.PendingSubscriptionChangeEffectiveAtUtc.HasValue &&
        tenant.PendingSubscriptionChangeEffectiveAtUtc.Value > DateTime.UtcNow) {
      return tenant.PendingSubscriptionChangeEffectiveAtUtc.Value;
    }

    return nextRenewalDateUtc;
  }

  private static int GetAccessRank(string? accessLevel) {
    if (string.IsNullOrWhiteSpace(accessLevel)) {
      return 0;
    }

    if (string.Equals(accessLevel, "Excluded", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(accessLevel, "None", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(accessLevel, "Not Included", StringComparison.OrdinalIgnoreCase)) {
      return 0;
    }

    return string.Equals(accessLevel, ModuleAccessLevelIncluded, StringComparison.OrdinalIgnoreCase)
        ? 2
        : 1;
  }

  private static TenantBillingDowngradeImpactResponse EmptyImpact() =>
    new(
        false,
        [],
        [],
        "No locked-module workload impact was detected for this switch.");

  private static string BuildBillingReturnUrl(HttpContext httpContext, string tenantDomainSlug, string workspaceScope) {
    var path = workspaceScope == PlatformRolePolicy.MlsScope
        ? "/t/mls/billing"
        : $"/t/{tenantDomainSlug}/billing";
    return $"{httpContext.Request.Scheme}://{httpContext.Request.Host}{httpContext.Request.PathBase}{path}";
  }

  private static Task WriteBillingAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      Guid tenantId,
      string actionType,
      string outcome,
      Guid? subjectId,
      string subjectLabel,
      string detail,
      CancellationToken cancellationToken) =>
    auditLogService.WriteAsync(
        new AuditLogEntry(
            tenantId,
            "TenantBilling",
            "System",
            actionType,
            outcome,
            TryGetCurrentUserId(httpContext.User, out var userId) ? userId : null,
            httpContext.User.FindFirstValue(ClaimTypes.Name),
            httpContext.User.FindFirstValue(ClaimTypes.Email),
            "SubscriptionTier",
            subjectId,
            subjectLabel,
            detail,
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.Request.Headers.UserAgent.ToString()),
        cancellationToken);

  private static string FormatPriceDisplay(decimal amount, string currencyCode) =>
    $"Starts at {currencyCode} {amount.ToString("N0", CultureInfo.InvariantCulture)}";
}
