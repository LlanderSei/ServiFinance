namespace ServiFinance.Api.Infrastructure;

using ServiFinance.Application.Auth;
using ServiFinance.Infrastructure.Data;

internal static class TenantAuthorizationEndpointExtensions {
  internal static RouteHandlerBuilder RequireTenantSmsPermission(
    this RouteHandlerBuilder builder,
    string permissionKey,
    string? requiredModuleCode = null) {
    return builder.AddEndpointFilter(async (context, next) => {
      var httpContext = context.HttpContext;
      var tenantDomainSlug = httpContext.Request.RouteValues["tenantDomainSlug"]?.ToString();
      if (string.IsNullOrWhiteSpace(tenantDomainSlug)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "The tenant domain route could not be resolved.");
      }

      var dbContext = httpContext.RequestServices.GetRequiredService<ServiFinanceDbContext>();
      var rolePermissionAuthorizationService = httpContext.RequestServices.GetRequiredService<IRolePermissionAuthorizationService>();
      var accessError = await ProgramEndpointSupport.RequireTenantSmsAccessAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        rolePermissionAuthorizationService,
        httpContext.RequestAborted,
        permissionKey,
        requiredModuleCode);

      return accessError ?? await next(context);
    });
  }

  internal static RouteHandlerBuilder RequireTenantMlsPermission(
    this RouteHandlerBuilder builder,
    string permissionKey,
    string? requiredModuleCode = null) {
    return builder.AddEndpointFilter(async (context, next) => {
      var httpContext = context.HttpContext;
      var tenantDomainSlug = httpContext.Request.RouteValues["tenantDomainSlug"]?.ToString();
      if (string.IsNullOrWhiteSpace(tenantDomainSlug)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "The tenant domain route could not be resolved.");
      }

      var dbContext = httpContext.RequestServices.GetRequiredService<ServiFinanceDbContext>();
      var accessError = await ProgramEndpointSupport.RequireTenantMlsAccessAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        httpContext.RequestAborted,
        requiredModuleCode);
      if (accessError is not null) {
        return accessError;
      }

      if (!ProgramEndpointSupport.TryGetCurrentUserId(httpContext.User, out var userId)) {
        return Results.Unauthorized();
      }

      var rolePermissionAuthorizationService = httpContext.RequestServices.GetRequiredService<IRolePermissionAuthorizationService>();
      if (!await rolePermissionAuthorizationService.HasPermissionAsync(
        userId,
        PlatformRolePolicy.MlsScope,
        permissionKey,
        httpContext.RequestAborted)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "Your role does not include the required MLS permission for this action.");
      }

      return await next(context);
    });
  }

  internal static RouteHandlerBuilder RequireTenantRolePermissionManagement(this RouteHandlerBuilder builder) {
    return builder.AddEndpointFilter(async (context, next) => {
      var httpContext = context.HttpContext;
      var tenantDomainSlug = httpContext.Request.RouteValues["tenantDomainSlug"]?.ToString();
      if (string.IsNullOrWhiteSpace(tenantDomainSlug)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "The tenant domain route could not be resolved.");
      }

      var requestedScope = httpContext.Request.Query["scope"].ToString();
      var normalizedScope = string.IsNullOrWhiteSpace(requestedScope)
        ? PlatformRolePolicy.SmsScope
        : RolePermissionCatalog.NormalizeWorkspaceScope(requestedScope);
      var permissionKey = normalizedScope == PlatformRolePolicy.MlsScope
        ? "mls.roles-permissions.manage"
        : "sms.roles-permissions.manage";

      var dbContext = httpContext.RequestServices.GetRequiredService<ServiFinanceDbContext>();
      var rolePermissionAuthorizationService = httpContext.RequestServices.GetRequiredService<IRolePermissionAuthorizationService>();
      var accessError = await ProgramEndpointSupport.RequireTenantWorkspacePermissionAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        rolePermissionAuthorizationService,
        httpContext.RequestAborted,
        normalizedScope,
        permissionKey);

      return accessError ?? await next(context);
    });
  }

  internal static RouteHandlerBuilder RequireTenantPlatformUsersPermission(this RouteHandlerBuilder builder) {
    return builder.AddEndpointFilter(async (context, next) => {
      var httpContext = context.HttpContext;
      var tenantDomainSlug = httpContext.Request.RouteValues["tenantDomainSlug"]?.ToString();
      if (string.IsNullOrWhiteSpace(tenantDomainSlug)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "The tenant domain route could not be resolved.");
      }

      var surfaceText = httpContext.User.FindFirst("surface")?.Value;
      var isMlsSurface = string.Equals(
        surfaceText,
        AuthenticationSurface.TenantDesktop.ToString(),
        StringComparison.OrdinalIgnoreCase);
      var workspaceScope = isMlsSurface
        ? PlatformRolePolicy.MlsScope
        : PlatformRolePolicy.SmsScope;
      var permissionKey = isMlsSurface
        ? "mls.users.manage"
        : "sms.users.manage";

      var dbContext = httpContext.RequestServices.GetRequiredService<ServiFinanceDbContext>();
      var rolePermissionAuthorizationService = httpContext.RequestServices.GetRequiredService<IRolePermissionAuthorizationService>();
      var accessError = await ProgramEndpointSupport.RequireTenantWorkspacePermissionAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        rolePermissionAuthorizationService,
        httpContext.RequestAborted,
        workspaceScope,
        permissionKey);

      return accessError ?? await next(context);
    });
  }
}
