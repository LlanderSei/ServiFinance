namespace ServiFinance.Api.Endpoints.TenantBilling;

using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Onboarding;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantBillingEndpointMappings {
  public static RouteGroupBuilder MapTenantBillingEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/billing/overview", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
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
        });
    tenantApi.MapPost("/billing/portal-session", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
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
        });

    tenantApi.MapPost("/billing/submissions", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromForm] SubmitTenantBillingProofRequest request,
        IWebHostEnvironment environment,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (request.AmountSubmitted <= 0m) {
            return Results.BadRequest(new { error = "Enter the submitted billing amount." });
          }

          var paymentMethod = request.PaymentMethod?.Trim();
          if (string.IsNullOrWhiteSpace(paymentMethod)) {
            return Results.BadRequest(new { error = "Select the payment method used for this billing submission." });
          }

          var referenceNumber = request.ReferenceNumber?.Trim();
          if (string.IsNullOrWhiteSpace(referenceNumber)) {
            return Results.BadRequest(new { error = "Enter the payment reference number for billing review." });
          }

          var tenant = await dbContext.Tenants
              .SingleOrDefaultAsync(entity => entity.DomainSlug == tenantDomainSlug, cancellationToken);
          if (tenant is null) {
            return Results.NotFound();
          }

          if (string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "This tenant uses Stripe-managed billing. Open the billing portal instead of submitting manual proof." });
          }

          var hasPendingReview = await dbContext.TenantBillingRecords
              .AnyAsync(entity => entity.TenantId == tenant.Id && entity.Status == "Pending Review", cancellationToken);
          if (hasPendingReview) {
            return Results.BadRequest(new { error = "A billing submission is already pending review for this tenant." });
          }

          var currentTier = await ResolveCurrentTierAsync(dbContext, tenant, cancellationToken);
          var expectedRenewalAmount = TryParseSubscriptionAmount(currentTier?.PriceDisplay) ?? request.AmountSubmitted;
          var latestConfirmedRecord = await dbContext.TenantBillingRecords
              .AsNoTracking()
              .Where(entity => entity.TenantId == tenant.Id)
              .Where(entity => entity.Status == "Confirmed")
              .OrderByDescending(entity => entity.CoverageEndUtc)
              .ThenByDescending(entity => entity.SubmittedAtUtc)
              .FirstOrDefaultAsync(cancellationToken);

          var utcToday = DateTime.UtcNow.Date;
          var nextCoverageStartUtc = latestConfirmedRecord is null
              ? utcToday
              : latestConfirmedRecord.CoverageEndUtc.Date.AddDays(1);
          if (nextCoverageStartUtc < utcToday) {
            nextCoverageStartUtc = utcToday;
          }

          var nextCoverageEndUtc = nextCoverageStartUtc.AddMonths(1).AddDays(-1);
          var billingRecord = new TenantBillingRecord {
            TenantId = tenant.Id,
            SubmittedByUserId = currentUserId,
            BillingPeriodLabel = $"{nextCoverageStartUtc:MMMM yyyy} subscription cycle",
            CoverageStartUtc = nextCoverageStartUtc,
            CoverageEndUtc = nextCoverageEndUtc,
            DueDateUtc = nextCoverageStartUtc,
            AmountDue = expectedRenewalAmount,
            AmountSubmitted = request.AmountSubmitted,
            PaymentMethod = paymentMethod,
            ReferenceNumber = referenceNumber,
            Status = "Pending Review",
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            SubmittedAtUtc = DateTime.UtcNow
          };

          if (request.ProofFile is not null && request.ProofFile.Length > 0) {
            if (request.ProofFile.Length > 8 * 1024 * 1024) {
              return Results.BadRequest(new { error = "Proof of payment must be 8 MB or smaller." });
            }

            var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
            var uploadDirectory = Path.Combine(
                webRootPath,
                "uploads",
                "tenant-billing",
                tenantDomainSlug,
                billingRecord.Id.ToString("N"));
            Directory.CreateDirectory(uploadDirectory);

            var proofExtension = Path.GetExtension(request.ProofFile.FileName);
            var storedFileName = $"billing-proof-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{proofExtension}";
            var absoluteFilePath = Path.Combine(uploadDirectory, storedFileName);

            await using (var stream = File.Create(absoluteFilePath)) {
              await request.ProofFile.CopyToAsync(stream, cancellationToken);
            }

            billingRecord.ProofOriginalFileName = request.ProofFile.FileName;
            billingRecord.ProofStoredFileName = storedFileName;
            billingRecord.ProofContentType = request.ProofFile.ContentType;
            billingRecord.ProofRelativeUrl = $"/uploads/tenant-billing/{tenantDomainSlug}/{billingRecord.Id:N}/{storedFileName}";
          }

          dbContext.TenantBillingRecords.Add(billingRecord);
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantBillingRecordRowResponse(
              billingRecord.Id,
              billingRecord.BillingPeriodLabel,
              billingRecord.CoverageStartUtc,
              billingRecord.CoverageEndUtc,
              billingRecord.DueDateUtc,
              billingRecord.AmountDue,
              billingRecord.AmountSubmitted,
              billingRecord.PaymentMethod,
              billingRecord.ReferenceNumber,
              billingRecord.Status,
              billingRecord.Note,
              billingRecord.ReviewRemarks,
              billingRecord.ProofOriginalFileName,
              billingRecord.ProofRelativeUrl,
              httpContext.User.Identity?.Name ?? "Tenant administrator",
              billingRecord.SubmittedAtUtc,
              billingRecord.ReviewedAtUtc));
        });

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
        !isStripeManaged && pendingReviewCount == 0,
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
