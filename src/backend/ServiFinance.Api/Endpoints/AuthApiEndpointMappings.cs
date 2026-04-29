namespace ServiFinance.Api.Endpoints;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using ServiFinance.Infrastructure.Configuration;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AuthApiEndpointMappings {
  public static RouteGroupBuilder MapAuthApiEndpoints(this RouteGroupBuilder api, SessionTokenOptions sessionTokenOptions) {
    var authApi = api.MapGroup("/auth");
    authApi.MapPost("/root/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] RootApiLoginRequest request,
        IUserAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService) => {
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, AuthenticationSurface.Root),
          httpContext.RequestAborted);
          if (user is null) {
            return Results.Unauthorized();
          }

          var tokens = await sessionTokenService.CreateSessionAsync(user, AuthenticationSurface.Root, request.RememberMe, httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user, request.RememberMe);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken, request.RememberMe ? TimeSpan.FromDays(sessionTokenOptions.PersistentRefreshTokenDays) : null);
          }

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, AuthenticationSurface.Root)));
        });
    authApi.MapPost("/tenant/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] TenantApiLoginRequest request,
        IUserAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService) => {
          var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
          var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, surface, tenantSlug),
          httpContext.RequestAborted);
          if (user is null) {
            return Results.Unauthorized();
          }

          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
          }

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
        });

    authApi.MapPost("/customer/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] CustomerApiLoginRequest request,
        ICustomerAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService) => {
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          if (string.IsNullOrWhiteSpace(tenantSlug)) {
            return Results.BadRequest(new { error = "Invalid tenant domain slug" });
          }
          var user = await authenticationService.AuthenticateAsync(
              request.Email, request.Password, tenantSlug, httpContext.RequestAborted);
          if (user is null) {
            return Results.Unauthorized();
          }

          var surface = AuthenticationSurface.CustomerWeb;
          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
          }

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
        });

    authApi.MapPost("/customer/register", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] CustomerRegisterRequest request,
        ICustomerAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService) => {
          try {
            var user = await authenticationService.RegisterAsync(request, httpContext.RequestAborted);

            var surface = AuthenticationSurface.CustomerWeb;
            var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
            if (request.UseCookieSession) {
              await SignInUserAsync(httpContext, user);
              WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
            }

            return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
          }
          catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });

    authApi.MapGet("/refresh", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        ISessionTokenService sessionTokenService) =>
        await RefreshSessionAsync(httpContext, null, sessionTokenService));
    authApi.MapPost("/refresh", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] RefreshSessionRequest? request,
        ISessionTokenService sessionTokenService) =>
        await RefreshSessionAsync(httpContext, request, sessionTokenService));
    authApi.MapPost("/logout", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] RefreshSessionRequest? request,
        ISessionTokenService sessionTokenService) => {
          var refreshToken = request?.RefreshToken ?? ReadRefreshTokenCookie(httpContext);
          if (!string.IsNullOrWhiteSpace(refreshToken)) {
            await sessionTokenService.RevokeSessionAsync(refreshToken, httpContext.RequestAborted);
          }

          DeleteRefreshTokenCookie(httpContext);
          await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
          return Results.NoContent();
        });
    authApi.MapGet("/me", [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)] (ClaimsPrincipal principal) => {
      var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
      var tenantId = Guid.Parse(principal.FindFirstValue("tenant_id")!);
      var tenantDomainSlug = principal.FindFirstValue("tenant_domain_slug") ?? string.Empty;
      var fullName = principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
      var email = principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
      _ = Enum.TryParse<AuthenticationSurface>(principal.FindFirstValue("surface"), true, out var surface);
      var roles = principal.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

      return Results.Ok(new CurrentSessionUser(userId, tenantId, tenantDomainSlug, email, fullName, roles, surface));
    });

    return authApi;
  }
}
