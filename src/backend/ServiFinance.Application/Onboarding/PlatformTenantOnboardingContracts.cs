namespace ServiFinance.Application.Onboarding;

public sealed record CreatePlatformTenantCheckoutRequest(
    string BusinessName,
    string DomainSlug,
    string OwnerFullName,
    string OwnerEmail,
    string OwnerPassword,
    Guid SubscriptionTierId);

public sealed record StripeTenantCheckoutSession(
    Guid RegistrationId,
    string CheckoutSessionId,
    string CheckoutUrl);

public sealed record PlatformTenantRegistrationStatus(
    Guid RegistrationId,
    string Status,
    string BusinessName,
    string DomainSlug,
    string OwnerEmail,
    string SubscriptionPlan,
    string SubscriptionEdition,
    string? BillingProvider,
    string? StripeSubscriptionStatus,
    string? FailureReason,
    Guid? TenantId,
    string? TenantLoginUrl,
    DateTime CreatedAtUtc,
    DateTime? ProvisionedAtUtc);

public sealed record TenantBillingPortalSession(string Url);
