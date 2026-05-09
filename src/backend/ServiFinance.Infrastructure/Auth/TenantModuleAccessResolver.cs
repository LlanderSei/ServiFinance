namespace ServiFinance.Infrastructure.Auth;

using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

internal static class TenantModuleAccessResolver {
  public static async Task<IReadOnlyList<SessionModuleAccess>> ResolveAsync(
      ServiFinanceDbContext dbContext,
      Tenant? tenant,
      CancellationToken cancellationToken) {
    if (tenant is null || tenant.Id == ServiFinanceDatabaseDefaults.PlatformTenantId) {
      return [];
    }

    var tierQuery = dbContext.SubscriptionTiers
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule);

    var tier = await tierQuery.FirstOrDefaultAsync(
          entity => entity.DisplayName == tenant.SubscriptionPlan,
          cancellationToken)
        ?? await tierQuery.FirstOrDefaultAsync(
          entity => entity.BusinessSizeSegment == tenant.BusinessSizeSegment &&
              entity.SubscriptionEdition == tenant.SubscriptionEdition,
          cancellationToken);

    if (tier is null || !tier.IsActive) {
      return [];
    }

    return tier.Modules
      .Where(entity => entity.PlatformModule is not null && entity.PlatformModule.IsActive)
      .Where(entity => IsGrantedAccessLevel(entity.AccessLevel))
      .OrderBy(entity => entity.PlatformModule!.Channel)
      .ThenBy(entity => entity.PlatformModule!.SortOrder)
      .ThenBy(entity => entity.PlatformModule!.Code)
      .Select(entity => new SessionModuleAccess(
          entity.PlatformModule!.Code,
          entity.PlatformModule.Channel,
          entity.AccessLevel))
      .ToArray();
  }

  private static bool IsGrantedAccessLevel(string? accessLevel) {
    if (string.IsNullOrWhiteSpace(accessLevel)) {
      return false;
    }

    return !string.Equals(accessLevel, "Excluded", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(accessLevel, "None", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(accessLevel, "Not Included", StringComparison.OrdinalIgnoreCase);
  }
}
