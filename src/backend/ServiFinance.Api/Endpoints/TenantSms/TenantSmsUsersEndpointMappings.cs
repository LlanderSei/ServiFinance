namespace ServiFinance.Api.Endpoints.TenantSms;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsUsersEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsUsersEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/users", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        IUserManagementService userManagementService,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          return Results.Ok(await userManagementService.GetUsersAsync(cancellationToken));
        });

    tenantApi.MapGet("/sms/roles", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        IUserManagementService userManagementService,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          return Results.Ok(await userManagementService.GetRolesAsync(cancellationToken));
        });

    tenantApi.MapPost("/sms/users", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateUserRequest request,
        IUserManagementService userManagementService,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          try {
            return Results.Ok(await userManagementService.CreateUserAsync(request, cancellationToken));
          }
          catch (InvalidOperationException exception) {
            return Results.BadRequest(new { error = exception.Message });
          }
        });

    tenantApi.MapPost("/sms/users/{userId:guid}/toggle", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid userId,
        [FromBody] ToggleUserStateRequest request,
        IUserManagementService userManagementService,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          await userManagementService.SetUserActiveStateAsync(userId, request.IsActive, cancellationToken);
          return Results.NoContent();
        });

    return tenantApi;
  }
}