namespace ServiFinance.Api.Infrastructure;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;

internal static class ProgramEndpointSupport {
  internal const string ApiAuthenticationSchemes = CookieAuthenticationDefaults.AuthenticationScheme + "," + Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;

  internal static bool IsAllowedFrontendOrigin(string origin) {
    if (string.IsNullOrWhiteSpace(origin)) {
      return false;
    }

    if (string.Equals(origin, "null", StringComparison.OrdinalIgnoreCase) ||
        origin.StartsWith("app://", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) {
      return false;
    }

    if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (uri.Host.StartsWith("127.", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (uri.Host.StartsWith("0.0.0.", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    return false;
  }

  internal static CurrentSessionUser ToCurrentSessionUser(AuthenticatedUser user, AuthenticationSurface surface) =>
    new(user.UserId, user.TenantId, user.TenantDomainSlug, user.Email, user.FullName, user.Roles, surface);

  internal static string SanitizeReturnUrl(string? returnUrl, string fallbackPath = "/dashboard") {
    if (string.IsNullOrWhiteSpace(returnUrl)) {
      return fallbackPath;
    }

    return Uri.TryCreate(returnUrl, UriKind.Relative, out var relativeUri)
        ? relativeUri.ToString()
        : fallbackPath;
  }

  internal static async Task SignInUserAsync(HttpContext httpContext, AuthenticatedUser user, bool isPersistent = false) {
    var claims = new List<Claim> {
      new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
      new(ClaimTypes.Name, user.FullName),
      new(ClaimTypes.Email, user.Email),
      new("tenant_id", user.TenantId.ToString()),
      new("tenant_domain_slug", user.TenantDomainSlug)
  };

    claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var authenticationProperties = new AuthenticationProperties {
      IsPersistent = isPersistent,
      AllowRefresh = true
    };

    if (isPersistent) {
      authenticationProperties.ExpiresUtc = DateTimeOffset.UtcNow.AddDays(14);
    }

    await httpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(identity),
        authenticationProperties);
  }

  internal static string? NormalizeTenantSlug(string? tenantSlug) =>
    string.IsNullOrWhiteSpace(tenantSlug)
        ? null
        : tenantSlug.Trim().ToLowerInvariant();

  internal static string? ReadRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Request.Cookies.TryGetValue("sf_refresh_token", out var refreshToken)
        ? refreshToken
        : null;

  internal static bool IsTenantRouteAllowed(ClaimsPrincipal principal, string tenantDomainSlug) =>
    string.Equals(principal.FindFirstValue("tenant_domain_slug"), tenantDomainSlug, StringComparison.OrdinalIgnoreCase);

  internal static bool IsTenantAdministrator(ClaimsPrincipal principal) =>
    principal.IsInRole("Administrator");

  internal static bool TryGetCurrentUserId(ClaimsPrincipal principal, out Guid userId) =>
    Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

  internal static string NormalizeAssignmentStatus(string? assignmentStatus) {
    var normalized = assignmentStatus?.Trim();
    return string.IsNullOrWhiteSpace(normalized)
        ? "Scheduled"
        : normalized;
  }

  internal static string DeriveServiceStatusFromAssignment(string assignmentStatus) =>
    assignmentStatus switch {
      "Scheduled" => "Scheduled",
      "In Progress" => "In Service",
      "Completed" => "Completed",
      "On Hold" => "On Hold",
      _ => assignmentStatus
    };

  internal static string DeriveFinanceHandoffStatus(
    string serviceStatus,
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount) {
    if (hasMicroLoan) {
      return "Loan created";
    }

    if (hasInvoice && CanConvertToLoan(hasInvoice, hasMicroLoan, outstandingAmount, interestableAmount)) {
      return "Ready for loan conversion";
    }

    if (hasInvoice) {
      return "Invoice finalized";
    }

    return string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase)
        ? "Ready for invoicing"
        : "Awaiting service completion";
  }

  internal static bool CanFinalizeInvoice(string serviceStatus, bool hasInvoice) =>
    !hasInvoice && string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase);

  internal static bool CanConvertToLoan(
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount) =>
    hasInvoice &&
    !hasMicroLoan &&
    (interestableAmount ?? 0m) > 0m &&
    (outstandingAmount ?? 0m) > 0m;

  internal static TenantServiceRequestRowResponse CreateTenantServiceRequestResponse(
    Guid id,
    Guid customerId,
    string customerCode,
    string customerName,
    string requestNumber,
    string itemType,
    string itemDescription,
    string issueDescription,
    DateTime? requestedServiceDate,
    string priority,
    string currentStatus,
    DateTime createdAtUtc,
    string createdByUserName,
    Guid? invoiceId,
    string? invoiceNumber,
    string? invoiceStatus,
    decimal? invoiceTotalAmount,
    decimal? invoiceOutstandingAmount,
    decimal? interestableAmount,
    bool hasMicroLoan) {
    var hasInvoice = invoiceId.HasValue;
    return new TenantServiceRequestRowResponse(
        id,
        customerId,
        customerCode,
        customerName,
        requestNumber,
        itemType,
        itemDescription,
        issueDescription,
        requestedServiceDate,
        priority,
        currentStatus,
        createdAtUtc,
        createdByUserName,
        invoiceId,
        invoiceNumber,
        invoiceStatus,
        invoiceTotalAmount,
        invoiceOutstandingAmount,
        interestableAmount,
        DeriveFinanceHandoffStatus(currentStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
        CanFinalizeInvoice(currentStatus, hasInvoice),
        CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
        hasMicroLoan);
  }

  internal static TenantDispatchAssignmentRowResponse CreateTenantDispatchAssignmentResponse(
    Guid id,
    Guid serviceRequestId,
    string requestNumber,
    string customerName,
    string itemType,
    string priority,
    string serviceStatus,
    Guid assignedUserId,
    string assignedUserName,
    Guid assignedByUserId,
    string assignedByUserName,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    string assignmentStatus,
    DateTime createdAtUtc,
    string? invoiceNumber,
    string? invoiceStatus,
    decimal? invoiceOutstandingAmount,
    decimal? interestableAmount,
    int scheduleConflictCount,
    bool hasMicroLoan) {
    var hasInvoice = !string.IsNullOrWhiteSpace(invoiceNumber) || !string.IsNullOrWhiteSpace(invoiceStatus);
    return new TenantDispatchAssignmentRowResponse(
        id,
        serviceRequestId,
        requestNumber,
        customerName,
        itemType,
        priority,
        serviceStatus,
        assignedUserId,
        assignedUserName,
        assignedByUserId,
        assignedByUserName,
        scheduledStartUtc,
        scheduledEndUtc,
        assignmentStatus,
        createdAtUtc,
        DeriveFinanceHandoffStatus(serviceStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
        invoiceNumber,
        invoiceStatus,
        scheduleConflictCount,
        CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
        hasMicroLoan);
  }

  internal static int CountScheduleConflictsInList<T>(
    IReadOnlyList<T> assignments,
    T current,
    Func<T, Guid> assignmentIdSelector,
    Func<T, Guid> assignedUserIdSelector,
    Func<T, string> assignmentStatusSelector,
    Func<T, DateTime?> scheduledStartSelector,
    Func<T, DateTime?> scheduledEndSelector) =>
    assignments.Count(candidate =>
        assignmentIdSelector(candidate) != assignmentIdSelector(current) &&
        assignedUserIdSelector(candidate) == assignedUserIdSelector(current) &&
        IsConflictEligibleStatus(assignmentStatusSelector(candidate)) &&
        IsConflictEligibleStatus(assignmentStatusSelector(current)) &&
        SchedulesOverlap(
            scheduledStartSelector(candidate),
            scheduledEndSelector(candidate),
            scheduledStartSelector(current),
            scheduledEndSelector(current)));

  internal static async Task<int> CountScheduleConflictsAsync(
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    Guid assignedUserId,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    string assignmentStatus,
    Guid? excludeAssignmentId,
    CancellationToken cancellationToken) {
    if (!HasScheduleWindow(scheduledStartUtc, scheduledEndUtc) || !IsConflictEligibleStatus(assignmentStatus)) {
      return 0;
    }

    var candidates = await dbContext.Assignments
        .AsNoTracking()
        .Where(entity => entity.AssignedUserId == assignedUserId)
        .Where(entity => excludeAssignmentId == null || entity.Id != excludeAssignmentId.Value)
        .Where(entity => entity.AssignmentStatus == "Scheduled" || entity.AssignmentStatus == "In Progress" || entity.AssignmentStatus == "On Hold")
        .Select(entity => new {
          entity.ScheduledStartUtc,
          entity.ScheduledEndUtc
        })
        .ToListAsync(cancellationToken);

    return candidates.Count(entity => SchedulesOverlap(
        entity.ScheduledStartUtc,
        entity.ScheduledEndUtc,
        scheduledStartUtc,
        scheduledEndUtc));
  }

  internal static bool HasScheduleWindow(DateTime? scheduledStartUtc, DateTime? scheduledEndUtc) =>
    scheduledStartUtc.HasValue || scheduledEndUtc.HasValue;

  internal static bool IsConflictEligibleStatus(string assignmentStatus) =>
    assignmentStatus is "Scheduled" or "In Progress" or "On Hold";

  internal static bool ShouldBlockScheduleConflict(
    string assignmentStatus,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    int scheduleConflictCount) =>
      scheduleConflictCount > 0 &&
      assignmentStatus is "Scheduled" or "In Progress" &&
      scheduledStartUtc.HasValue &&
      scheduledEndUtc.HasValue;

  internal static bool SchedulesOverlap(
    DateTime? leftStartUtc,
    DateTime? leftEndUtc,
    DateTime? rightStartUtc,
    DateTime? rightEndUtc) {
    if (!HasScheduleWindow(leftStartUtc, leftEndUtc) || !HasScheduleWindow(rightStartUtc, rightEndUtc)) {
      return false;
    }

    var normalizedLeftStart = leftStartUtc ?? leftEndUtc!.Value;
    var normalizedLeftEnd = leftEndUtc ?? leftStartUtc!.Value;
    var normalizedRightStart = rightStartUtc ?? rightEndUtc!.Value;
    var normalizedRightEnd = rightEndUtc ?? rightStartUtc!.Value;

    return normalizedLeftStart <= normalizedRightEnd && normalizedRightStart <= normalizedLeftEnd;
  }

  internal static string GenerateReferenceCode(string prefix) =>
    $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}";

  internal static void WriteRefreshTokenCookie(HttpContext httpContext, string refreshToken, TimeSpan? lifetime = null) {
    var cookieOptions = new CookieOptions {
      HttpOnly = true,
      Secure = httpContext.Request.IsHttps,
      SameSite = SameSiteMode.Strict,
      IsEssential = true
    };

    if (lifetime is not null) {
      cookieOptions.Expires = DateTimeOffset.UtcNow.Add(lifetime.Value);
    }

    httpContext.Response.Cookies.Append("sf_refresh_token", refreshToken, cookieOptions);
  }

  internal static void DeleteRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Response.Cookies.Delete("sf_refresh_token");

  internal static async Task<IResult> RefreshSessionAsync(
    HttpContext httpContext,
    RefreshSessionRequest? request,
    ISessionTokenService sessionTokenService) {
    var usesCookieSession = request is null || string.IsNullOrWhiteSpace(request.RefreshToken);
    var refreshToken = request?.RefreshToken ?? ReadRefreshTokenCookie(httpContext);
    if (string.IsNullOrWhiteSpace(refreshToken)) {
      return Results.Unauthorized();
    }

    var tokens = await sessionTokenService.RefreshSessionAsync(refreshToken, httpContext.RequestAborted);
    if (tokens is null) {
      if (usesCookieSession) {
        DeleteRefreshTokenCookie(httpContext);
      }

      return Results.Unauthorized();
    }

    if (usesCookieSession) {
      WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
    }

    var currentUser = sessionTokenService.ReadAccessToken(tokens.AccessToken);
    return currentUser is null
        ? Results.Unauthorized()
        : Results.Ok(new AuthSessionResponse(tokens, currentUser));
  }

}
