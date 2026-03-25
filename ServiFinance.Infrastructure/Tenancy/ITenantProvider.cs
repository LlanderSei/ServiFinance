namespace ServiFinance.Infrastructure.Tenancy;

public interface ITenantProvider {
  Guid CurrentTenantId { get; }
  bool HasRequestContext { get; }
}
