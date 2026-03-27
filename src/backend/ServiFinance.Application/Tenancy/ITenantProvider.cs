namespace ServiFinance.Application.Tenancy;

public interface ITenantProvider {
  Guid CurrentTenantId { get; }
  bool HasRequestContext { get; }
}
