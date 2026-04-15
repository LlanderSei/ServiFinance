namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class WebAccountEndpointMappings {
  public static WebApplication MapWebAccountEndpoints(this WebApplication app) {
    app.MapPost("/account/root-login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromForm] RootLoginRequest request,
        IUserAuthenticationService authenticationService) => {
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(
              request.Email,
              request.Password,
              AuthenticationSurface.Root),
          httpContext.RequestAborted);
          var returnUrl = SanitizeReturnUrl(request.ReturnUrl);

          if (user is null) {
            return Results.LocalRedirect($"/?error=Invalid%20superadmin%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          await SignInUserAsync(httpContext, user, request.RememberMe);

          return Results.LocalRedirect(returnUrl);
        });
    app.MapPost("/account/tenant-login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromForm] TenantLoginRequest request,
        IUserAuthenticationService authenticationService) => {
          var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
          var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(
              request.Email,
              request.Password,
              surface,
              tenantSlug),
          httpContext.RequestAborted);
          var fallbackUrl = isMls
          ? "/t/mls/dashboard"
          : $"/t/{tenantSlug}/sms/dashboard";
          var returnUrl = SanitizeReturnUrl(request.ReturnUrl, fallbackUrl);

          if (user is null) {
            var loginUrl = isMls
            ? "/t/mls/"
            : $"/t/{tenantSlug}/sms/";
            return Results.LocalRedirect($"{loginUrl}?error=Invalid%20tenant%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          await SignInUserAsync(httpContext, user);
          return Results.LocalRedirect(returnUrl);
        });
    app.MapPost("/account/logout", async Task<IResult> (HttpContext httpContext, [FromForm] string? returnUrl) => {
      await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
      return Results.LocalRedirect(SanitizeReturnUrl(returnUrl, "/"));
    });


    return app;
  }
}
