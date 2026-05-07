namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class RolePermissionEndpointMappings {
  public static RouteGroupBuilder MapSuperadminRolePermissionEndpoints(this RouteGroupBuilder superadminApi) {
    superadminApi.MapGet("/roles-permissions", GetRootWorkspaceAsync)
        .RequireRootPermission("root.roles-permissions.manage");
    superadminApi.MapPost("/roles-permissions/roles", CreateRootRoleAsync)
        .RequireRootPermission("root.roles-permissions.manage");
    superadminApi.MapPut("/roles-permissions/roles/{roleId:guid}", UpdateRootRoleAsync)
        .RequireRootPermission("root.roles-permissions.manage");
    superadminApi.MapGet("/roles-permissions/roles/{roleId:guid}/users", GetRootRoleUsersAsync)
        .RequireRootPermission("root.roles-permissions.manage");
    superadminApi.MapPut("/roles-permissions/roles/{roleId:guid}/permissions", UpdateRootRolePermissionsAsync)
        .RequireRootPermission("root.roles-permissions.manage");
    return superadminApi;
  }

  public static RouteGroupBuilder MapTenantRolePermissionEndpoints(this RouteGroupBuilder tenantApi) {
    var authorization = CreateTenantAuthorization();
    tenantApi.MapGet("/roles-permissions", GetTenantWorkspaceAsync)
        .RequireAuthorization(authorization)
        .RequireTenantRolePermissionManagement();
    tenantApi.MapPost("/roles-permissions/roles", CreateTenantRoleAsync)
        .RequireAuthorization(authorization)
        .RequireTenantRolePermissionManagement();
    tenantApi.MapPut("/roles-permissions/roles/{roleId:guid}", UpdateTenantRoleAsync)
        .RequireAuthorization(authorization)
        .RequireTenantRolePermissionManagement();
    tenantApi.MapGet("/roles-permissions/roles/{roleId:guid}/users", GetTenantRoleUsersAsync)
        .RequireAuthorization(authorization)
        .RequireTenantRolePermissionManagement();
    tenantApi.MapPut("/roles-permissions/roles/{roleId:guid}/permissions", UpdateTenantRolePermissionsAsync)
        .RequireAuthorization(authorization)
        .RequireTenantRolePermissionManagement();
    return tenantApi;
  }

  private static AuthorizeAttribute CreateTenantAuthorization() =>
    new() {
      AuthenticationSchemes = ApiAuthenticationSchemes
    };

  private static async Task<IResult> GetRootWorkspaceAsync(
    HttpContext httpContext,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.GetWorkspaceAsync(
        PlatformRolePolicy.RootScope,
        userId,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> UpdateRootRolePermissionsAsync(
    HttpContext httpContext,
    Guid roleId,
    [FromBody] UpdateRolePermissionSetRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.UpdateRolePermissionsAsync(
        PlatformRolePolicy.RootScope,
        userId,
        roleId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> CreateRootRoleAsync(
    HttpContext httpContext,
    [FromBody] CreateRoleRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.CreateRoleAsync(
        PlatformRolePolicy.RootScope,
        userId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> UpdateRootRoleAsync(
    HttpContext httpContext,
    Guid roleId,
    [FromBody] UpdateRoleRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.UpdateRoleAsync(
        PlatformRolePolicy.RootScope,
        userId,
        roleId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> GetRootRoleUsersAsync(
    HttpContext httpContext,
    Guid roleId,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out _)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.GetRoleUsersAsync(
        PlatformRolePolicy.RootScope,
        roleId,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> GetTenantWorkspaceAsync(
    HttpContext httpContext,
    string tenantDomainSlug,
    string? scope,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.GetWorkspaceAsync(
        scope ?? PlatformRolePolicy.SmsScope,
        userId,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> CreateTenantRoleAsync(
    HttpContext httpContext,
    string tenantDomainSlug,
    string? scope,
    [FromBody] CreateRoleRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.CreateRoleAsync(
        scope ?? PlatformRolePolicy.SmsScope,
        userId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> UpdateTenantRoleAsync(
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid roleId,
    string? scope,
    [FromBody] UpdateRoleRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.UpdateRoleAsync(
        scope ?? PlatformRolePolicy.SmsScope,
        userId,
        roleId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> GetTenantRoleUsersAsync(
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid roleId,
    string? scope,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!TryGetCurrentUserId(httpContext.User, out _)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.GetRoleUsersAsync(
        scope ?? PlatformRolePolicy.SmsScope,
        roleId,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }

  private static async Task<IResult> UpdateTenantRolePermissionsAsync(
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid roleId,
    string? scope,
    [FromBody] UpdateRolePermissionSetRequest request,
    IRolePermissionManagementService rolePermissionManagementService,
    CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    try {
      return Results.Ok(await rolePermissionManagementService.UpdateRolePermissionsAsync(
        scope ?? PlatformRolePolicy.SmsScope,
        userId,
        roleId,
        request,
        cancellationToken));
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }
  }
}
