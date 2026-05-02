namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Stripe;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Onboarding;
using ServiFinance.Application.Subscriptions;
using ServiFinance.Infrastructure.Configuration;
using AppCreatePlatformTenantCheckoutRequest = ServiFinance.Application.Onboarding.CreatePlatformTenantCheckoutRequest;

internal static class PlatformApiEndpointMappings {
  public static RouteGroupBuilder MapPlatformApiEndpoints(this RouteGroupBuilder api) {
    api.MapGet("/health", [AllowAnonymous] () => Results.Ok(new { status = "ok" }));
    api.MapGet("/catalog/subscription-tiers", [AllowAnonymous] async Task<IResult> (
        ISubscriptionTierCatalogService subscriptionTierCatalogService,
        CancellationToken cancellationToken) =>
        Results.Ok(await subscriptionTierCatalogService.GetActiveTiersAsync(cancellationToken)));
    api.MapPost("/platform/registration/checkout", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        ServiFinance.Api.Contracts.CreatePlatformTenantCheckoutRequest request,
        IPlatformTenantOnboardingService onboardingService,
        CancellationToken cancellationToken) => {
          try {
            var baseUrl = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}{httpContext.Request.PathBase}";
            var session = await onboardingService.CreateCheckoutSessionAsync(
                new AppCreatePlatformTenantCheckoutRequest(
                    request.BusinessName,
                    request.DomainSlug,
                    request.OwnerFullName,
                    request.OwnerEmail,
                    request.OwnerPassword,
                    request.SubscriptionTierId),
                baseUrl,
                cancellationToken);

            return Results.Ok(new CreatePlatformTenantCheckoutResponse(
                session.RegistrationId,
                session.CheckoutSessionId,
                session.CheckoutUrl));
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });
    api.MapGet("/platform/registration/status", [AllowAnonymous] async Task<IResult> (
        string sessionId,
        IPlatformTenantOnboardingService onboardingService,
        CancellationToken cancellationToken) => {
          var status = await onboardingService.GetRegistrationStatusAsync(sessionId, cancellationToken);
          if (status is null) {
            return Results.NotFound();
          }

          return Results.Ok(new PlatformTenantRegistrationStatusResponse(
              status.RegistrationId,
              status.Status,
              status.BusinessName,
              status.DomainSlug,
              status.OwnerEmail,
              status.SubscriptionPlan,
              status.SubscriptionEdition,
              status.BillingProvider,
              status.StripeSubscriptionStatus,
              status.FailureReason,
              status.TenantId,
              status.TenantLoginUrl,
              status.CreatedAtUtc,
              status.ProvisionedAtUtc));
        });
    api.MapPost("/platform/stripe/webhook", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        IPlatformTenantOnboardingService onboardingService,
        CancellationToken cancellationToken) => {
          try {
            using var reader = new StreamReader(httpContext.Request.Body);
            var payload = await reader.ReadToEndAsync(cancellationToken);
            await onboardingService.ProcessWebhookAsync(
                payload,
                httpContext.Request.Headers["Stripe-Signature"],
                cancellationToken);
            return Results.Ok();
          } catch (StripeException ex) {
            return Results.BadRequest(new { error = ex.Message });
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });

    api.MapGet("/tenants/{slug}/public-info", [AllowAnonymous] async Task<IResult> (
        string slug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t =>
              t.DomainSlug == slug.ToLower() &&
              t.IsActive &&
              t.Id != ServiFinanceDatabaseDefaults.PlatformTenantId)
            .Select(t => new {
              t.DomainSlug,
              DisplayName = t.Theme == null ? null : t.Theme.DisplayName,
              LogoUrl = t.Theme == null ? null : t.Theme.LogoUrl,
              PrimaryColor = t.Theme == null ? null : t.Theme.PrimaryColor,
              SecondaryColor = t.Theme == null ? null : t.Theme.SecondaryColor,
              HeaderBackgroundColor = t.Theme == null ? null : t.Theme.HeaderBackgroundColor,
              PageBackgroundColor = t.Theme == null ? null : t.Theme.PageBackgroundColor
            })
            .FirstOrDefaultAsync(cancellationToken);

          if (tenant is null) {
            return Results.NotFound(new { error = "Tenant domain not found or is no longer active." });
          }

          return Results.Ok(tenant);
        });

    return api;
  }
}
