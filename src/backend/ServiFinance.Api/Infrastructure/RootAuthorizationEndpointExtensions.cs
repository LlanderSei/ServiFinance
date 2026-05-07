namespace ServiFinance.Api.Infrastructure;

using ServiFinance.Application.Auth;

internal static class RootAuthorizationEndpointExtensions {
  internal static RouteHandlerBuilder RequireRootPermission(
    this RouteHandlerBuilder builder,
    string permissionKey) {
    return builder.AddEndpointFilter(async (context, next) => {
      var httpContext = context.HttpContext;
      if (!ProgramEndpointSupport.TryGetCurrentUserId(httpContext.User, out var userId)) {
        return Results.Unauthorized();
      }

      var rolePermissionAuthorizationService = httpContext.RequestServices.GetRequiredService<IRolePermissionAuthorizationService>();
      if (!await rolePermissionAuthorizationService.HasPermissionAsync(
        userId,
        PlatformRolePolicy.RootScope,
        permissionKey,
        httpContext.RequestAborted)) {
        return ProgramEndpointSupport.CreateJsonError(
          StatusCodes.Status403Forbidden,
          "Your role does not include the required root permission for this action.");
      }

      return await next(context);
    });
  }
}
