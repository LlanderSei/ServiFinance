namespace ServiFinance.Application.Payments;

public interface IStripeServiceInvoicePaymentService {
  bool IsConfigured { get; }

  Task<ServiceInvoiceStripeCheckoutSession> CreateCheckoutSessionAsync(
      Guid invoiceId,
      Guid customerId,
      string tenantDomainSlug,
      string baseUrl,
      CancellationToken cancellationToken = default);

  Task<ServiceInvoiceStripeCheckoutSyncResult?> SyncCheckoutSessionAsync(
      Guid invoiceId,
      Guid customerId,
      string checkoutSessionId,
      CancellationToken cancellationToken = default);

  Task ProcessWebhookAsync(
      string payload,
      string? signatureHeader,
      CancellationToken cancellationToken = default);
}
