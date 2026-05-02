namespace ServiFinance.Infrastructure.Auditing;

using ServiFinance.Application.Auditing;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

public sealed class AuditLogService(ServiFinanceDbContext dbContext) : IAuditLogService {
  public async Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default) {
    dbContext.AuditEvents.Add(new AuditEvent {
      TenantId = entry.TenantId,
      Scope = TruncateRequired(entry.Scope.Trim(), 50),
      Category = TruncateRequired(entry.Category.Trim(), 50),
      ActionType = TruncateRequired(entry.ActionType.Trim(), 100),
      Outcome = TruncateRequired(entry.Outcome.Trim(), 50),
      ActorUserId = entry.ActorUserId,
      ActorName = TruncateRequired(entry.ActorName?.Trim() ?? string.Empty, 200),
      ActorEmail = TruncateRequired(entry.ActorEmail?.Trim() ?? string.Empty, 50),
      SubjectType = TruncateRequired(entry.SubjectType.Trim(), 100),
      SubjectId = entry.SubjectId,
      SubjectLabel = TruncateRequired(entry.SubjectLabel?.Trim() ?? string.Empty, 300),
      Detail = TruncateRequired(entry.Detail.Trim(), 1000),
      IpAddress = Truncate(entry.IpAddress, 80),
      UserAgent = Truncate(entry.UserAgent, 500),
      OccurredAtUtc = DateTime.UtcNow
    });

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private static string? Truncate(string? value, int maxLength) =>
      string.IsNullOrEmpty(value) || value.Length <= maxLength
        ? value
        : value[..maxLength];

  private static string TruncateRequired(string value, int maxLength) =>
      value.Length <= maxLength
        ? value
        : value[..maxLength];
}
