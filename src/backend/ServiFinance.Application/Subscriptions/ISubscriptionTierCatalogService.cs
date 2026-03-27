namespace ServiFinance.Application.Subscriptions;

public interface ISubscriptionTierCatalogService {
  Task<IReadOnlyList<SubscriptionTierCard>> GetActiveTiersAsync(CancellationToken cancellationToken = default);
}
