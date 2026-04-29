namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Subscriptions;
using ServiFinance.Infrastructure.Configuration;

internal static class PlatformApiEndpointMappings {
  public static RouteGroupBuilder MapPlatformApiEndpoints(this RouteGroupBuilder api) {
    api.MapGet("/health", [AllowAnonymous] () => Results.Ok(new { status = "ok" }));
    api.MapGet("/catalog/subscription-tiers", [AllowAnonymous] async Task<IResult> (
        ISubscriptionTierCatalogService subscriptionTierCatalogService,
        CancellationToken cancellationToken) =>
        Results.Ok(await subscriptionTierCatalogService.GetActiveTiersAsync(cancellationToken)));

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
              t.DisplayName,
              t.LogoUrl,
              t.PrimaryColor,
              t.SecondaryColor,
              t.HeaderBackgroundColor,
              t.PageBackgroundColor
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