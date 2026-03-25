namespace ServiFinance.Infrastructure.Subscriptions;

public interface ISubscriptionTierCatalogService {
  Task<IReadOnlyList<SubscriptionTierCard>> GetActiveTiersAsync(CancellationToken cancellationToken = default);
}
