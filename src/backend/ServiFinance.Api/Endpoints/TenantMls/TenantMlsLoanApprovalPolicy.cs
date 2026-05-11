namespace ServiFinance.Api.Endpoints.TenantMls;

using ServiFinance.Application.Payments;
using ServiFinance.Domain;

internal static class TenantMlsLoanApprovalPolicy {
  public const string NotRequestedStatus = "Not Requested";
  public const string PendingReviewStatus = "Pending Review";
  public const string ApprovedStatus = "Approved";
  public const string RejectedStatus = "Rejected";
  public const int RemarksMaxLength = 1000;

  public static string NormalizeInvoiceApprovalStatus(Invoice invoice) =>
    string.IsNullOrWhiteSpace(invoice.LoanApprovalStatus)
      ? NotRequestedStatus
      : invoice.LoanApprovalStatus.Trim();

  public static string NormalizeMicroLoanApprovalStatus(MicroLoan loan) =>
    string.IsNullOrWhiteSpace(loan.ApprovalStatus)
      ? ApprovedStatus
      : loan.ApprovalStatus.Trim();

  public static bool IsApproved(Invoice invoice) =>
    string.Equals(NormalizeInvoiceApprovalStatus(invoice), ApprovedStatus, StringComparison.OrdinalIgnoreCase);

  public static bool IsPending(Invoice invoice) =>
    string.Equals(NormalizeInvoiceApprovalStatus(invoice), PendingReviewStatus, StringComparison.OrdinalIgnoreCase);

  public static bool IsPending(MicroLoan loan) =>
    string.Equals(NormalizeMicroLoanApprovalStatus(loan), PendingReviewStatus, StringComparison.OrdinalIgnoreCase);

  public static string? GetServiceLinkedApprovalBlockReason(Invoice? invoice) {
    if (invoice is null) {
      return "The selected invoice can no longer be reviewed for loan approval.";
    }

    if (invoice.MicroLoan is not null) {
      return "This invoice has already been released as an MLS loan.";
    }

    if (invoice.PaymentSubmissions.Any(entity => ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(entity.Status))) {
      return "A customer payment proof is still pending finance review.";
    }

    if (invoice.PaymentSubmissions.Any(entity => string.Equals(entity.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))) {
      return "A hosted checkout session is still pending for this invoice.";
    }

    var derivedStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
    if (!ServiceInvoiceFinancePolicy.CanConvertToLoan(true, false, invoice.OutstandingAmount, invoice.InterestableAmount, derivedStatus)) {
      return $"Only finalized invoices with unpaid interestable balances can enter loan approval. Current invoice status: {derivedStatus}.";
    }

    return null;
  }

  public static string? NormalizeRemarks(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }
}
