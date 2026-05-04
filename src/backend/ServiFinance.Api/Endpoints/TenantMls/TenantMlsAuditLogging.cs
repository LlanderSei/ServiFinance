namespace ServiFinance.Api.Endpoints.TenantMls;

using System.Security.Claims;
using ServiFinance.Application.Auditing;

internal static class TenantMlsAuditLogging {
  public static Task WriteSystemAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      Guid tenantId,
      string actionType,
      string outcome,
      string subjectType,
      Guid? subjectId,
      string subjectLabel,
      string detail) {
    return auditLogService.WriteAsync(
        new AuditLogEntry(
            tenantId,
            "TenantMls",
            "System",
            actionType,
            outcome,
            TryGetCurrentUserId(httpContext.User, out var userId) ? userId : null,
            httpContext.User.FindFirstValue(ClaimTypes.Name),
            httpContext.User.FindFirstValue(ClaimTypes.Email),
            subjectType,
            subjectId,
            subjectLabel,
            detail,
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.Request.Headers.UserAgent.ToString()),
        httpContext.RequestAborted);
  }

  private static bool TryGetCurrentUserId(ClaimsPrincipal principal, out Guid userId) =>
    Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
