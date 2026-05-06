using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using ServiFinance.Application.Payments;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;
using DomainInvoice = ServiFinance.Domain.Invoice;

namespace ServiFinance.Infrastructure.Payments;

public sealed class StripeServiceInvoicePaymentService(
    ServiFinanceDbContext dbContext,
    IOptions<StripeBillingOptions> stripeOptionsAccessor,
    TimeProvider timeProvider) : IStripeServiceInvoicePaymentService {
  private const string ServiceInvoicePaymentKind = "ServiceInvoice";
  private const string StripeCheckoutPaymentMethod = "Stripe Checkout";
  private readonly StripeBillingOptions _stripeOptions = stripeOptionsAccessor.Value;

  public bool IsConfigured => !string.IsNullOrWhiteSpace(_stripeOptions.SecretKey);

  public async Task<ServiceInvoiceStripeCheckoutSession> CreateCheckoutSessionAsync(
      Guid invoiceId,
      Guid customerId,
      string tenantDomainSlug,
      string baseUrl,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri)) {
      throw new InvalidOperationException("The customer billing base URL could not be resolved.");
    }

    var invoice = await dbContext.Invoices
        .Include(entity => entity.Customer)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.PaymentSubmissions)
        .SingleOrDefaultAsync(entity => entity.Id == invoiceId && entity.CustomerId == customerId, cancellationToken);
    if (invoice is null) {
      throw new InvalidOperationException("The selected invoice could not be found.");
    }

    var reusableSession = await TryResolvePendingCheckoutAsync(invoice, cancellationToken);
    if (reusableSession is not null) {
      return reusableSession;
    }

    ValidateCheckoutEligibility(invoice);

    var outstandingAmount = RoundCurrency(invoice.OutstandingAmount);
    var sessionService = new SessionService(BuildStripeClient());
    var session = await sessionService.CreateAsync(
        new SessionCreateOptions {
          Mode = "payment",
          SuccessUrl = BuildAbsoluteUrl(
              baseUri,
              $"/t/{tenantDomainSlug}/c/invoices?checkout=success&invoice_id={invoice.Id:D}&session_id={{CHECKOUT_SESSION_ID}}"),
          CancelUrl = BuildAbsoluteUrl(
              baseUri,
              $"/t/{tenantDomainSlug}/c/invoices?checkout=canceled&invoice_id={invoice.Id:D}"),
          CustomerEmail = invoice.Customer?.Email,
          ClientReferenceId = invoice.Id.ToString("D"),
          Metadata = new Dictionary<string, string> {
            ["paymentKind"] = ServiceInvoicePaymentKind,
            ["invoiceId"] = invoice.Id.ToString("D"),
            ["customerId"] = customerId.ToString("D"),
            ["tenantId"] = invoice.TenantId.ToString("D"),
            ["tenantDomainSlug"] = tenantDomainSlug,
            ["invoiceNumber"] = invoice.InvoiceNumber
          },
          LineItems = [
            new SessionLineItemOptions {
              Quantity = 1,
              PriceData = new SessionLineItemPriceDataOptions {
                Currency = "php",
                UnitAmountDecimal = outstandingAmount * 100m,
                ProductData = new SessionLineItemPriceDataProductDataOptions {
                  Name = $"Service invoice {invoice.InvoiceNumber}",
                  Description = invoice.ServiceRequest is not null
                    ? $"{invoice.ServiceRequest.RequestNumber} - {invoice.ServiceRequest.ItemType}"
                    : "Direct settlement for a completed service request"
                }
              }
            }
          ]
        },
        cancellationToken: cancellationToken);

    var now = GetUtcNow();
    invoice.PaymentSubmissions.Add(new InvoicePaymentSubmission {
      TenantId = invoice.TenantId,
      InvoiceId = invoice.Id,
      CustomerId = customerId,
      ServiceRequestId = invoice.ServiceRequestId,
      AmountSubmitted = outstandingAmount,
      ApprovedAmount = null,
      PaymentMethod = StripeCheckoutPaymentMethod,
      ReferenceNumber = session.Id,
      Note = "Hosted Stripe Checkout session opened for this invoice.",
      Status = ServiceInvoiceFinancePolicy.CheckoutPendingStatus,
      SubmittedAtUtc = now
    });
    invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
    await dbContext.SaveChangesAsync(cancellationToken);

    if (string.IsNullOrWhiteSpace(session.Url)) {
      throw new InvalidOperationException("Stripe Checkout did not return a redirect URL for this invoice.");
    }

    return new ServiceInvoiceStripeCheckoutSession(invoice.Id, session.Id, session.Url);
  }

  public async Task<ServiceInvoiceStripeCheckoutSyncResult?> SyncCheckoutSessionAsync(
      Guid invoiceId,
      Guid customerId,
      string checkoutSessionId,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    var invoice = await dbContext.Invoices
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.PaymentSubmissions)
        .SingleOrDefaultAsync(entity => entity.Id == invoiceId && entity.CustomerId == customerId, cancellationToken);
    if (invoice is null) {
      return null;
    }

    var submission = invoice.PaymentSubmissions.FirstOrDefault(entity =>
        string.Equals(entity.PaymentMethod, StripeCheckoutPaymentMethod, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(entity.ReferenceNumber, checkoutSessionId, StringComparison.OrdinalIgnoreCase));
    if (submission is null) {
      throw new InvalidOperationException("That checkout session is not linked to this invoice.");
    }

    var sessionService = new SessionService(BuildStripeClient());
    Session session;
    try {
      session = await sessionService.GetAsync(checkoutSessionId, cancellationToken: cancellationToken);
    } catch (StripeException ex) {
      throw new InvalidOperationException(ex.Message);
    }

    var normalizedPaymentKind = session.Metadata != null && session.Metadata.TryGetValue("paymentKind", out var paymentKind)
      ? paymentKind
      : null;
    if (!string.Equals(normalizedPaymentKind, ServiceInvoicePaymentKind, StringComparison.OrdinalIgnoreCase)) {
      throw new InvalidOperationException("That checkout session does not belong to a service invoice payment.");
    }

    if (session.PaymentStatus == "paid") {
      var applied = await ApplyPaidCheckoutSessionAsync(invoice, submission, session, cancellationToken);
      return new ServiceInvoiceStripeCheckoutSyncResult(invoice.Id, invoice.InvoiceStatus, invoice.OutstandingAmount, applied);
    }

    if (string.Equals(submission.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(session.Status, "expired", StringComparison.OrdinalIgnoreCase)) {
      submission.Status = "Expired";
      submission.ReviewRemarks = "The online checkout session expired before payment was completed.";
      invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
      await dbContext.SaveChangesAsync(cancellationToken);
    }

    return new ServiceInvoiceStripeCheckoutSyncResult(invoice.Id, invoice.InvoiceStatus, invoice.OutstandingAmount, false);
  }

  public async Task ProcessWebhookAsync(
      string payload,
      string? signatureHeader,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    if (string.IsNullOrWhiteSpace(_stripeOptions.WebhookSecret)) {
      throw new InvalidOperationException("Stripe webhook secret is not configured.");
    }

    var stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, _stripeOptions.WebhookSecret);
    if (!string.Equals(stripeEvent.Type, "checkout.session.completed", StringComparison.OrdinalIgnoreCase) ||
        stripeEvent.Data.Object is not Session session) {
      return;
    }

    var normalizedPaymentKind = session.Metadata != null && session.Metadata.TryGetValue("paymentKind", out var paymentKind)
      ? paymentKind
      : null;
    if (!string.Equals(normalizedPaymentKind, ServiceInvoicePaymentKind, StringComparison.OrdinalIgnoreCase)) {
      return;
    }

    var invoiceId = ReadGuidMetadata(session.Metadata, "invoiceId");
    if (!invoiceId.HasValue) {
      return;
    }

    var invoice = await dbContext.Invoices
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.PaymentSubmissions)
        .SingleOrDefaultAsync(entity => entity.Id == invoiceId.Value, cancellationToken);
    if (invoice is null) {
      return;
    }

    var submission = invoice.PaymentSubmissions.FirstOrDefault(entity =>
        string.Equals(entity.PaymentMethod, StripeCheckoutPaymentMethod, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(entity.ReferenceNumber, session.Id, StringComparison.OrdinalIgnoreCase));
    if (submission is null) {
      submission = new InvoicePaymentSubmission {
        TenantId = invoice.TenantId,
        InvoiceId = invoice.Id,
        CustomerId = invoice.CustomerId,
        ServiceRequestId = invoice.ServiceRequestId,
        AmountSubmitted = RoundCurrency((session.AmountTotal ?? 0L) / 100m),
        PaymentMethod = StripeCheckoutPaymentMethod,
        ReferenceNumber = session.Id,
        Note = "Hosted Stripe Checkout session completed.",
        Status = ServiceInvoiceFinancePolicy.CheckoutPendingStatus,
        SubmittedAtUtc = GetUtcNow()
      };
      invoice.PaymentSubmissions.Add(submission);
    }

    await ApplyPaidCheckoutSessionAsync(invoice, submission, session, cancellationToken);
  }

  private async Task<ServiceInvoiceStripeCheckoutSession?> TryResolvePendingCheckoutAsync(
      DomainInvoice invoice,
      CancellationToken cancellationToken) {
    var pendingSubmission = invoice.PaymentSubmissions
        .Where(entity =>
            string.Equals(entity.PaymentMethod, StripeCheckoutPaymentMethod, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(entity.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(entity => entity.SubmittedAtUtc)
        .FirstOrDefault();
    if (pendingSubmission is null) {
      return null;
    }

    var sessionService = new SessionService(BuildStripeClient());
    Session session;
    try {
      session = await sessionService.GetAsync(pendingSubmission.ReferenceNumber, cancellationToken: cancellationToken);
    } catch (StripeException) {
      pendingSubmission.Status = "Expired";
      pendingSubmission.ReviewRemarks = "The pending Stripe checkout session could no longer be found.";
      invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
      await dbContext.SaveChangesAsync(cancellationToken);
      return null;
    }

    if (session.PaymentStatus == "paid") {
      await ApplyPaidCheckoutSessionAsync(invoice, pendingSubmission, session, cancellationToken);
      throw new InvalidOperationException("This invoice was already paid online. Refresh the invoice workspace.");
    }

    if (string.Equals(session.Status, "open", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(session.Url)) {
      return new ServiceInvoiceStripeCheckoutSession(invoice.Id, session.Id, session.Url);
    }

    pendingSubmission.Status = string.Equals(session.Status, "expired", StringComparison.OrdinalIgnoreCase)
      ? "Expired"
      : "Cancelled";
    pendingSubmission.ReviewRemarks = string.Equals(session.Status, "expired", StringComparison.OrdinalIgnoreCase)
      ? "The online checkout session expired before payment was completed."
      : "The online checkout session closed before payment was completed.";
    invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
    await dbContext.SaveChangesAsync(cancellationToken);
    return null;
  }

  private void ValidateCheckoutEligibility(DomainInvoice invoice) {
    if (invoice.MicroLoan is not null) {
      throw new InvalidOperationException("This invoice has already been converted into an MLS loan account.");
    }

    if (invoice.OutstandingAmount <= 0m || string.Equals(invoice.InvoiceStatus, ServiceInvoiceFinancePolicy.PaidStatus, StringComparison.OrdinalIgnoreCase)) {
      throw new InvalidOperationException("This invoice is already settled.");
    }

    if (!string.Equals(invoice.InvoiceStatus, ServiceInvoiceFinancePolicy.FinalizedStatus, StringComparison.OrdinalIgnoreCase)) {
      throw new InvalidOperationException("Online checkout is only available before direct settlement or MLS conversion begins.");
    }

    if (RoundCurrency(invoice.OutstandingAmount) != RoundCurrency(invoice.TotalAmount)) {
      throw new InvalidOperationException("Online checkout is only available while the full invoice balance is still unpaid.");
    }

    if (invoice.PaymentSubmissions.Any(entity => ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(entity.Status))) {
      throw new InvalidOperationException("A manual settlement proof is already pending review for this invoice.");
    }
  }

  private async Task<bool> ApplyPaidCheckoutSessionAsync(
      DomainInvoice invoice,
      InvoicePaymentSubmission submission,
      Session session,
      CancellationToken cancellationToken) {
    if (string.Equals(submission.Status, "Approved", StringComparison.OrdinalIgnoreCase)) {
      return false;
    }

    if (invoice.MicroLoan is not null) {
      return false;
    }

    var approvedAmount = RoundCurrency((session.AmountTotal ?? 0L) / 100m);
    if (approvedAmount <= 0m) {
      return false;
    }

    approvedAmount = Math.Min(approvedAmount, invoice.OutstandingAmount);
    if (approvedAmount <= 0m) {
      return false;
    }

    var now = GetUtcNow();
    submission.AmountSubmitted = approvedAmount;
    submission.ApprovedAmount = approvedAmount;
    submission.Status = "Approved";
    submission.Note = "Stripe Checkout payment confirmed automatically.";
    submission.ReviewRemarks = "Confirmed automatically after Stripe reported a successful checkout.";
    submission.ReviewedAtUtc = now;

    invoice.OutstandingAmount = RoundCurrency(invoice.OutstandingAmount - approvedAmount);
    invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);

    if (invoice.ServiceRequestId.HasValue) {
      dbContext.StatusLogs.Add(new StatusLog {
        TenantId = invoice.TenantId,
        ServiceRequestId = invoice.ServiceRequestId.Value,
        Status = invoice.ServiceRequest?.CurrentStatus ?? "Completed",
        Remarks = $"Stripe payment confirmed for invoice {invoice.InvoiceNumber} amounting to {approvedAmount:0.00}.",
        ChangedAtUtc = now
      });
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    return true;
  }

  private StripeClient BuildStripeClient() => new(_stripeOptions.SecretKey);

  private void EnsureConfigured() {
    if (!IsConfigured) {
      throw new InvalidOperationException("Stripe billing is not configured for this environment yet.");
    }
  }

  private static Guid? ReadGuidMetadata(IDictionary<string, string>? metadata, string key) {
    if (metadata is null || !metadata.TryGetValue(key, out var value) || !Guid.TryParse(value, out var parsed)) {
      return null;
    }

    return parsed;
  }

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);

  private DateTime GetUtcNow() => timeProvider.GetUtcNow().UtcDateTime;

  private static string BuildAbsoluteUrl(Uri baseUri, string relativePath) =>
    new Uri(baseUri, relativePath).ToString();
}
