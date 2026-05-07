namespace ServiFinance.Api.Endpoints.TenantBilling;

using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Onboarding;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantBillingEndpointMappings {
  public static RouteGroupBuilder MapTenantBillingEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/billing/overview", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        IPlatformTenantOnboardingService onboardingService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var tenant = await dbContext.Tenants
              .AsNoTracking()
              .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          var currentTier = await ResolveCurrentTierAsync(dbContext, tenant, cancellationToken);
          var history = await dbContext.TenantBillingRecords
              .AsNoTracking()
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

          var standing = BuildStanding(tenant, history, TryParseSubscriptionAmount(currentTier?.PriceDisplay), onboardingService.IsConfigured);
          var modules = currentTier?.Modules
              .OrderBy(module => module.SortOrder)
              .ThenBy(module => module.PlatformModule!.SortOrder)
              .ThenBy(module => module.PlatformModule!.Name)
              .Select(module => new TenantBillingModuleAccessRowResponse(
                  module.PlatformModule!.Code,
                  module.PlatformModule.Name,
                  module.PlatformModule.Channel,
                  module.AccessLevel))
              .ToList()
              ?? [];

          return Results.Ok(new TenantBillingOverviewResponse(
              new TenantBillingPlanSummaryResponse(
                  tenant.BusinessSizeSegment,
                  tenant.SubscriptionEdition,
                  tenant.SubscriptionPlan,
                  tenant.SubscriptionStatus,
                  currentTier?.PriceDisplay,
                  currentTier?.BillingLabel,
                  currentTier?.AudienceSummary,
                  currentTier?.PlanSummary,
                  modules),
              standing,
              history));
        })
        .RequireTenantSmsPermission("sms.billing.view");
    tenantApi.MapPost("/billing/portal-session", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        IPlatformTenantOnboardingService onboardingService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var tenant = await dbContext.Tenants
              .AsNoTracking()
              .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          try {
            var returnUrl = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}{httpContext.Request.PathBase}/t/{tenantDomainSlug}/billing";
            var portalSession = await onboardingService.CreateBillingPortalSessionAsync(tenant.Id, returnUrl, cancellationToken);
            return Results.Ok(new TenantBillingPortalSessionResponse(portalSession.Url));
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        })
        .RequireTenantSmsPermission("sms.billing.manage");

    tenantApi.MapPost("/billing/submissions", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out _)) {
            return Results.Unauthorized();
          }

          var tenantExists = await dbContext.Tenants
              .AnyAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (!tenantExists) {
            return Results.NotFound();
          }

          return Results.BadRequest(new { error = "Manual tenant billing proof submission has been discontinued. Use the online billing provider and hosted billing portal for recurring renewal." });
        })
        .RequireTenantSmsPermission("sms.billing.manage");

    return tenantApi;
  }

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

  private static async Task<SubscriptionTier?> ResolveCurrentTierAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Tenant tenant,
      CancellationToken cancellationToken) {
    var activeTiers = await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .ToListAsync(cancellationToken);

    return activeTiers.FirstOrDefault(entity => entity.DisplayName == tenant.SubscriptionPlan)
        ?? activeTiers.FirstOrDefault(entity =>
            entity.BusinessSizeSegment == tenant.BusinessSizeSegment &&
            entity.SubscriptionEdition == tenant.SubscriptionEdition);
  }

  private static decimal? TryParseSubscriptionAmount(string? priceDisplay) {
    if (string.IsNullOrWhiteSpace(priceDisplay)) {
      return null;
    }

    var match = Regex.Match(priceDisplay, @"([\d,]+(?:\.\d+)?)");
    if (!match.Success) {
      return null;
    }

    return decimal.TryParse(
        match.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
        NumberStyles.Number,
        CultureInfo.InvariantCulture,
        out var amount)
        ? amount
        : null;
  }
}
