namespace ServiFinance.Infrastructure.Configuration;

public sealed class DevelopmentSeedOptions {
  public Guid TenantId { get; init; } = ServiFinanceDatabaseDefaults.DefaultDevelopmentTenantId;
  public string AdminEmail { get; init; } = string.Empty;
  public string AdminPassword { get; init; } = string.Empty;
  public string SuperAdminEmail { get; init; } = string.Empty;
  public string SuperAdminPassword { get; init; } = string.Empty;
}
