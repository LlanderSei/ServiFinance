using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Infrastructure.Data;

using ServiFinance.Application.Subscriptions;

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
            entity.BusinessSizeSegment,
            entity.SubscriptionEdition,
            entity.AudienceSummary,
            entity.Description,
            entity.MonthlyPriceAmount,
            entity.CurrencyCode,
            FormatPriceDisplay(entity.MonthlyPriceAmount, entity.CurrencyCode),
            entity.BillingLabel,
            entity.PlanSummary,
            entity.HighlightLabel,
            entity.IncludesServiceManagementWeb,
            entity.IncludesMicroLendingDesktop,
            entity.Modules
                .Where(module => module.PlatformModule != null && module.PlatformModule.IsActive)
                .OrderBy(module => module.SortOrder)
                .ThenBy(module => module.PlatformModule!.SortOrder)
                .ThenBy(module => module.PlatformModule!.Name)
                .Select(module => new SubscriptionTierModuleCard(
                    module.PlatformModule!.Code,
                    module.PlatformModule.Name,
                    module.PlatformModule.Channel,
                    module.AccessLevel,
                    module.PlatformModule.Summary))
                .ToList()))
        .ToListAsync(cancellationToken);
  }

  private static string FormatPriceDisplay(decimal amount, string currencyCode) =>
    $"Starts at {currencyCode} {amount.ToString("N0", CultureInfo.InvariantCulture)}";
}

