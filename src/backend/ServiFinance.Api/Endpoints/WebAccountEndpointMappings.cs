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
        IUserAuthenticationService authenticationService,
        IAuthProtectionService authProtectionService) => {
          var captchaResult = await authProtectionService.ValidateCaptchaAsync(
              new CaptchaProof(request.CaptchaChallengeId, request.CaptchaAnswer),
              httpContext.Connection.RemoteIpAddress?.ToString(),
              httpContext.RequestAborted);
          var returnUrl = SanitizeReturnUrl(request.ReturnUrl);
          if (!captchaResult.IsAllowed) {
            return Results.LocalRedirect($"/?error={Uri.EscapeDataString(captchaResult.ErrorMessage ?? "Complete the CAPTCHA challenge.")}&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          var lockoutResult = authProtectionService.CheckLoginAllowed("root", null, request.Email, httpContext.Connection.RemoteIpAddress?.ToString());
          if (!lockoutResult.IsAllowed) {
            return Results.LocalRedirect($"/?error={Uri.EscapeDataString(lockoutResult.ErrorMessage ?? "Login is temporarily locked.")}&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(
              request.Email,
              request.Password,
              AuthenticationSurface.Root),
          httpContext.RequestAborted);

          if (user is null) {
            await authProtectionService.RecordFailedLoginAsync("root", null, request.Email, httpContext.Connection.RemoteIpAddress?.ToString(), httpContext.RequestAborted);
            return Results.LocalRedirect($"/?error=Invalid%20superadmin%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          await authProtectionService.RecordSuccessfulLoginAsync("root", null, request.Email, httpContext.Connection.RemoteIpAddress?.ToString(), httpContext.RequestAborted);
          await SignInUserAsync(httpContext, user, AuthenticationSurface.Root, request.RememberMe);

          return Results.LocalRedirect(returnUrl);
        });
    app.MapPost("/account/tenant-login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromForm] TenantLoginRequest request,
        IUserAuthenticationService authenticationService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuthProtectionService authProtectionService) => {
          var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
          var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          var fallbackUrl = isMls
          ? "/t/mls/dashboard"
          : $"/t/{tenantSlug}/sms/dashboard";
          var returnUrl = SanitizeReturnUrl(request.ReturnUrl, fallbackUrl);
          var loginUrl = isMls
          ? "/t/mls/"
          : $"/t/{tenantSlug}/sms/";
          var captchaResult = await authProtectionService.ValidateCaptchaAsync(
              new CaptchaProof(request.CaptchaChallengeId, request.CaptchaAnswer),
              httpContext.Connection.RemoteIpAddress?.ToString(),
              httpContext.RequestAborted);
          if (!captchaResult.IsAllowed) {
            return Results.LocalRedirect($"{loginUrl}?error={Uri.EscapeDataString(captchaResult.ErrorMessage ?? "Complete the CAPTCHA challenge.")}&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          var scope = surface == AuthenticationSurface.TenantDesktop ? "TenantMls" : "TenantSms";
          var lockoutResult = authProtectionService.CheckLoginAllowed(scope, tenantSlug, request.Email, httpContext.Connection.RemoteIpAddress?.ToString());
          if (!lockoutResult.IsAllowed) {
            return Results.LocalRedirect($"{loginUrl}?error={Uri.EscapeDataString(lockoutResult.ErrorMessage ?? "Login is temporarily locked.")}&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(
              request.Email,
              request.Password,
              surface,
              tenantSlug),
          httpContext.RequestAborted);

          if (user is null) {
            await authProtectionService.RecordFailedLoginAsync(scope, tenantSlug, request.Email, httpContext.Connection.RemoteIpAddress?.ToString(), httpContext.RequestAborted);
            return Results.LocalRedirect($"{loginUrl}?error=Invalid%20tenant%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
          }

          if (isMls) {
            var accessError = await GetTenantMlsAccessErrorAsync(
                user.TenantId,
                user.TenantDomainSlug,
                dbContext,
                httpContext.RequestAborted);
            if (accessError is not null) {
              return Results.LocalRedirect($"/t/mls/?error={Uri.EscapeDataString(accessError)}&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
            }
          }

          await authProtectionService.RecordSuccessfulLoginAsync(scope, tenantSlug, request.Email, httpContext.Connection.RemoteIpAddress?.ToString(), httpContext.RequestAborted);
          await SignInUserAsync(httpContext, user, surface);
          return Results.LocalRedirect(returnUrl);
        });
    app.MapPost("/account/logout", async Task<IResult> (HttpContext httpContext, [FromForm] string? returnUrl) => {
      await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
      return Results.LocalRedirect(SanitizeReturnUrl(returnUrl, "/"));
    });


    return app;
  }
}
