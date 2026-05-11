namespace ServiFinance.Api.Endpoints;

using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Notifications;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AuthApiEndpointMappings {
  public static RouteGroupBuilder MapAuthApiEndpoints(this RouteGroupBuilder api, SessionTokenOptions sessionTokenOptions) {
    var authApi = api.MapGroup("/auth");
    authApi.MapGet("/captcha", [AllowAnonymous] (
        [FromQuery] bool? local,
        IAuthProtectionService authProtectionService) =>
        Results.Ok(authProtectionService.CreateCaptchaChallenge(local == true)));
    authApi.MapPost("/root/login", [AllowAnonymous] async Task<IResult> (
        HttpContext httpContext,
        [FromBody] RootApiLoginRequest request,
        IUserAuthenticationService authenticationService,
        ISessionTokenService sessionTokenService,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuthProtectionService authProtectionService,
        IEmailSender emailSender,
        IAuditLogService auditLogService) => {
          var isMfaContinuation = HasMfaProof(request.MfaChallengeId, request.MfaCode);
          if (!isMfaContinuation) {
            var captchaResult = await authProtectionService.ValidateCaptchaAsync(
                request.Captcha,
                ResolveIpAddress(httpContext),
                httpContext.RequestAborted);
            if (!captchaResult.IsAllowed) {
              return Results.BadRequest(new { error = captchaResult.ErrorMessage });
            }

            var lockoutResult = authProtectionService.CheckLoginAllowed(
                "root",
                null,
                request.Email,
                ResolveIpAddress(httpContext));
            if (!lockoutResult.IsAllowed) {
              return CreateJsonError(
                  StatusCodes.Status429TooManyRequests,
                  lockoutResult.ErrorMessage ?? "Login is temporarily locked.",
                  lockoutResult.RetryAfterUtc);
            }
          }

          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, AuthenticationSurface.Root),
          httpContext.RequestAborted);
          if (user is null) {
            authProtectionService.RecordFailedLogin("root", null, request.Email, ResolveIpAddress(httpContext));
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

          var mfaResult = await ResolveMfaGateAsync(
              dbContext,
              httpContext,
              user,
              AuthenticationSurface.Root,
              request.MfaChallengeId,
              request.MfaCode,
              emailSender,
              auditLogService);
          if (mfaResult is not null) {
            return mfaResult;
          }

          authProtectionService.RecordSuccessfulLogin("root", null, request.Email, ResolveIpAddress(httpContext));

          var tokens = await sessionTokenService.CreateSessionAsync(user, AuthenticationSurface.Root, request.RememberMe, httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user, AuthenticationSurface.Root, request.RememberMe);
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
        IAuthProtectionService authProtectionService,
        IEmailSender emailSender,
        IAuditLogService auditLogService) => {
          var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
          var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          var isMfaContinuation = HasMfaProof(request.MfaChallengeId, request.MfaCode);
          if (!isMfaContinuation) {
            var captchaResult = await authProtectionService.ValidateCaptchaAsync(
                request.Captcha,
                ResolveIpAddress(httpContext),
                httpContext.RequestAborted);
            if (!captchaResult.IsAllowed) {
              return Results.BadRequest(new { error = captchaResult.ErrorMessage });
            }

            var lockoutResult = authProtectionService.CheckLoginAllowed(
                ResolveAuditScope(surface),
                tenantSlug,
                request.Email,
                ResolveIpAddress(httpContext));
            if (!lockoutResult.IsAllowed) {
              return CreateJsonError(
                  StatusCodes.Status429TooManyRequests,
                  lockoutResult.ErrorMessage ?? "Login is temporarily locked.",
                  lockoutResult.RetryAfterUtc);
            }
          }

          var user = await authenticationService.AuthenticateAsync(
          new AuthenticationRequest(request.Email, request.Password, surface, tenantSlug),
          httpContext.RequestAborted);
          if (user is null) {
            authProtectionService.RecordFailedLogin(ResolveAuditScope(surface), tenantSlug, request.Email, ResolveIpAddress(httpContext));
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

          var mfaResult = await ResolveMfaGateAsync(
              dbContext,
              httpContext,
              user,
              surface,
              request.MfaChallengeId,
              request.MfaCode,
              emailSender,
              auditLogService);
          if (mfaResult is not null) {
            return mfaResult;
          }

          authProtectionService.RecordSuccessfulLogin(ResolveAuditScope(surface), tenantSlug, request.Email, ResolveIpAddress(httpContext));

          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user, surface);
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
        IAuthProtectionService authProtectionService,
        IEmailSender emailSender,
        IAuditLogService auditLogService) => {
          var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
          if (string.IsNullOrWhiteSpace(tenantSlug)) {
            return Results.BadRequest(new { error = "Invalid tenant domain slug" });
          }

          var isMfaContinuation = HasMfaProof(request.MfaChallengeId, request.MfaCode);
          if (!isMfaContinuation) {
            var captchaResult = await authProtectionService.ValidateCaptchaAsync(
                request.Captcha,
                ResolveIpAddress(httpContext),
                httpContext.RequestAborted);
            if (!captchaResult.IsAllowed) {
              return Results.BadRequest(new { error = captchaResult.ErrorMessage });
            }

            var lockoutResult = authProtectionService.CheckLoginAllowed(
                "Customer",
                tenantSlug,
                request.Email,
                ResolveIpAddress(httpContext));
            if (!lockoutResult.IsAllowed) {
              return CreateJsonError(
                  StatusCodes.Status429TooManyRequests,
                  lockoutResult.ErrorMessage ?? "Login is temporarily locked.",
                  lockoutResult.RetryAfterUtc);
            }
          }

          var user = await authenticationService.AuthenticateAsync(
              request.Email, request.Password, tenantSlug, httpContext.RequestAborted);
          if (user is null) {
            authProtectionService.RecordFailedLogin("Customer", tenantSlug, request.Email, ResolveIpAddress(httpContext));
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
          var mfaResult = await ResolveMfaGateAsync(
              dbContext,
              httpContext,
              user,
              surface,
              request.MfaChallengeId,
              request.MfaCode,
              emailSender,
              auditLogService);
          if (mfaResult is not null) {
            return mfaResult;
          }

          authProtectionService.RecordSuccessfulLogin("Customer", tenantSlug, request.Email, ResolveIpAddress(httpContext));

          var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
          if (request.UseCookieSession) {
            await SignInUserAsync(httpContext, user, surface);
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
        IAuthProtectionService authProtectionService,
        IAuditLogService auditLogService) => {
          try {
            var captchaResult = await authProtectionService.ValidateCaptchaAsync(
                request.Captcha,
                ResolveIpAddress(httpContext),
                httpContext.RequestAborted);
            if (!captchaResult.IsAllowed) {
              return Results.BadRequest(new { error = captchaResult.ErrorMessage });
            }

            var user = await authenticationService.RegisterAsync(request, httpContext.RequestAborted);

            var surface = AuthenticationSurface.CustomerWeb;
            var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
            if (request.UseCookieSession) {
              await SignInUserAsync(httpContext, user, surface);
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
    authApi.MapPost("/password-reset/start", StartPasswordResetAsync).AllowAnonymous();
    authApi.MapPost("/password-reset/complete", CompletePasswordResetAsync).AllowAnonymous();
    authApi.MapGet("/me", [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)] (ClaimsPrincipal principal) => {
      var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
      var tenantId = Guid.Parse(principal.FindFirstValue("tenant_id")!);
      var tenantDomainSlug = principal.FindFirstValue("tenant_domain_slug") ?? string.Empty;
      var fullName = principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
      var email = principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
      _ = Enum.TryParse<AuthenticationSurface>(principal.FindFirstValue("surface"), true, out var surface);
      var roles = principal.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
      var platformScopes = principal.FindAll("platform_scope").Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
      var permissionKeys = principal.FindAll("permission_key").Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
      var moduleAccess = SessionModuleAccessClaims.FromClaims(principal.Claims);

      return Results.Ok(new CurrentSessionUser(userId, tenantId, tenantDomainSlug, email, fullName, roles, platformScopes, permissionKeys, moduleAccess, surface));
    });

    return authApi;
  }

  internal static async Task<bool> IsMfaEnabledAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      AuthenticationSurface surface,
      Guid userId,
      CancellationToken cancellationToken) {
    var state = await dbContext.ExternalServiceStates
        .AsNoTracking()
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthSecurityProvider &&
                entity.StateKey == BuildMfaStateKey(surface, userId),
            cancellationToken);

    if (state is null || string.IsNullOrWhiteSpace(state.PayloadJson)) {
      return false;
    }

    var payload = JsonSerializer.Deserialize<MfaRegistrationPayload>(state.PayloadJson);
    return payload?.Enabled == true;
  }

  private static async Task<IResult?> ResolveMfaGateAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      HttpContext httpContext,
      AuthenticatedUser user,
      AuthenticationSurface surface,
      string? challengeId,
      string? code,
      IEmailSender emailSender,
      IAuditLogService auditLogService) {
    if (!await IsMfaEnabledAsync(dbContext, surface, user.UserId, httpContext.RequestAborted)) {
      return null;
    }

    if (!string.IsNullOrWhiteSpace(challengeId) && !string.IsNullOrWhiteSpace(code)) {
      var challenge = await dbContext.ExternalServiceStates
          .SingleOrDefaultAsync(
              entity => entity.Provider == AuthSecurityProvider &&
                  entity.StateKey == BuildMfaChallengeKey(challengeId),
              httpContext.RequestAborted);

      if (challenge is null || challenge.ExpiresAtUtc <= DateTime.UtcNow || string.IsNullOrWhiteSpace(challenge.PayloadJson)) {
        return Results.BadRequest(new { error = "MFA challenge expired. Sign in again." });
      }

      var payload = JsonSerializer.Deserialize<MfaChallengePayload>(challenge.PayloadJson);
      if (payload is null ||
          payload.UserId != user.UserId ||
          !string.Equals(payload.Surface, surface.ToString(), StringComparison.OrdinalIgnoreCase) ||
          !string.Equals(payload.Code, code.Trim(), StringComparison.Ordinal)) {
        await WriteSecurityAuditAsync(
            auditLogService,
            httpContext,
            user.TenantId,
            ResolveAuditScope(surface),
            "MfaFailed",
            "Failed",
            surface == AuthenticationSurface.CustomerWeb ? null : user.UserId,
            user.FullName,
            user.Email,
            "MfaChallenge",
            user.UserId,
            user.Email,
            "MFA challenge code was incorrect.");
        return Results.BadRequest(new { error = "MFA code is incorrect." });
      }

      dbContext.ExternalServiceStates.Remove(challenge);
      await dbContext.SaveChangesAsync(httpContext.RequestAborted);
      return null;
    }

    var mfaCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    var mfaChallengeId = Convert.ToHexString(RandomNumberGenerator.GetBytes(18)).ToLowerInvariant();
    var expiresAtUtc = DateTime.UtcNow.AddMinutes(5);
    var googleDeliveryEmail = surface == AuthenticationSurface.CustomerWeb
        ? (await CustomerPortalApiEndpointMappings.LoadCustomerGoogleLinkAsync(dbContext, user.UserId, httpContext.RequestAborted))?.Email
        : (await LoadGoogleLinkAsync(dbContext, user.UserId, httpContext.RequestAborted))?.Email;
    if (string.IsNullOrWhiteSpace(googleDeliveryEmail)) {
      await WriteSecurityAuditAsync(
          auditLogService,
          httpContext,
          user.TenantId,
          ResolveAuditScope(surface),
          "MfaChallengeBlocked",
          "Denied",
          surface == AuthenticationSurface.CustomerWeb ? null : user.UserId,
          user.FullName,
          user.Email,
          "MfaChallenge",
          user.UserId,
          user.Email,
          "MFA challenge could not be issued because no Google account is linked.");
      return Results.BadRequest(new { error = "MFA requires a linked Google account. Contact an administrator to recover access." });
    }

    if (!emailSender.IsConfigured) {
      await WriteSecurityAuditAsync(
          auditLogService,
          httpContext,
          user.TenantId,
          ResolveAuditScope(surface),
          "MfaChallengeBlocked",
          "Failed",
          surface == AuthenticationSurface.CustomerWeb ? null : user.UserId,
          user.FullName,
          user.Email,
          "MfaChallenge",
          user.UserId,
          googleDeliveryEmail,
          "MFA challenge could not be issued because SMTP email delivery is not configured.");
      return Results.BadRequest(new { error = "MFA email delivery is not configured. Contact an administrator." });
    }

    var challengeState = new ExternalServiceState {
      Provider = AuthSecurityProvider,
      StateKey = BuildMfaChallengeKey(mfaChallengeId),
      PayloadJson = JsonSerializer.Serialize(new MfaChallengePayload(user.UserId, surface.ToString(), mfaCode, expiresAtUtc)),
      ExpiresAtUtc = expiresAtUtc,
      UpdatedAtUtc = DateTime.UtcNow
    };
    dbContext.ExternalServiceStates.Add(challengeState);
    await dbContext.SaveChangesAsync(httpContext.RequestAborted);

    var emailResult = await emailSender.SendAsync(
        CreateMfaChallengeEmail(user, surface, googleDeliveryEmail, mfaCode, expiresAtUtc),
        httpContext.RequestAborted);
    if (!emailResult.Sent) {
      dbContext.ExternalServiceStates.Remove(challengeState);
      await dbContext.SaveChangesAsync(httpContext.RequestAborted);
      await WriteSecurityAuditAsync(
          auditLogService,
          httpContext,
          user.TenantId,
          ResolveAuditScope(surface),
          "MfaChallengeBlocked",
          "Failed",
          surface == AuthenticationSurface.CustomerWeb ? null : user.UserId,
          user.FullName,
          user.Email,
          "MfaChallenge",
          user.UserId,
          googleDeliveryEmail,
          "MFA challenge email delivery failed.");
      return Results.BadRequest(new { error = "MFA code could not be sent. Try again or contact an administrator." });
    }

    await WriteSecurityAuditAsync(
        auditLogService,
        httpContext,
        user.TenantId,
        ResolveAuditScope(surface),
        "MfaChallengeIssued",
        "Pending",
        surface == AuthenticationSurface.CustomerWeb ? null : user.UserId,
        user.FullName,
        user.Email,
        "MfaChallenge",
        user.UserId,
        googleDeliveryEmail,
        "MFA challenge code was sent to the linked Google account email.");

    return Results.Json(
        new MfaChallengeResponse(
            true,
            mfaChallengeId,
            "A verification code was sent to your linked Google account email.",
            expiresAtUtc),
        statusCode: StatusCodes.Status202Accepted);
  }

  internal const string AuthSecurityProvider = "auth-security";
  private const string GoogleLinkProvider = "google-auth";

  internal static string BuildMfaStateKey(AuthenticationSurface surface, Guid userId) {
    var accountKind = surface == AuthenticationSurface.CustomerWeb ? "customer" : "user";
    return $"mfa:{accountKind}:{userId:N}";
  }

  private static string BuildMfaChallengeKey(string challengeId) =>
    $"mfa-challenge:{challengeId.Trim().ToLowerInvariant()}";

  private static bool HasMfaProof(string? challengeId, string? code) =>
    !string.IsNullOrWhiteSpace(challengeId) && !string.IsNullOrWhiteSpace(code);

  private static async Task<IResult> StartPasswordResetAsync(
      HttpContext httpContext,
      [FromBody] PasswordResetStartRequest request,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      IAuthProtectionService authProtectionService,
      IEmailSender emailSender,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var captchaResult = await authProtectionService.ValidateCaptchaAsync(
        request.Captcha,
        ResolveIpAddress(httpContext),
        httpContext.RequestAborted);
    if (!captchaResult.IsAllowed) {
      return Results.BadRequest(new { error = captchaResult.ErrorMessage });
    }

    var surface = ResolvePasswordResetSurface(request.Surface);
    var account = await ResolvePasswordResetAccountAsync(dbContext, surface, request.TenantDomainSlug, request.Email, cancellationToken);
    var resetId = Convert.ToHexString(RandomNumberGenerator.GetBytes(18)).ToLowerInvariant();
    var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    var expiresAtUtc = DateTime.UtcNow.AddMinutes(15);

    if (account is not null) {
      var googleDeliveryEmail = surface == AuthenticationSurface.CustomerWeb
          ? (await CustomerPortalApiEndpointMappings.LoadCustomerGoogleLinkAsync(dbContext, account.UserId, cancellationToken))?.Email
          : (await LoadGoogleLinkAsync(dbContext, account.UserId, cancellationToken))?.Email;
      if (string.IsNullOrWhiteSpace(googleDeliveryEmail)) {
        await WriteSecurityAuditAsync(
            auditLogService,
            httpContext,
            account.TenantId,
            ResolveAuditScope(surface),
            "PasswordResetBlocked",
            "Denied",
            surface == AuthenticationSurface.CustomerWeb ? null : account.UserId,
            account.FullName,
            account.Email,
            "Account",
            account.UserId,
            account.Email,
            "Password reset was requested but the account has no linked Google account.");

        return Results.Ok(new PasswordResetStartResponse(
            resetId,
            "If the account exists and has a linked Google account, a password reset code has been sent.",
            expiresAtUtc,
            emailSender.IsConfigured));
      }

      var resetState = new ExternalServiceState {
        Provider = AuthSecurityProvider,
        StateKey = BuildPasswordResetKey(resetId),
        PayloadJson = JsonSerializer.Serialize(new PasswordResetPayload(
            account.UserId,
            surface.ToString(),
            account.TenantId,
            account.Email,
            code,
            expiresAtUtc,
            surface == AuthenticationSurface.CustomerWeb)),
        ExpiresAtUtc = expiresAtUtc,
        UpdatedAtUtc = DateTime.UtcNow
      };
      dbContext.ExternalServiceStates.Add(resetState);
      await dbContext.SaveChangesAsync(cancellationToken);

      if (emailSender.IsConfigured) {
        var emailResult = await emailSender.SendAsync(
            CreatePasswordResetEmail(account, surface, googleDeliveryEmail, code, expiresAtUtc),
            cancellationToken);
        if (!emailResult.Sent) {
          dbContext.ExternalServiceStates.Remove(resetState);
          await dbContext.SaveChangesAsync(cancellationToken);
          await WriteSecurityAuditAsync(
              auditLogService,
              httpContext,
              account.TenantId,
              ResolveAuditScope(surface),
              "PasswordResetEmailFailed",
              "Failed",
              surface == AuthenticationSurface.CustomerWeb ? null : account.UserId,
              account.FullName,
              account.Email,
              "Account",
              account.UserId,
              googleDeliveryEmail,
              "Password reset code could not be sent to the linked Google account email.");
          return Results.Ok(new PasswordResetStartResponse(
              resetId,
              "If the account exists and has a linked Google account, a password reset code has been sent.",
              expiresAtUtc,
              true));
        }
      }

      await WriteSecurityAuditAsync(
          auditLogService,
          httpContext,
          account.TenantId,
          ResolveAuditScope(surface),
          "PasswordResetRequested",
          "Pending",
          surface == AuthenticationSurface.CustomerWeb ? null : account.UserId,
          account.FullName,
          account.Email,
          "Account",
          account.UserId,
          googleDeliveryEmail,
          emailSender.IsConfigured
              ? "Password reset code was generated and sent to the linked Google account email."
              : "Password reset code was generated for a Google-linked account without SMTP delivery configured.");
    }

    return Results.Ok(new PasswordResetStartResponse(
        resetId,
        emailSender.IsConfigured
            ? "If the account exists and has a linked Google account, a password reset code has been sent."
            : "If the account exists and has a linked Google account, a password reset code has been prepared.",
        expiresAtUtc,
        emailSender.IsConfigured,
        account is not null && !emailSender.IsConfigured ? code : null));
  }

  private static async Task<IResult> CompletePasswordResetAsync(
      HttpContext httpContext,
      [FromBody] PasswordResetCompleteRequest request,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      IPasswordHasher<AppUser> userPasswordHasher,
      IPasswordHasher<Customer> customerPasswordHasher,
      IPasswordPolicyService passwordPolicyService,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var resetState = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthSecurityProvider &&
                entity.StateKey == BuildPasswordResetKey(request.ResetId),
            cancellationToken);

    if (resetState is null || resetState.ExpiresAtUtc <= DateTime.UtcNow || string.IsNullOrWhiteSpace(resetState.PayloadJson)) {
      return Results.BadRequest(new { error = "Password reset code expired. Start again." });
    }

    var payload = JsonSerializer.Deserialize<PasswordResetPayload>(resetState.PayloadJson);
    if (payload is null || !string.Equals(payload.Code, request.Code.Trim(), StringComparison.Ordinal)) {
      return Results.BadRequest(new { error = "Password reset code is incorrect." });
    }

    if (payload.IsCustomer) {
      var customer = await dbContext.Customers
          .IgnoreQueryFilters()
          .SingleOrDefaultAsync(entity => entity.Id == payload.UserId, cancellationToken);
      if (customer is null) {
        return Results.BadRequest(new { error = "Account could not be reset." });
      }

      var passwordPolicy = passwordPolicyService.Validate(
          request.NewPassword,
          new PasswordPolicyContext(customer.Email, customer.FullName));
      if (!passwordPolicy.IsValid) {
        return Results.BadRequest(new { error = string.Join(" ", passwordPolicy.Errors) });
      }

      customer.PasswordHash = customerPasswordHasher.HashPassword(customer, request.NewPassword);
    } else {
      var user = await dbContext.Users
          .IgnoreQueryFilters()
          .SingleOrDefaultAsync(entity => entity.Id == payload.UserId, cancellationToken);
      if (user is null) {
        return Results.BadRequest(new { error = "Account could not be reset." });
      }

      var passwordPolicy = passwordPolicyService.Validate(
          request.NewPassword,
          new PasswordPolicyContext(user.Email, user.FullName));
      if (!passwordPolicy.IsValid) {
        return Results.BadRequest(new { error = string.Join(" ", passwordPolicy.Errors) });
      }

      user.PasswordHash = userPasswordHasher.HashPassword(user, request.NewPassword);
    }

    dbContext.ExternalServiceStates.Remove(resetState);
    await dbContext.SaveChangesAsync(cancellationToken);
    await WriteSecurityAuditAsync(
        auditLogService,
        httpContext,
        payload.TenantId,
        ResolveAuditScope(Enum.Parse<AuthenticationSurface>(payload.Surface)),
        "PasswordReset",
        "Success",
        payload.IsCustomer ? null : payload.UserId,
        null,
        payload.Email,
        "Account",
        payload.UserId,
        payload.Email,
        "Password was reset with a reset code.");

    return Results.Ok(new PasswordResetCompleteResponse("Password reset successfully."));
  }

  private sealed record MfaRegistrationPayload(bool Enabled, DateTime EnabledAtUtc);
  private sealed record MfaChallengePayload(Guid UserId, string Surface, string Code, DateTime ExpiresAtUtc);
  private sealed record PasswordResetPayload(
      Guid UserId,
      string Surface,
      Guid TenantId,
      string Email,
      string Code,
      DateTime ExpiresAtUtc,
      bool IsCustomer);
  private sealed record PasswordResetAccount(Guid UserId, Guid TenantId, string Email, string FullName);
  private sealed record GoogleAccountLinkPayload(
      Guid UserId,
      string Subject,
      string Email,
      string? Name,
      DateTime LinkedAtUtc);

  private static EmailMessage CreatePasswordResetEmail(
      PasswordResetAccount account,
      AuthenticationSurface surface,
      string deliveryEmail,
      string code,
      DateTime expiresAtUtc) {
    var scopeLabel = ResolveAuditScope(surface);
    var expiresLabel = expiresAtUtc.ToString("yyyy-MM-dd HH:mm 'UTC'");
    var textBody = $"""
        ServiFinance password reset

        Use this verification code to reset your {scopeLabel} password:

        {code}

        This code was sent to the Google account linked to {account.Email}. It expires at {expiresLabel}. If you did not request this password reset, ignore this email.
        """;
    var htmlBody = $"""
        <p>Use this verification code to reset your <strong>{System.Net.WebUtility.HtmlEncode(scopeLabel)}</strong> password:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:0.18em;">{System.Net.WebUtility.HtmlEncode(code)}</p>
        <p>This code was sent to the Google account linked to {System.Net.WebUtility.HtmlEncode(account.Email)}. It expires at {System.Net.WebUtility.HtmlEncode(expiresLabel)}.</p>
        <p>If you did not request this password reset, ignore this email.</p>
        """;

    return new EmailMessage(
        deliveryEmail,
        "ServiFinance password reset code",
        textBody,
        htmlBody);
  }

  private static EmailMessage CreateMfaChallengeEmail(
      AuthenticatedUser user,
      AuthenticationSurface surface,
      string deliveryEmail,
      string code,
      DateTime expiresAtUtc) {
    var scopeLabel = ResolveAuditScope(surface);
    var expiresLabel = expiresAtUtc.ToString("yyyy-MM-dd HH:mm 'UTC'");
    var textBody = $"""
        ServiFinance sign-in verification

        Use this verification code to finish signing in to {scopeLabel}:

        {code}

        This code was sent to the Google account linked to {user.Email}. It expires at {expiresLabel}. If you did not try to sign in, change your password or contact an administrator.
        """;
    var htmlBody = $"""
        <p>Use this verification code to finish signing in to <strong>{System.Net.WebUtility.HtmlEncode(scopeLabel)}</strong>:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:0.18em;">{System.Net.WebUtility.HtmlEncode(code)}</p>
        <p>This code was sent to the Google account linked to {System.Net.WebUtility.HtmlEncode(user.Email)}. It expires at {System.Net.WebUtility.HtmlEncode(expiresLabel)}.</p>
        <p>If you did not try to sign in, change your password or contact an administrator.</p>
        """;

    return new EmailMessage(
        deliveryEmail,
        "ServiFinance sign-in verification code",
        textBody,
        htmlBody);
  }

  private static async Task<GoogleAccountLinkPayload?> LoadGoogleLinkAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid userId,
      CancellationToken cancellationToken) {
    var state = await dbContext.ExternalServiceStates
        .AsNoTracking()
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildGoogleUserStateKey(userId),
            cancellationToken);

    return DeserializeGoogleLink(state?.PayloadJson);
  }

  private static GoogleAccountLinkPayload? DeserializeGoogleLink(string? payloadJson) {
    if (string.IsNullOrWhiteSpace(payloadJson)) {
      return null;
    }

    try {
      return JsonSerializer.Deserialize<GoogleAccountLinkPayload>(payloadJson);
    } catch (JsonException) {
      return null;
    }
  }

  private static string BuildGoogleUserStateKey(Guid userId) =>
    $"google-link:user:{userId:N}";

  private static string BuildPasswordResetKey(string resetId) =>
    $"password-reset:{resetId.Trim().ToLowerInvariant()}";

  private static AuthenticationSurface ResolvePasswordResetSurface(string surface) =>
    surface.Trim().ToLowerInvariant() switch {
      "root" or "superadmin" => AuthenticationSurface.Root,
      "mls" or "tenantdesktop" or "tenant-desktop" => AuthenticationSurface.TenantDesktop,
      "customer" or "customerweb" or "customer-web" => AuthenticationSurface.CustomerWeb,
      _ => AuthenticationSurface.TenantWeb
    };

  private static async Task<PasswordResetAccount?> ResolvePasswordResetAccountAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      AuthenticationSurface surface,
      string? tenantDomainSlug,
      string email,
      CancellationToken cancellationToken) {
    var normalizedEmail = email.Trim();
    var normalizedEmailUpper = normalizedEmail.ToUpperInvariant();
    var normalizedTenantSlug = NormalizeTenantSlug(tenantDomainSlug);

    if (surface == AuthenticationSurface.CustomerWeb) {
      if (string.IsNullOrWhiteSpace(normalizedTenantSlug)) {
        return null;
      }

      var customer = await dbContext.Customers
          .IgnoreQueryFilters()
          .AsNoTracking()
          .Include(entity => entity.Tenant)
          .Where(entity =>
              entity.Email.ToUpper() == normalizedEmailUpper &&
              entity.Tenant != null &&
              entity.Tenant.DomainSlug == normalizedTenantSlug &&
              entity.Tenant.IsActive)
          .Select(entity => new PasswordResetAccount(entity.Id, entity.TenantId, entity.Email, entity.FullName))
          .FirstOrDefaultAsync(cancellationToken);

      return customer;
    }

    var query = dbContext.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Include(entity => entity.Tenant)
        .Where(entity => entity.Email.ToUpper() == normalizedEmailUpper && entity.IsActive);

    query = surface switch {
      AuthenticationSurface.Root =>
        query.Where(entity => entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId),
      AuthenticationSurface.TenantWeb when !string.IsNullOrWhiteSpace(normalizedTenantSlug) =>
        query.Where(entity =>
            entity.Tenant != null &&
            entity.Tenant.DomainSlug == normalizedTenantSlug &&
            entity.Tenant.IsActive),
      AuthenticationSurface.TenantDesktop =>
        query.Where(entity => entity.TenantId != ServiFinanceDatabaseDefaults.PlatformTenantId),
      _ => query.Where(_ => false)
    };

    return await query
        .Select(entity => new PasswordResetAccount(entity.Id, entity.TenantId, entity.Email, entity.FullName))
        .FirstOrDefaultAsync(cancellationToken);
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
    var platformScopes = httpContext.User.FindAll("platform_scope")
        .Select(claim => claim.Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var permissionKeys = httpContext.User.FindAll("permission_key")
        .Select(claim => claim.Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var moduleAccess = SessionModuleAccessClaims.FromClaims(httpContext.User.Claims);

    return new CurrentSessionUser(
        userId,
        tenantId,
        httpContext.User.FindFirstValue("tenant_domain_slug") ?? string.Empty,
        httpContext.User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
        httpContext.User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
        roles,
        platformScopes,
        permissionKeys,
        moduleAccess,
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

  private static string? ResolveIpAddress(HttpContext httpContext) =>
    httpContext.Connection.RemoteIpAddress?.ToString();
}
