namespace ServiFinance.Application.Subscriptions;

public sealed record SubscriptionTierModuleCard(
    string ModuleCode,
    string ModuleName,
    string Channel,
    string AccessLevel,
    string Summary);

public sealed record SubscriptionTierCard(
    Guid Id,
    string Code,
    string DisplayName,
    string BusinessSizeSegment,
    string SubscriptionEdition,
    string AudienceSummary,
    string Description,
    decimal MonthlyPriceAmount,
    string CurrencyCode,
    string PriceDisplay,
    string BillingLabel,
    string PlanSummary,
    string HighlightLabel,
    bool IncludesServiceManagementWeb,
    bool IncludesMicroLendingDesktop,
    IReadOnlyList<SubscriptionTierModuleCard> Modules);
