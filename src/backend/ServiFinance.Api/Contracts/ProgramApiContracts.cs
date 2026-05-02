namespace ServiFinance.Api.Contracts;

using Microsoft.AspNetCore.Http;

internal sealed record RootLoginRequest(string Email, string Password, bool RememberMe, string? ReturnUrl);
internal sealed record TenantLoginRequest(string Email, string Password, string? TenantDomainSlug, string TargetSystem, string? ReturnUrl);
internal sealed record CreatePlatformTenantCheckoutRequest(
    string BusinessName,
    string DomainSlug,
    string OwnerFullName,
    string OwnerEmail,
    string OwnerPassword,
    Guid SubscriptionTierId);
internal sealed record CreatePlatformTenantCheckoutResponse(
    Guid RegistrationId,
    string CheckoutSessionId,
    string CheckoutUrl);
internal sealed record PlatformTenantRegistrationStatusResponse(
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
internal sealed record ToggleUserStateRequest(bool IsActive);
internal sealed record ToggleTenantStateRequest(bool IsActive);
internal sealed record CreateCustomerRecordRequest(string FullName, string MobileNumber, string Email, string Address);
internal sealed record CreateServiceRequestRecordRequest(
    Guid CustomerId,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string Priority);
internal sealed record CreateTenantAssignmentRequest(
    Guid ServiceRequestId,
    Guid AssignedUserId,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus);
internal sealed record RescheduleTenantAssignmentRequest(
    Guid AssignedUserId,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus,
    string? Remarks);
internal sealed record UpdateTenantAssignmentStatusRequest(
    string AssignmentStatus,
    string? ServiceStatus,
    string? Remarks);
internal sealed record UpdateTenantAssignmentEvidenceRequest(string Note);
internal sealed class SubmitTenantAssignmentEvidenceRequest {
  public string? Note { get; init; }
  public List<IFormFile> Files { get; init; } = [];
}
internal sealed class SubmitTenantBillingProofRequest {
  public decimal AmountSubmitted { get; init; }
  public string PaymentMethod { get; init; } = string.Empty;
  public string? ReferenceNumber { get; init; }
  public string? Note { get; init; }
  public IFormFile? ProofFile { get; init; }
}
internal sealed record FinalizeTenantServiceInvoiceRequest(
    decimal SubtotalAmount,
    decimal InterestableAmount,
    decimal DiscountAmount,
    string? Remarks);
internal sealed record TenantServiceRequestRowResponse(
    Guid Id,
    Guid CustomerId,
    string CustomerCode,
    string CustomerName,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string Priority,
    string CurrentStatus,
    DateTime CreatedAtUtc,
    string CreatedByUserName,
    Guid? InvoiceId,
    string? InvoiceNumber,
    string? InvoiceStatus,
    decimal? InvoiceTotalAmount,
    decimal? InvoiceOutstandingAmount,
    decimal? InterestableAmount,
    string FinanceHandoffStatus,
    bool CanFinalizeInvoice,
    bool CanConvertToLoan,
    bool HasMicroLoan);
internal sealed record TenantServiceRequestAuditRowResponse(
    Guid Id,
    string Status,
    string Remarks,
    string ChangedByUserName,
    DateTime ChangedAtUtc);
internal sealed record TenantServiceRequestDetailResponse(
    TenantServiceRequestRowResponse ServiceRequest,
    IReadOnlyList<TenantServiceRequestAuditRowResponse> AuditTrail);
internal sealed record TenantDispatchAssignmentRowResponse(
    Guid Id,
    Guid ServiceRequestId,
    string RequestNumber,
    string CustomerName,
    string ItemType,
    string Priority,
    string ServiceStatus,
    Guid AssignedUserId,
    string AssignedUserName,
    Guid AssignedByUserId,
    string AssignedByUserName,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus,
    DateTime CreatedAtUtc,
    string FinanceHandoffStatus,
    string? InvoiceNumber,
    string? InvoiceStatus,
    int ScheduleConflictCount,
    bool CanConvertToLoan,
    bool HasMicroLoan);
internal sealed record TenantDispatchAssignmentEventRowResponse(
    Guid Id,
    string EventType,
    string AssignedUserName,
    string? PreviousAssignedUserName,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    DateTime? PreviousScheduledStartUtc,
    DateTime? PreviousScheduledEndUtc,
    string AssignmentStatus,
    string Remarks,
    string ChangedByUserName,
    DateTime CreatedAtUtc);
internal sealed record TenantDispatchAssignmentEvidenceRowResponse(
    Guid Id,
    Guid SubmittedByUserId,
    string Note,
    string? OriginalFileName,
    string? RelativeUrl,
    string SubmittedByUserName,
    DateTime CreatedAtUtc);
internal sealed record TenantDispatchConflictRowResponse(
    Guid AssignmentId,
    string RequestNumber,
    string CustomerName,
    string AssignedUserName,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus);
internal sealed record TenantDispatchAssignmentDetailResponse(
    TenantDispatchAssignmentRowResponse Assignment,
    IReadOnlyList<TenantServiceRequestAuditRowResponse> AuditTrail,
    IReadOnlyList<TenantDispatchAssignmentEventRowResponse> Events,
    IReadOnlyList<TenantDispatchAssignmentEvidenceRowResponse> Evidence,
    IReadOnlyList<TenantDispatchConflictRowResponse> Conflicts);
internal sealed record TenantBillingModuleAccessRowResponse(
    string ModuleCode,
    string ModuleName,
    string Channel,
    string AccessLevel);
internal sealed record TenantBillingPlanSummaryResponse(
    string BusinessSizeSegment,
    string SubscriptionEdition,
    string SubscriptionPlan,
    string SubscriptionStatus,
    string? PriceDisplay,
    string? BillingLabel,
    string? AudienceSummary,
    string? PlanSummary,
    IReadOnlyList<TenantBillingModuleAccessRowResponse> Modules);
internal sealed record TenantBillingStandingResponse(
    string AccountStanding,
    string SuspensionRisk,
    string BillingProvider,
    DateTime? NextRenewalDateUtc,
    decimal? ExpectedRenewalAmount,
    DateTime? LatestSubmissionAtUtc,
    string? LatestSubmissionStatus,
    DateTime? LastConfirmedCoverageEndUtc,
    int PendingReviewCount,
    bool CanSubmitRenewalProof,
    bool CanOpenBillingPortal);
internal sealed record TenantBillingRecordRowResponse(
    Guid Id,
    string BillingPeriodLabel,
    DateTime CoverageStartUtc,
    DateTime CoverageEndUtc,
    DateTime DueDateUtc,
    decimal AmountDue,
    decimal AmountSubmitted,
    string PaymentMethod,
    string ReferenceNumber,
    string Status,
    string? Note,
    string? ReviewRemarks,
    string? ProofOriginalFileName,
    string? ProofRelativeUrl,
    string SubmittedByUserName,
    DateTime SubmittedAtUtc,
    DateTime? ReviewedAtUtc);
internal sealed record TenantBillingOverviewResponse(
    TenantBillingPlanSummaryResponse Plan,
    TenantBillingStandingResponse Standing,
    IReadOnlyList<TenantBillingRecordRowResponse> History);
internal sealed record TenantBillingPortalSessionResponse(string Url);
internal sealed record TenantMlsDashboardSummaryResponse(
    int FinanceReadyInvoices,
    int ConvertedLoans,
    int FinalizedInvoices,
    int LedgerEntries,
    decimal ReadyOutstandingAmount,
    decimal ActiveLoanPrincipalAmount);
internal sealed record TenantMlsFinanceQueueRowResponse(
    Guid InvoiceId,
    Guid? ServiceRequestId,
    Guid CustomerId,
    string CustomerName,
    string RequestNumber,
    string InvoiceNumber,
    DateTime InvoiceDateUtc,
    decimal OutstandingAmount,
    decimal InterestableAmount,
    string FinanceHandoffStatus,
    bool HasMicroLoan);
internal sealed record TenantMlsLoanRowResponse(
    Guid MicroLoanId,
    Guid CustomerId,
    string CustomerName,
    string InvoiceNumber,
    decimal PrincipalAmount,
    decimal TotalRepayableAmount,
    string LoanStatus,
    DateTime CreatedAtUtc);
internal sealed record TenantMlsHandoffDistributionRowResponse(
    string Label,
    int Count);
internal sealed record TenantMlsDashboardResponse(
    TenantMlsDashboardSummaryResponse Summary,
    IReadOnlyList<TenantMlsFinanceQueueRowResponse> FinanceQueue,
    IReadOnlyList<TenantMlsLoanRowResponse> RecentLoans,
    IReadOnlyList<TenantMlsHandoffDistributionRowResponse> HandoffDistribution);
internal sealed record TenantMlsLoanConversionTermsRequest(
    decimal AnnualInterestRate,
    int TermMonths,
    DateOnly LoanStartDate);
internal sealed record CreateTenantMlsLoanConversionRequest(
    Guid InvoiceId,
    decimal AnnualInterestRate,
    int TermMonths,
    DateOnly LoanStartDate);
internal sealed record TenantMlsLoanConversionCandidateResponse(
    Guid InvoiceId,
    Guid? ServiceRequestId,
    Guid CustomerId,
    string CustomerName,
    string RequestNumber,
    string InvoiceNumber,
    DateTime InvoiceDateUtc,
    decimal OutstandingAmount,
    decimal InterestableAmount);
internal sealed record TenantMlsLoanConversionSummaryResponse(
    decimal PrincipalAmount,
    decimal AnnualInterestRate,
    int TermMonths,
    decimal MonthlyInstallment,
    decimal TotalInterestAmount,
    decimal TotalRepayableAmount,
    DateOnly LoanStartDate,
    DateOnly MaturityDate);
internal sealed record TenantMlsAmortizationScheduleRowResponse(
    int InstallmentNumber,
    DateOnly DueDate,
    decimal BeginningBalance,
    decimal PrincipalPortion,
    decimal InterestPortion,
    decimal InstallmentAmount,
    decimal EndingBalance);
internal sealed record TenantMlsLoanConversionPreviewResponse(
    TenantMlsLoanConversionCandidateResponse Invoice,
    TenantMlsLoanConversionSummaryResponse Summary,
    IReadOnlyList<TenantMlsAmortizationScheduleRowResponse> Schedule);
internal sealed record TenantMlsLoanConversionWorkspaceResponse(
    IReadOnlyList<TenantMlsLoanConversionCandidateResponse> Candidates);
internal sealed record TenantMlsLoanCreatedResponse(
    Guid MicroLoanId,
    string InvoiceNumber,
    string CustomerName,
    TenantMlsLoanConversionSummaryResponse Summary);
internal sealed record TenantMlsLoanAccountRowResponse(
    Guid MicroLoanId,
    Guid CustomerId,
    string CustomerName,
    string InvoiceNumber,
    decimal PrincipalAmount,
    decimal TotalRepayableAmount,
    decimal TotalPaidAmount,
    decimal OutstandingBalance,
    int PendingInstallments,
    DateOnly? NextDueDate,
    string LoanStatus,
    DateTime CreatedAtUtc);
internal sealed record TenantMlsLoanAccountsWorkspaceResponse(
    IReadOnlyList<TenantMlsLoanAccountRowResponse> Loans);
internal sealed record TenantMlsLoanLedgerRowResponse(
    Guid TransactionId,
    DateTime TransactionDateUtc,
    string TransactionType,
    string ReferenceNumber,
    decimal DebitAmount,
    decimal CreditAmount,
    decimal RunningBalance,
    string Remarks,
    bool CanReverse);
internal sealed record TenantMlsLoanDetailResponse(
    TenantMlsLoanAccountRowResponse Loan,
    IReadOnlyList<TenantMlsAmortizationScheduleRowResponse> Schedule,
    IReadOnlyList<TenantMlsLoanLedgerRowResponse> Ledger);
internal sealed record PostTenantMlsLoanPaymentRequest(
    decimal Amount,
    DateOnly PaymentDate,
    int? ExpectedStartingInstallmentNumber,
    string? ReferenceNumber,
    string? Remarks);
internal sealed record TenantMlsLoanPaymentPostedResponse(
    Guid MicroLoanId,
    decimal AmountApplied,
    decimal OutstandingBalance,
    int RemainingInstallments,
    string LoanStatus);
internal sealed record PostTenantMlsLoanPaymentReversalRequest(
    DateOnly ReversalDate,
    string? ReferenceNumber,
    string Remarks);
internal sealed record TenantMlsLoanPaymentReversedResponse(
    Guid MicroLoanId,
    Guid ReversedTransactionId,
    decimal AmountReversed,
    decimal OutstandingBalance,
    int RemainingInstallments,
    string LoanStatus);
internal sealed record TenantMlsCollectionsSummaryResponse(
    int OverdueInstallments,
    int DueTodayInstallments,
    int DueThisWeekInstallments,
    decimal OverdueBalance,
    decimal DueThisWeekBalance);
internal sealed record TenantMlsCollectionRowResponse(
    Guid MicroLoanId,
    Guid CustomerId,
    string CustomerName,
    string LoanLabel,
    int InstallmentNumber,
    DateOnly DueDate,
    decimal InstallmentAmount,
    decimal PaidAmount,
    decimal OutstandingAmount,
    int DaysPastDue,
    string CollectionState,
    string LoanStatus);
internal sealed record TenantMlsCollectionsWorkspaceResponse(
    TenantMlsCollectionsSummaryResponse Summary,
    IReadOnlyList<TenantMlsCollectionRowResponse> Entries);
internal sealed record TenantMlsCustomerFinanceSummaryResponse(
    int TotalBorrowers,
    int ActiveBorrowers,
    decimal OutstandingPortfolioBalance,
    decimal TotalCollectedAmount);
internal sealed record TenantMlsCustomerFinanceRowResponse(
    Guid CustomerId,
    string CustomerCode,
    string CustomerName,
    int ActiveLoanCount,
    int SettledLoanCount,
    decimal OutstandingBalance,
    decimal TotalCollectedAmount,
    DateOnly? NextDueDate,
    DateTime? LastPaymentDateUtc);
internal sealed record TenantMlsCustomerFinanceWorkspaceResponse(
    TenantMlsCustomerFinanceSummaryResponse Summary,
    IReadOnlyList<TenantMlsCustomerFinanceRowResponse> Customers);
internal sealed record TenantMlsCustomerFinanceDetailResponse(
    TenantMlsCustomerFinanceRowResponse Customer,
    IReadOnlyList<TenantMlsLoanAccountRowResponse> Loans,
    IReadOnlyList<TenantMlsLedgerRowResponse> Ledger);
internal sealed record TenantMlsAuditSummaryResponse(
    int TotalEvents,
    int LoanCreationEvents,
    int StandaloneLoanEvents,
    int PaymentEvents,
    int PaymentReversalEvents);
internal sealed record TenantMlsAuditRowResponse(
    Guid EventId,
    DateTime OccurredAtUtc,
    string ActionType,
    string ActorName,
    string CustomerName,
    string SubjectLabel,
    string ReferenceLabel,
    string Detail);
internal sealed record TenantMlsAuditWorkspaceResponse(
    TenantMlsAuditSummaryResponse Summary,
    IReadOnlyList<TenantMlsAuditRowResponse> Events);
internal sealed record AuditSummaryResponse(
    int TotalEvents,
    int SystemEvents,
    int SecurityEvents,
    int FailedEvents);
internal sealed record AuditEventRowResponse(
    Guid EventId,
    DateTime OccurredAtUtc,
    string Scope,
    string Category,
    string ActionType,
    string Outcome,
    string ActorName,
    string ActorEmail,
    string SubjectType,
    string SubjectLabel,
    string Detail,
    string? IpAddress);
internal sealed record AuditWorkspaceResponse(
    AuditSummaryResponse Summary,
    IReadOnlyList<AuditEventRowResponse> Events);
internal sealed record TenantMlsStandaloneLoanCustomerResponse(
    Guid CustomerId,
    string CustomerCode,
    string CustomerName);
internal sealed record TenantMlsStandaloneLoanWorkspaceResponse(
    IReadOnlyList<TenantMlsStandaloneLoanCustomerResponse> Customers);
internal sealed record TenantMlsStandaloneLoanPreviewResponse(
    TenantMlsStandaloneLoanCustomerResponse Customer,
    TenantMlsLoanConversionSummaryResponse Summary,
    IReadOnlyList<TenantMlsAmortizationScheduleRowResponse> Schedule);
internal sealed record CreateTenantMlsStandaloneLoanRequest(
    Guid CustomerId,
    decimal PrincipalAmount,
    decimal AnnualInterestRate,
    int TermMonths,
    DateOnly LoanStartDate,
    string? ReferenceNumber,
    string? Remarks);
internal sealed record TenantMlsStandaloneLoanCreatedResponse(
    Guid MicroLoanId,
    string CustomerName,
    TenantMlsLoanConversionSummaryResponse Summary);
internal sealed record TenantMlsLedgerSummaryResponse(
    int TotalEntries,
    decimal TotalLoanDisbursed,
    decimal TotalCollections,
    decimal CurrentRunningBalance);
internal sealed record TenantMlsLedgerRowResponse(
    Guid TransactionId,
    DateTime TransactionDateUtc,
    string TransactionType,
    string ReferenceNumber,
    string CustomerName,
    string LoanLabel,
    decimal DebitAmount,
    decimal CreditAmount,
    decimal RunningBalance,
    string Remarks);
internal sealed record TenantMlsLedgerWorkspaceResponse(
    TenantMlsLedgerSummaryResponse Summary,
    IReadOnlyList<TenantMlsLedgerRowResponse> Entries);
internal sealed record TenantMlsReportsWindowResponse(
    int RangeDays,
    DateTime DateFromUtc,
    DateTime DateToUtc);
internal sealed record TenantMlsReportsSummaryResponse(
    int ActiveLoans,
    decimal OutstandingPortfolioBalance,
    decimal CollectionsInWindow,
    int PaymentCountInWindow,
    decimal LoanDisbursedInWindow,
    decimal OverdueBalance);
internal sealed record TenantMlsReportsAgingBucketRowResponse(
    string Label,
    int LoanCount,
    int InstallmentCount,
    decimal OutstandingAmount);
internal sealed record TenantMlsReportsTrendRowResponse(
    string PeriodLabel,
    decimal CollectedAmount,
    int PaymentCount);
internal sealed record TenantMlsReportsTransactionMixRowResponse(
    string TransactionType,
    int Count,
    decimal TotalAmount);
internal sealed record TenantMlsReportsBorrowerRowResponse(
    Guid CustomerId,
    string CustomerName,
    int ActiveLoanCount,
    decimal OutstandingBalance,
    DateOnly? NextDueDate);
internal sealed record TenantMlsReportsWorkspaceResponse(
    TenantMlsReportsWindowResponse Window,
    TenantMlsReportsSummaryResponse Summary,
    IReadOnlyList<TenantMlsReportsAgingBucketRowResponse> AgingBuckets,
    IReadOnlyList<TenantMlsReportsTrendRowResponse> CollectionTrend,
    IReadOnlyList<TenantMlsReportsTransactionMixRowResponse> TransactionMix,
    IReadOnlyList<TenantMlsReportsBorrowerRowResponse> TopBorrowers);
