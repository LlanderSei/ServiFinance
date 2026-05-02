namespace ServiFinance.Application.Auditing;

public interface IAuditLogService {
  Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default);
}

public sealed record AuditLogEntry(
    Guid TenantId,
    string Scope,
    string Category,
    string ActionType,
    string Outcome,
    Guid? ActorUserId,
    string? ActorName,
    string? ActorEmail,
    string SubjectType,
    Guid? SubjectId,
    string? SubjectLabel,
    string Detail,
    string? IpAddress,
    string? UserAgent);
