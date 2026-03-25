namespace ServiFinance.Infrastructure.Configuration;

public sealed class DevelopmentSeedOptions {
  public Guid TenantId { get; init; } = ServiFinanceDatabaseDefaults.DefaultDevelopmentTenantId;
  public string AdminEmail { get; init; } = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminEmail;
  public string AdminPassword { get; init; } = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminPassword;
  public string SuperAdminEmail { get; init; } = ServiFinanceDatabaseDefaults.DefaultSuperAdminEmail;
  public string SuperAdminPassword { get; init; } = ServiFinanceDatabaseDefaults.DefaultSuperAdminPassword;
}
