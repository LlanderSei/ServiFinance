namespace ServiFinance.Api.Endpoints;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
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

  public static RouteGroupBuilder MapAccountApiEndpoints(this RouteGroupBuilder api) {
    var accountApi = api.MapGroup("/account").RequireAuthorization(new AuthorizeAttribute {
      AuthenticationSchemes = ApiAuthenticationSchemes
    });

    accountApi.MapGet("/profile", GetProfileAsync);
    accountApi.MapPut("/profile", UpdateProfileAsync);
    accountApi.MapPost("/password", ChangePasswordAsync);
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

  private static string? ResolveIpAddress(HttpContext httpContext) =>
    httpContext.Connection.RemoteIpAddress?.ToString();

  private static string? ResolveUserAgent(HttpContext httpContext) {
    var userAgent = httpContext.Request.Headers.UserAgent.ToString();
    return string.IsNullOrWhiteSpace(userAgent) ? null : userAgent;
  }
}
