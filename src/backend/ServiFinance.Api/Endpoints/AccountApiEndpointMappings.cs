namespace ServiFinance.Api.Endpoints;

using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Notifications;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AccountApiEndpointMappings {
  private const string ScopeSuperadmin = "Superadmin";
  private const string ScopeTenantSms = "TenantSms";
  private const string ScopeTenantMls = "TenantMls";
  private const string CategorySystem = "System";
  private const string CategorySecurity = "Security";
  private const string GoogleExternalScheme = "GoogleExternal";
  private const string GoogleLinkProvider = "google-auth";

  public static RouteGroupBuilder MapAccountApiEndpoints(this RouteGroupBuilder api) {
    var accountApi = api.MapGroup("/account").RequireAuthorization(new AuthorizeAttribute {
      AuthenticationSchemes = ApiAuthenticationSchemes
    });

    accountApi.MapGet("/profile", GetProfileAsync);
    accountApi.MapPut("/profile", UpdateProfileAsync);
    accountApi.MapPost("/password", ChangePasswordAsync);
    accountApi.MapGet("/security", GetSecurityAsync);
    accountApi.MapPost("/mfa/enable", EnableMfaAsync);
    accountApi.MapPost("/mfa/disable", DisableMfaAsync);
    accountApi.MapGet("/google/link", StartGoogleLinkAsync);
    accountApi.MapGet("/google/callback", CompleteGoogleLinkAsync).AllowAnonymous();
    accountApi.MapPost("/google/unlink", UnlinkGoogleAsync);
    accountApi.MapGet("/audits", GetAuditsAsync);

    return api;
  }

  private static async Task<IResult> GetProfileAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    return Results.Ok(ToProfileResponse(user, httpContext));
  }

  private static async Task<IResult> UpdateProfileAsync(
      HttpContext httpContext,
      [FromBody] UpdateAccountProfileRequest request,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var normalizedFullName = request.FullName?.Trim();
    if (string.IsNullOrWhiteSpace(normalizedFullName)) {
      return Results.BadRequest(new { error = "Full name is required." });
    }

    if (normalizedFullName.Length > 200) {
      return Results.BadRequest(new { error = "Full name must be 200 characters or fewer." });
    }

    var previousFullName = user.FullName;
    user.FullName = normalizedFullName;

    await auditLogService.WriteAsync(
      new AuditLogEntry(
        user.TenantId,
        ResolveAuditScope(httpContext),
        CategorySecurity,
        "ProfileUpdated",
        "Success",
        user.Id,
        user.FullName,
        user.Email,
        "AppUser",
        user.Id,
        user.Email,
        $"Profile name changed from '{previousFullName}' to '{user.FullName}'.",
        ResolveIpAddress(httpContext),
        ResolveUserAgent(httpContext)),
      cancellationToken);

    return Results.Ok(ToProfileResponse(user, httpContext));
  }

  private static async Task<IResult> ChangePasswordAsync(
      HttpContext httpContext,
      [FromBody] ChangeAccountPasswordRequest request,
      ServiFinanceDbContext dbContext,
      IPasswordHasher<AppUser> passwordHasher,
      IPasswordPolicyService passwordPolicyService,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(request.CurrentPassword)) {
      return Results.BadRequest(new { error = "Current password is required." });
    }

    if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8) {
      return Results.BadRequest(new { error = "New password must be at least 8 characters." });
    }

    if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal)) {
      return Results.BadRequest(new { error = "New password confirmation does not match." });
    }

    if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal)) {
      return Results.BadRequest(new { error = "New password must be different from the current password." });
    }

    var passwordPolicy = passwordPolicyService.Validate(
      request.NewPassword,
      new PasswordPolicyContext(user.Email, user.FullName));
    if (!passwordPolicy.IsValid) {
      return Results.BadRequest(new { error = string.Join(" ", passwordPolicy.Errors) });
    }

    var verificationResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
    if (verificationResult == PasswordVerificationResult.Failed) {
      await WritePasswordAuditAsync(
        auditLogService,
        httpContext,
        user,
        "Failed",
        "Password change failed because the current password was incorrect.",
        cancellationToken);

      return Results.BadRequest(new { error = "Current password is incorrect." });
    }

    user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
    await WritePasswordAuditAsync(
      auditLogService,
      httpContext,
      user,
      "Success",
      "Password changed from the authenticated account profile modal.",
      cancellationToken);

    return Results.Ok(new AccountPasswordChangeResponse("Password updated successfully."));
  }

  private static async Task<IResult> GetAuditsAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var currentEmail = user.Email.Trim();
    var events = await dbContext.AuditEvents
        .AsNoTracking()
        .Where(entity =>
            entity.TenantId == user.TenantId &&
            (entity.ActorUserId == user.Id ||
             entity.SubjectId == user.Id ||
             entity.ActorEmail == currentEmail ||
             entity.SubjectLabel == currentEmail))
        .OrderByDescending(entity => entity.OccurredAtUtc)
        .Take(150)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.OccurredAtUtc,
            entity.Scope,
            entity.Category,
            entity.ActionType,
            entity.Outcome,
            entity.ActorName,
            entity.ActorEmail,
            entity.SubjectType,
            entity.SubjectLabel,
            entity.Detail,
            entity.IpAddress))
        .ToListAsync(cancellationToken);

    return Results.Ok(CreateAuditWorkspace(events));
  }

  private static async Task<IResult> GetSecurityAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    return Results.Ok(await CreateSecurityResponseAsync(httpContext, dbContext, schemeProvider, user, cancellationToken));
  }

  private static async Task<IResult> EnableMfaAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      IEmailSender emailSender,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var surface = ResolveAuthenticationSurface(httpContext);
    var googleLink = await LoadGoogleLinkAsync(dbContext, user.Id, cancellationToken);
    if (googleLink is null || string.IsNullOrWhiteSpace(googleLink.Email)) {
      return Results.BadRequest(new { error = "Link a Google account before enabling MFA. Sign-in codes are sent to the linked Google email." });
    }

    if (!emailSender.IsConfigured) {
      return Results.BadRequest(new { error = "SMTP email delivery must be configured before enabling MFA." });
    }

    var stateKey = AuthApiEndpointMappings.BuildMfaStateKey(surface, user.Id);
    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthApiEndpointMappings.AuthSecurityProvider &&
                entity.StateKey == stateKey,
            cancellationToken);

    if (state is null) {
      state = new ExternalServiceState {
        Provider = AuthApiEndpointMappings.AuthSecurityProvider,
        StateKey = stateKey
      };
      dbContext.ExternalServiceStates.Add(state);
    }

    state.PayloadJson = JsonSerializer.Serialize(new MfaRegistrationPayload(true, DateTime.UtcNow));
    state.ExpiresAtUtc = null;
    state.UpdatedAtUtc = DateTime.UtcNow;
    await dbContext.SaveChangesAsync(cancellationToken);

    await WritePasswordAuditAsync(
      auditLogService,
      httpContext,
      user,
      "Success",
      "MFA was enabled for the account.",
      cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(httpContext, dbContext, schemeProvider, user, cancellationToken));
  }

  private static async Task<IResult> DisableMfaAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var surface = ResolveAuthenticationSurface(httpContext);
    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthApiEndpointMappings.AuthSecurityProvider &&
                entity.StateKey == AuthApiEndpointMappings.BuildMfaStateKey(surface, user.Id),
            cancellationToken);

    if (state is not null) {
      dbContext.ExternalServiceStates.Remove(state);
      await dbContext.SaveChangesAsync(cancellationToken);
    }

    await WritePasswordAuditAsync(
      auditLogService,
      httpContext,
      user,
      "Success",
      "MFA was disabled for the account.",
      cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(httpContext, dbContext, schemeProvider, user, cancellationToken));
  }

  private static async Task<IResult> StartGoogleLinkAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      CancellationToken cancellationToken) {
    if (!await IsGoogleConfiguredAsync(schemeProvider)) {
      return Results.BadRequest(new { error = "Google authentication is not configured on the API host." });
    }

    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var returnUrl = SanitizeReturnUrl(httpContext.Request.Query["returnUrl"].ToString(), "/dashboard");
    var properties = new AuthenticationProperties {
      RedirectUri = "/api/account/google/callback"
    };
    properties.Items["userId"] = user.Id.ToString("N");
    properties.Items["surface"] = ResolveAuthenticationSurface(httpContext).ToString();
    properties.Items["returnUrl"] = returnUrl;

    return Results.Challenge(properties, [GoogleDefaults.AuthenticationScheme]);
  }

  private static async Task<IResult> CompleteGoogleLinkAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var result = await httpContext.AuthenticateAsync(GoogleExternalScheme);
    var returnUrl = SanitizeReturnUrl(GetAuthenticationProperty(result.Properties, "returnUrl"), "/dashboard");
    if (!result.Succeeded || result.Principal is null || result.Properties is null) {
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "failed"));
    }

    if (!Guid.TryParse(GetAuthenticationProperty(result.Properties, "userId"), out var userId)) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "failed"));
    }

    var googleSubject = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier)?.Trim();
    var googleEmail = result.Principal.FindFirstValue(ClaimTypes.Email)?.Trim();
    var googleName = result.Principal.FindFirstValue(ClaimTypes.Name)?.Trim();
    if (string.IsNullOrWhiteSpace(googleSubject) || string.IsNullOrWhiteSpace(googleEmail)) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "missing-profile"));
    }

    var user = await dbContext.Users
        .Include(entity => entity.Tenant)
        .SingleOrDefaultAsync(entity => entity.Id == userId, cancellationToken);
    if (user is null) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "missing-user"));
    }

    var existingSubjectState = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildGoogleSubjectStateKey(googleSubject),
            cancellationToken);
    var existingSubjectPayload = DeserializeGoogleLink(existingSubjectState?.PayloadJson);
    if (existingSubjectPayload is not null && existingSubjectPayload.UserId != user.Id) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "already-linked"));
    }

    var userState = await GetOrCreateExternalStateAsync(dbContext, BuildGoogleUserStateKey(user.Id), cancellationToken);
    var oldUserPayload = DeserializeGoogleLink(userState.PayloadJson);
    if (oldUserPayload is not null && !string.Equals(oldUserPayload.Subject, googleSubject, StringComparison.Ordinal)) {
      var oldSubjectState = await dbContext.ExternalServiceStates
          .SingleOrDefaultAsync(
              entity => entity.Provider == GoogleLinkProvider &&
                  entity.StateKey == BuildGoogleSubjectStateKey(oldUserPayload.Subject),
              cancellationToken);
      if (oldSubjectState is not null) {
        dbContext.ExternalServiceStates.Remove(oldSubjectState);
      }
    }

    var subjectState = existingSubjectState ?? await GetOrCreateExternalStateAsync(dbContext, BuildGoogleSubjectStateKey(googleSubject), cancellationToken);
    var payload = new GoogleAccountLinkPayload(user.Id, googleSubject, googleEmail, googleName, DateTime.UtcNow);
    userState.PayloadJson = JsonSerializer.Serialize(payload);
    userState.ExpiresAtUtc = null;
    userState.UpdatedAtUtc = DateTime.UtcNow;
    subjectState.PayloadJson = JsonSerializer.Serialize(payload);
    subjectState.ExpiresAtUtc = null;
    subjectState.UpdatedAtUtc = DateTime.UtcNow;

    await dbContext.SaveChangesAsync(cancellationToken);
    await httpContext.SignOutAsync(GoogleExternalScheme);
    await WriteSecurityAuditAsync(
        auditLogService,
        httpContext,
        user,
        "GoogleLinked",
        "Success",
        $"Google account {googleEmail} was linked.",
        cancellationToken);

    return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "linked"));
  }

  private static async Task<IResult> UnlinkGoogleAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      IAuthenticationSchemeProvider schemeProvider,
      CancellationToken cancellationToken) {
    var user = await LoadCurrentUserAsync(httpContext, dbContext, cancellationToken);
    if (user is null) {
      return Results.Unauthorized();
    }

    var surface = ResolveAuthenticationSurface(httpContext);
    if (await AuthApiEndpointMappings.IsMfaEnabledAsync(dbContext, surface, user.Id, cancellationToken)) {
      return Results.BadRequest(new { error = "Disable MFA before unlinking Google. MFA codes are sent to the linked Google email." });
    }

    var userState = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildGoogleUserStateKey(user.Id),
            cancellationToken);
    var payload = DeserializeGoogleLink(userState?.PayloadJson);
    if (userState is not null) {
      dbContext.ExternalServiceStates.Remove(userState);
    }

    if (payload is not null) {
      var subjectState = await dbContext.ExternalServiceStates
          .SingleOrDefaultAsync(
              entity => entity.Provider == GoogleLinkProvider &&
                  entity.StateKey == BuildGoogleSubjectStateKey(payload.Subject),
              cancellationToken);
      if (subjectState is not null) {
        dbContext.ExternalServiceStates.Remove(subjectState);
      }
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    await WriteSecurityAuditAsync(
        auditLogService,
        httpContext,
        user,
        "GoogleUnlinked",
        "Success",
        "Google account link was removed.",
        cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(httpContext, dbContext, schemeProvider, user, cancellationToken));
  }

  private static async Task<AppUser?> LoadCurrentUserAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return null;
    }

    return await dbContext.Users
        .Include(entity => entity.Tenant)
        .Include(entity => entity.UserRoles)
            .ThenInclude(entity => entity.Role)
        .SingleOrDefaultAsync(entity => entity.Id == userId, cancellationToken);
  }

  private static AccountProfileResponse ToProfileResponse(AppUser user, HttpContext httpContext) {
    var roles = user.UserRoles
        .Select(entity => entity.Role)
        .Where(role => role is not null)
        .Select(role => role!.Name)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(role => role)
        .ToArray();
    var platformScopes = user.UserRoles
        .Select(entity => entity.Role)
        .Where(role => role is not null)
        .Select(role => role!.PlatformScope)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(scope => scope)
        .ToArray();

    return new AccountProfileResponse(
      user.Id,
      user.TenantId,
      user.Tenant?.DomainSlug ?? httpContext.User.FindFirstValue("tenant_domain_slug") ?? string.Empty,
      user.Email,
      user.FullName,
      roles,
      platformScopes,
      httpContext.User.FindFirstValue("surface") ?? AuthenticationSurface.Root.ToString(),
      user.CreatedAtUtc,
      user.IsActive);
  }

  private static AuditWorkspaceResponse CreateAuditWorkspace(IReadOnlyList<AuditEventRowResponse> events) =>
    new(
      new AuditSummaryResponse(
        events.Count,
        events.Count(entity => entity.Category == CategorySystem),
        events.Count(entity => entity.Category == CategorySecurity),
        events.Count(entity =>
          entity.Outcome.Contains("Fail", StringComparison.OrdinalIgnoreCase) ||
          entity.Outcome.Contains("Denied", StringComparison.OrdinalIgnoreCase))),
      events);

  private static async Task<bool> IsGoogleConfiguredAsync(IAuthenticationSchemeProvider schemeProvider) =>
    await schemeProvider.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is not null;

  private static async Task<object> CreateSecurityResponseAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      AppUser user,
      CancellationToken cancellationToken) {
    var surface = ResolveAuthenticationSurface(httpContext);
    var mfaEnabled = await AuthApiEndpointMappings.IsMfaEnabledAsync(
        dbContext,
        surface,
        user.Id,
        cancellationToken);
    var googleLink = await LoadGoogleLinkAsync(dbContext, user.Id, cancellationToken);

    return new {
      mfaEnabled,
      surface = surface.ToString(),
      googleConfigured = await IsGoogleConfiguredAsync(schemeProvider),
      googleLinked = googleLink is not null,
      googleEmail = googleLink?.Email,
      googleName = googleLink?.Name,
      googleLinkedAtUtc = googleLink?.LinkedAtUtc
    };
  }

  private static async Task<GoogleAccountLinkPayload?> LoadGoogleLinkAsync(
      ServiFinanceDbContext dbContext,
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

  private static async Task<ExternalServiceState> GetOrCreateExternalStateAsync(
      ServiFinanceDbContext dbContext,
      string stateKey,
      CancellationToken cancellationToken) {
    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == stateKey,
            cancellationToken);

    if (state is not null) {
      return state;
    }

    state = new ExternalServiceState {
      Provider = GoogleLinkProvider,
      StateKey = stateKey
    };
    dbContext.ExternalServiceStates.Add(state);
    return state;
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

  private static string? GetAuthenticationProperty(AuthenticationProperties? properties, string key) {
    if (properties?.Items is null) {
      return null;
    }

    return properties.Items.TryGetValue(key, out var value) ? value : null;
  }

  private static string BuildGoogleUserStateKey(Guid userId) =>
    $"google-link:user:{userId:N}";

  private static string BuildGoogleSubjectStateKey(string subject) =>
    $"google-link:subject:{subject.Trim()}";

  private static string AppendQuery(string returnUrl, string key, string value) {
    var separator = returnUrl.Contains('?') ? "&" : "?";
    return $"{returnUrl}{separator}{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}";
  }

  private static async Task WritePasswordAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      AppUser user,
      string outcome,
      string detail,
      CancellationToken cancellationToken) {
    await auditLogService.WriteAsync(
      new AuditLogEntry(
        user.TenantId,
        ResolveAuditScope(httpContext),
        CategorySecurity,
        "PasswordChanged",
        outcome,
        user.Id,
        user.FullName,
        user.Email,
        "AppUser",
        user.Id,
        user.Email,
        detail,
        ResolveIpAddress(httpContext),
        ResolveUserAgent(httpContext)),
      cancellationToken);
  }

  private static Task WriteSecurityAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      AppUser user,
      string actionType,
      string outcome,
      string detail,
      CancellationToken cancellationToken) =>
    auditLogService.WriteAsync(
      new AuditLogEntry(
        user.TenantId,
        ResolveAuditScope(httpContext),
        CategorySecurity,
        actionType,
        outcome,
        user.Id,
        user.FullName,
        user.Email,
        "AppUser",
        user.Id,
        user.Email,
        detail,
        ResolveIpAddress(httpContext),
        ResolveUserAgent(httpContext)),
      cancellationToken);

  private static string ResolveAuditScope(HttpContext httpContext) {
    var surface = httpContext.User.FindFirstValue("surface");
    if (string.Equals(surface, AuthenticationSurface.TenantDesktop.ToString(), StringComparison.OrdinalIgnoreCase)) {
      return ScopeTenantMls;
    }

    if (string.Equals(surface, AuthenticationSurface.TenantWeb.ToString(), StringComparison.OrdinalIgnoreCase)) {
      return ScopeTenantSms;
    }

    return ScopeSuperadmin;
  }

  private static AuthenticationSurface ResolveAuthenticationSurface(HttpContext httpContext) {
    var surface = httpContext.User.FindFirstValue("surface");
    return Enum.TryParse<AuthenticationSurface>(surface, true, out var parsed)
      ? parsed
      : AuthenticationSurface.Root;
  }

  private static string? ResolveIpAddress(HttpContext httpContext) =>
    httpContext.Connection.RemoteIpAddress?.ToString();

  private static string? ResolveUserAgent(HttpContext httpContext) {
    var userAgent = httpContext.Request.Headers.UserAgent.ToString();
    return string.IsNullOrWhiteSpace(userAgent) ? null : userAgent;
  }

  private sealed record MfaRegistrationPayload(bool Enabled, DateTime EnabledAtUtc);
  private sealed record GoogleAccountLinkPayload(
      Guid UserId,
      string Subject,
      string Email,
      string? Name,
      DateTime LinkedAtUtc);
}
