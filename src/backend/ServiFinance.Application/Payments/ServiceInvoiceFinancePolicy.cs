using ServiFinance.Domain;

namespace ServiFinance.Application.Payments;

public static class ServiceInvoiceFinancePolicy {
  public const string FinalizedStatus = "Finalized";
  public const string CheckoutPendingStatus = "Checkout Pending";
  public const string PaymentSubmittedStatus = "Payment Submitted";
  public const string LegacyPendingReviewStatus = "Pending Review";
  public const string PartiallyPaidStatus = "Partially Paid";
  public const string PaidStatus = "Paid";

  public static bool CanConvertToLoan(
      bool hasInvoice,
      bool hasMicroLoan,
      decimal? outstandingAmount,
      decimal? interestableAmount,
      string? invoiceStatus) =>
    hasInvoice &&
    !hasMicroLoan &&
    string.Equals(invoiceStatus, FinalizedStatus, StringComparison.OrdinalIgnoreCase) &&
    (interestableAmount ?? 0m) > 0m &&
    (outstandingAmount ?? 0m) > 0m;

  public static string DeriveInvoiceStatus(Invoice invoice) {
    if (invoice.PaymentSubmissions.Any(entity => IsManualReviewPendingStatus(entity.Status))) {
      return PaymentSubmittedStatus;
    }

    if (invoice.PaymentSubmissions.Any(entity => string.Equals(entity.Status, CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))) {
      return CheckoutPendingStatus;
    }

    if (invoice.OutstandingAmount <= 0m) {
      return PaidStatus;
    }

    if (invoice.OutstandingAmount < invoice.TotalAmount) {
      return PartiallyPaidStatus;
    }

    return FinalizedStatus;
  }

  public static bool IsManualReviewPendingStatus(string? status) =>
    string.Equals(status, PaymentSubmittedStatus, StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, LegacyPendingReviewStatus, StringComparison.OrdinalIgnoreCase);
}
