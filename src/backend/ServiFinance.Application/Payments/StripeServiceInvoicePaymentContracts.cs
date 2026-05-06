namespace ServiFinance.Application.Payments;

public sealed record ServiceInvoiceStripeCheckoutSession(
    Guid InvoiceId,
    string CheckoutSessionId,
    string CheckoutUrl);

public sealed record ServiceInvoiceStripeCheckoutSyncResult(
    Guid InvoiceId,
    string InvoiceStatus,
    decimal OutstandingAmount,
    bool PaymentApplied);
