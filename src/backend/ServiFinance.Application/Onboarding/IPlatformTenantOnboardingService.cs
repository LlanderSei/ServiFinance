namespace ServiFinance.Application.Onboarding;

public interface IPlatformTenantOnboardingService {
  bool IsConfigured { get; }

  Task<StripeTenantCheckoutSession> CreateCheckoutSessionAsync(
      CreatePlatformTenantCheckoutRequest request,
      string baseUrl,
      CancellationToken cancellationToken = default);

  Task<PlatformTenantRegistrationStatus?> GetRegistrationStatusAsync(
      string checkoutSessionId,
      CancellationToken cancellationToken = default);

  Task ProcessWebhookAsync(
      string payload,
      string? signatureHeader,
      CancellationToken cancellationToken = default);

  Task<TenantBillingPortalSession> CreateBillingPortalSessionAsync(
      Guid tenantId,
      string returnUrl,
      CancellationToken cancellationToken = default);
}
