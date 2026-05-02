namespace ServiFinance.Api.Endpoints;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
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
        ISessionTokenService sessionTokenService,
        IAuditLogService auditLogService) => {
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, AuthenticationSurface.Root),
          httpContext.RequestAborted);
          if (user is null) {
            await WriteSecurityAuditAsync(
                auditLogService,
                httpContext,
                ServiFinanceDatabaseDefaults.PlatformTenantId,
                "Superadmin",
                "LoginFailed",
                "Failed",
                null,
                null,
                request.Email,
                "RootSession",
                null,
                request.Email,
                "Failed superadmin login attempt.");
            return Results.Unauthorized();
          }

          var tokens = await sessionTokenService.CreateSessionAsync(user, AuthenticationSurface.Root, request.RememberMe, httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user, request.RememberMe);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken, request.RememberMe ? TimeSpan.FromDays(sessionTokenOptions.PersistentRefreshTokenDays) : null);
          }

          await WriteSecurityAuditAsync(
              auditLogService,
              httpContext,
              user.TenantId,
              "Superadmin",
              "LoginSuccess",
              "Success",
              user.UserId,
              user.FullName,
              user.Email,
              "RootSession",
              user.UserId,
              user.Email,
              "Superadmin signed in.");

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, AuthenticationSurface.Root)));
        });
    authApi.MapPost("/tenant/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] TenantApiLoginRequest request,
        IUserAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService) => {
          var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
          var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, surface, tenantSlug),
          httpContext.RequestAborted);
          if (user is null) {
            await WriteSecurityAuditAsync(
                auditLogService,
                httpContext,
                await ResolveAuditTenantIdAsync(dbContext, tenantSlug, httpContext.RequestAborted),
                ResolveAuditScope(surface),
                "LoginFailed",
                "Failed",
                null,
                null,
                request.Email,
                "TenantSession",
                null,
                tenantSlug ?? request.Email,
                "Failed tenant login attempt.");
            return Results.Unauthorized();
          }

          if (isMls) {
            var accessError = await GetTenantMlsAccessErrorAsync(
                user.TenantId,
                user.TenantDomainSlug,
                dbContext,
                httpContext.RequestAborted);
            if (accessError is not null) {
              await WriteSecurityAuditAsync(
                  auditLogService,
                  httpContext,
                  user.TenantId,
                  ResolveAuditScope(surface),
                  "LoginDenied",
                  "Denied",
                  user.UserId,
                  user.FullName,
                  user.Email,
                  "TenantSession",
                  user.UserId,
                  user.Email,
                  accessError);
              return CreateJsonError(StatusCodes.Status403Forbidden, accessError);
            }
          }

          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
          }

          await WriteSecurityAuditAsync(
              auditLogService,
              httpContext,
              user.TenantId,
              ResolveAuditScope(surface),
              "LoginSuccess",
              "Success",
              user.UserId,
              user.FullName,
              user.Email,
              "TenantSession",
              user.UserId,
              user.Email,
              $"{surface} user signed in.");

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
        });

    authApi.MapPost("/customer/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] CustomerApiLoginRequest request,
        ICustomerAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService) => {
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          if (string.IsNullOrWhiteSpace(tenantSlug)) {
            return Results.BadRequest(new { error = "Invalid tenant domain slug" });
          }
          var user = await authenticationService.AuthenticateAsync(
              request.Email, request.Password, tenantSlug, httpContext.RequestAborted);
          if (user is null) {
            await WriteSecurityAuditAsync(
                auditLogService,
                httpContext,
                await ResolveAuditTenantIdAsync(dbContext, tenantSlug, httpContext.RequestAborted),
                "Customer",
                "LoginFailed",
                "Failed",
                null,
                null,
                request.Email,
                "CustomerSession",
                null,
                tenantSlug,
                "Failed customer login attempt.");
            return Results.Unauthorized();
          }

          var surface = AuthenticationSurface.CustomerWeb;
          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user);
            WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
          }

          await WriteSecurityAuditAsync(
              auditLogService,
              httpContext,
              user.TenantId,
              "Customer",
              "LoginSuccess",
              "Success",
              null,
              user.FullName,
              user.Email,
              "CustomerSession",
              user.UserId,
              user.Email,
              "Customer signed in.");

          return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
        });

    authApi.MapPost("/customer/register", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] CustomerRegisterRequest request,
        ICustomerAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService) => {
          try {
            var user = await authenticationService.RegisterAsync(request, httpContext.RequestAborted);

            var surface = AuthenticationSurface.CustomerWeb;
            var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
            if (request.UseCookieSession) {
              await SignInUserAsync(httpContext, user);
              WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
            }

            await WriteSecurityAuditAsync(
                auditLogService,
                httpContext,
                user.TenantId,
                "Customer",
                "CustomerRegistration",
                "Success",
                null,
                user.FullName,
                user.Email,
                "CustomerAccount",
                user.UserId,
                user.Email,
                "Customer account registered.");

            return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
          }
          catch (InvalidOperationException ex) {
            await WriteSecurityAuditAsync(
                auditLogService,
                httpContext,
                await ResolveAuditTenantIdAsync(dbContext, NormalizeTenantSlug(request.TenantDomainSlug), httpContext.RequestAborted),
                "Customer",
                "CustomerRegistration",
                "Failed",
                null,
                request.FullName,
                request.Email,
                "CustomerAccount",
                null,
                request.Email,
                ex.Message);
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
        ISessionTokenService sessionTokenService,
        IAuditLogService auditLogService) => {
          var refreshToken = request?.RefreshToken ?? ReadRefreshTokenCookie(httpContext);
          if (!string.IsNullOrWhiteSpace(refreshToken)) {
            await sessionTokenService.RevokeSessionAsync(refreshToken, httpContext.RequestAborted);
          }

          await WriteLogoutAuditAsync(auditLogService, sessionTokenService, httpContext);
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

  private static async Task<Guid> ResolveAuditTenantIdAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      string? tenantSlug,
      CancellationToken cancellationToken) {
    if (string.IsNullOrWhiteSpace(tenantSlug)) {
      return ServiFinanceDatabaseDefaults.PlatformTenantId;
    }

    var tenantId = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.DomainSlug == tenantSlug)
        .Select(entity => entity.Id)
        .FirstOrDefaultAsync(cancellationToken);

    return tenantId != Guid.Empty
      ? tenantId
      : ServiFinanceDatabaseDefaults.PlatformTenantId;
  }

  private static async Task WriteLogoutAuditAsync(
      IAuditLogService auditLogService,
      ISessionTokenService sessionTokenService,
      HttpContext httpContext) {
    var currentUser = ResolveLogoutUser(httpContext, sessionTokenService);
    if (currentUser is null) {
      return;
    }

    Guid? actorUserId = currentUser.Surface == AuthenticationSurface.CustomerWeb ? null : currentUser.UserId;
    await WriteSecurityAuditAsync(
        auditLogService,
        httpContext,
        currentUser.TenantId,
        ResolveAuditScope(currentUser.Surface),
        "Logout",
        "Success",
        actorUserId,
        currentUser.FullName,
        currentUser.Email,
        "Session",
        currentUser.UserId,
        currentUser.Email,
        "User signed out.");
  }

  private static CurrentSessionUser? ResolveLogoutUser(HttpContext httpContext, ISessionTokenService sessionTokenService) {
    var authorization = httpContext.Request.Headers.Authorization.ToString();
    if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) {
      var token = authorization["Bearer ".Length..].Trim();
      var tokenUser = sessionTokenService.ReadAccessToken(token);
      if (tokenUser is not null) {
        return tokenUser;
      }
    }

    if (!Guid.TryParse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
        !Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return null;
    }

    _ = Enum.TryParse<AuthenticationSurface>(httpContext.User.FindFirstValue("surface"), true, out var surface);
    var roles = httpContext.User.FindAll(ClaimTypes.Role)
        .Select(claim => claim.Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    return new CurrentSessionUser(
        userId,
        tenantId,
        httpContext.User.FindFirstValue("tenant_domain_slug") ?? string.Empty,
        httpContext.User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
        httpContext.User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
        roles,
        surface);
  }

  private static Task WriteSecurityAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      Guid tenantId,
      string scope,
      string actionType,
      string outcome,
      Guid? actorUserId,
      string? actorName,
      string? actorEmail,
      string subjectType,
      Guid? subjectId,
      string? subjectLabel,
      string detail) =>
    auditLogService.WriteAsync(
        new AuditLogEntry(
            tenantId,
            scope,
            "Security",
            actionType,
            outcome,
            actorUserId,
            actorName,
            actorEmail,
            subjectType,
            subjectId,
            subjectLabel,
            detail,
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.Request.Headers.UserAgent.ToString()),
        httpContext.RequestAborted);

  private static string ResolveAuditScope(AuthenticationSurface surface) =>
    surface switch {
      AuthenticationSurface.Root => "Superadmin",
      AuthenticationSurface.TenantDesktop => "TenantMls",
      AuthenticationSurface.CustomerWeb => "Customer",
      _ => "TenantSms"
    };
}
