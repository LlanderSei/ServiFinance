namespace ServiFinance.Application.Subscriptions;

public sealed record SubscriptionTierCard(
    Guid Id,
    string Code,
    string DisplayName,
    string AudienceSummary,
    string Description,
    string PriceDisplay,
    string BillingLabel,
    string PlanSummary,
    string HighlightLabel,
    bool IncludesServiceManagementWeb,
    bool IncludesMicroLendingDesktop);
