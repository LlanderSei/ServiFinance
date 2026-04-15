namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using ServiFinance.Application.Subscriptions;

internal static class PlatformApiEndpointMappings {
  public static RouteGroupBuilder MapPlatformApiEndpoints(this RouteGroupBuilder api) {
    api.MapGet("/health", [AllowAnonymous] () => Results.Ok(new { status = "ok" }));
    api.MapGet("/catalog/subscription-tiers", [AllowAnonymous] async Task<IResult> (
        ISubscriptionTierCatalogService subscriptionTierCatalogService,
        CancellationToken cancellationToken) =>
        Results.Ok(await subscriptionTierCatalogService.GetActiveTiersAsync(cancellationToken)));

    return api;
  }
}