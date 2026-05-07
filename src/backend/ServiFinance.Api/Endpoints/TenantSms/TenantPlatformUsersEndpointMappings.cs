namespace ServiFinance.Api.Endpoints.TenantSms;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantPlatformUsersEndpointMappings {
  public static RouteGroupBuilder MapTenantPlatformUsersEndpoints(this RouteGroupBuilder tenantApi) {
    MapRoutes(tenantApi, "/platform");
    MapRoutes(tenantApi, "/sms");
    return tenantApi;
  }

  private static void MapRoutes(RouteGroupBuilder tenantApi, string routePrefix) {
    tenantApi.MapGet($"{routePrefix}/users", GetUsersAsync)
        .RequireAuthorization(CreateTenantAuthorization())
        .RequireTenantPlatformUsersPermission();
    tenantApi.MapGet($"{routePrefix}/roles", GetRolesAsync)
        .RequireAuthorization(CreateTenantAuthorization())
        .RequireTenantPlatformUsersPermission();
    tenantApi.MapPost($"{routePrefix}/users", CreateUserAsync)
        .RequireAuthorization(CreateTenantAuthorization())
        .RequireTenantPlatformUsersPermission();
    tenantApi.MapPut($"{routePrefix}/users/{{userId:guid}}", UpdateUserAsync)
        .RequireAuthorization(CreateTenantAuthorization())
        .RequireTenantPlatformUsersPermission();
    tenantApi.MapPost($"{routePrefix}/users/{{userId:guid}}/toggle", ToggleUserAsync)
        .RequireAuthorization(CreateTenantAuthorization())
        .RequireTenantPlatformUsersPermission();
  }

  private static AuthorizeAttribute CreateTenantAuthorization() =>
    new() {
      AuthenticationSchemes = ApiAuthenticationSchemes
    };

  private static async Task<IResult> GetUsersAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      IUserManagementService userManagementService,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    return Results.Ok(await userManagementService.GetUsersAsync(cancellationToken));
  }

  private static async Task<IResult> GetRolesAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      IUserManagementService userManagementService,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    return Results.Ok(await userManagementService.GetRolesAsync(cancellationToken));
  }

  private static async Task<IResult> CreateUserAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      [FromBody] CreateUserRequest request,
      IUserManagementService userManagementService,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    try {
      return Results.Ok(await userManagementService.CreateUserAsync(request, cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> UpdateUserAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid userId,
      [FromBody] UpdateUserRequest request,
      IUserManagementService userManagementService,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    try {
      return Results.Ok(await userManagementService.UpdateUserAsync(userId, request, cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> ToggleUserAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid userId,
      [FromBody] ToggleUserStateRequest request,
      IUserManagementService userManagementService,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    await userManagementService.SetUserActiveStateAsync(userId, request.IsActive, cancellationToken);
    return Results.NoContent();
  }
}
