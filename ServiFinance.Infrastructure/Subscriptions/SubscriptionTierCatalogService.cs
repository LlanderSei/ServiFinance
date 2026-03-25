using Microsoft.EntityFrameworkCore;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Subscriptions;

public sealed class SubscriptionTierCatalogService(ServiFinanceDbContext dbContext) : ISubscriptionTierCatalogService {
  public async Task<IReadOnlyList<SubscriptionTierCard>> GetActiveTiersAsync(CancellationToken cancellationToken = default) {
    return await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .OrderBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.DisplayName)
        .Select(entity => new SubscriptionTierCard(
            entity.Id,
            entity.Code,
            entity.DisplayName,
            entity.AudienceSummary,
            entity.Description,
            entity.PriceDisplay,
            entity.BillingLabel,
            entity.PlanSummary,
            entity.HighlightLabel,
            entity.IncludesServiceManagementWeb,
            entity.IncludesMicroLendingDesktop))
        .ToListAsync(cancellationToken);
  }
}
