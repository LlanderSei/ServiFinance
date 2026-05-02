namespace ServiFinance.Domain;

public interface ITenantEntity {
  Guid TenantId { get; set; }
}

public abstract class Entity {
  public Guid Id { get; set; } = Guid.NewGuid();
}

public abstract class TenantEntity : Entity, ITenantEntity {
  public Guid TenantId { get; set; }
}

public sealed class Tenant : Entity {
  public string Name { get; set; } = string.Empty;
  public string Code { get; set; } = string.Empty;
  public string DomainSlug { get; set; } = string.Empty;
  public string BusinessSizeSegment { get; set; } = string.Empty;
  public string SubscriptionEdition { get; set; } = string.Empty;
  public string SubscriptionPlan { get; set; } = string.Empty;
  public string SubscriptionStatus { get; set; } = string.Empty;
  public string BillingProvider { get; set; } = "Manual";
  public string? StripeCustomerId { get; set; }
  public string? StripeSubscriptionId { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
  public bool IsActive { get; set; } = true;

  public ICollection<AppUser> Users { get; set; } = [];
  public ICollection<Role> Roles { get; set; } = [];
  public ICollection<Customer> Customers { get; set; } = [];
  public ICollection<TenantBillingRecord> BillingRecords { get; set; } = [];
  public TenantTheme? Theme { get; set; }
}

public sealed class TenantTheme : Entity, ITenantEntity {
  public Guid TenantId { get; set; }
  public string? DisplayName { get; set; }
  public string? LogoUrl { get; set; }
  public string? PrimaryColor { get; set; }
  public string? SecondaryColor { get; set; }
  public string? HeaderBackgroundColor { get; set; }
  public string? PageBackgroundColor { get; set; }

  public Tenant Tenant { get; set; } = null!;
}

public sealed class PlatformTenantRegistration : Entity {
  public Guid SubscriptionTierId { get; set; }
  public Guid? TenantId { get; set; }
  public string BusinessName { get; set; } = string.Empty;
  public string TenantCode { get; set; } = string.Empty;
  public string DomainSlug { get; set; } = string.Empty;
  public string OwnerFullName { get; set; } = string.Empty;
  public string OwnerEmail { get; set; } = string.Empty;
  public string OwnerPasswordHash { get; set; } = string.Empty;
  public string Status { get; set; } = string.Empty;
  public string? StripeCheckoutSessionId { get; set; }
  public string? StripeCustomerId { get; set; }
  public string? StripeSubscriptionId { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
  public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
  public DateTime? CheckoutExpiresAtUtc { get; set; }
  public DateTime? ProvisionedAtUtc { get; set; }
  public string? FailureReason { get; set; }

  public SubscriptionTier? SubscriptionTier { get; set; }
  public Tenant? Tenant { get; set; }
}

public sealed class SubscriptionTier : Entity {
  public string Code { get; set; } = string.Empty;
  public string DisplayName { get; set; } = string.Empty;
  public string BusinessSizeSegment { get; set; } = string.Empty;
  public string SubscriptionEdition { get; set; } = string.Empty;
  public string AudienceSummary { get; set; } = string.Empty;
  public string Description { get; set; } = string.Empty;
  public string PriceDisplay { get; set; } = string.Empty;
  public string BillingLabel { get; set; } = string.Empty;
  public string PlanSummary { get; set; } = string.Empty;
  public string HighlightLabel { get; set; } = string.Empty;
  public int SortOrder { get; set; }
  public bool IncludesServiceManagementWeb { get; set; }
  public bool IncludesMicroLendingDesktop { get; set; }
  public bool IsActive { get; set; } = true;

  public ICollection<SubscriptionTierModule> Modules { get; set; } = [];
}

public sealed class PlatformModule : Entity {
  public string Code { get; set; } = string.Empty;
  public string Name { get; set; } = string.Empty;
  public string Channel { get; set; } = string.Empty;
  public string Summary { get; set; } = string.Empty;
  public int SortOrder { get; set; }
  public bool IsActive { get; set; } = true;

  public ICollection<SubscriptionTierModule> TierAssignments { get; set; } = [];
}

public sealed class RefreshSession : Entity {
  public Guid? UserId { get; set; }
  public Guid? CustomerId { get; set; }
  public string Surface { get; set; } = string.Empty;
  public bool RememberMe { get; set; }
  public string RefreshTokenHash { get; set; } = string.Empty;
  public DateTime ExpiresAtUtc { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
  public DateTime LastRotatedAtUtc { get; set; } = DateTime.UtcNow;

  public AppUser? User { get; set; }
  public Customer? Customer { get; set; }
}

public sealed class AuditEvent : TenantEntity {
  public string Scope { get; set; } = string.Empty;
  public string Category { get; set; } = string.Empty;
  public string ActionType { get; set; } = string.Empty;
  public string Outcome { get; set; } = string.Empty;
  public Guid? ActorUserId { get; set; }
  public string ActorName { get; set; } = string.Empty;
  public string ActorEmail { get; set; } = string.Empty;
  public string SubjectType { get; set; } = string.Empty;
  public Guid? SubjectId { get; set; }
  public string SubjectLabel { get; set; } = string.Empty;
  public string Detail { get; set; } = string.Empty;
  public string? IpAddress { get; set; }
  public string? UserAgent { get; set; }
  public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

  public Tenant? Tenant { get; set; }
  public AppUser? ActorUser { get; set; }
}

public sealed class SubscriptionTierModule : Entity {
  public Guid SubscriptionTierId { get; set; }
  public Guid PlatformModuleId { get; set; }
  public string AccessLevel { get; set; } = string.Empty;
  public int SortOrder { get; set; }

  public SubscriptionTier? SubscriptionTier { get; set; }
  public PlatformModule? PlatformModule { get; set; }
}

public sealed class AppUser : TenantEntity {
  public string Email { get; set; } = string.Empty;
  public string PasswordHash { get; set; } = string.Empty;
  public string FullName { get; set; } = string.Empty;
  public bool IsActive { get; set; } = true;
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Tenant? Tenant { get; set; }
  public ICollection<UserRole> UserRoles { get; set; } = [];
  public ICollection<ServiceRequest> CreatedServiceRequests { get; set; } = [];
  public ICollection<StatusLog> StatusLogs { get; set; } = [];
  public ICollection<Assignment> AssignedAssignments { get; set; } = [];
  public ICollection<Assignment> CreatedAssignments { get; set; } = [];
  public ICollection<AssignmentEvent> AssignmentEvents { get; set; } = [];
  public ICollection<AssignmentEvidence> AssignmentEvidenceItems { get; set; } = [];
  public ICollection<TenantBillingRecord> SubmittedBillingRecords { get; set; } = [];
  public ICollection<MicroLoan> CreatedMicroLoans { get; set; } = [];
  public ICollection<LedgerTransaction> CreatedTransactions { get; set; } = [];
  public ICollection<RefreshSession> RefreshSessions { get; set; } = [];
}

public sealed class Role : TenantEntity {
  public string Name { get; set; } = string.Empty;
  public string Description { get; set; } = string.Empty;

  public Tenant? Tenant { get; set; }
  public ICollection<UserRole> UserRoles { get; set; } = [];
}

public sealed class UserRole : TenantEntity {
  public Guid UserId { get; set; }
  public Guid RoleId { get; set; }
  public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;

  public AppUser? User { get; set; }
  public Role? Role { get; set; }
}

public sealed class Customer : TenantEntity {
  public string CustomerCode { get; set; } = string.Empty;
  public string FullName { get; set; } = string.Empty;
  public string MobileNumber { get; set; } = string.Empty;
  public string Email { get; set; } = string.Empty;
  public string PasswordHash { get; set; } = string.Empty;
  public string Address { get; set; } = string.Empty;
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Tenant? Tenant { get; set; }
  public ICollection<ServiceRequest> ServiceRequests { get; set; } = [];
  public ICollection<Invoice> Invoices { get; set; } = [];
  public ICollection<MicroLoan> MicroLoans { get; set; } = [];
  public ICollection<LedgerTransaction> Transactions { get; set; } = [];
}

public sealed class ServiceRequest : TenantEntity {
  public Guid CustomerId { get; set; }
  public string RequestNumber { get; set; } = string.Empty;
  public string ItemType { get; set; } = string.Empty;
  public string ItemDescription { get; set; } = string.Empty;
  public string IssueDescription { get; set; } = string.Empty;
  public DateTime? RequestedServiceDate { get; set; }
  public string Priority { get; set; } = string.Empty;
  public string CurrentStatus { get; set; } = string.Empty;
  public int? Rating { get; set; }
  public string? FeedbackComments { get; set; }
  public Guid CreatedByUserId { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Customer? Customer { get; set; }
  public AppUser? CreatedByUser { get; set; }
  public ICollection<StatusLog> StatusLogs { get; set; } = [];
  public ICollection<Assignment> Assignments { get; set; } = [];
  public ICollection<Invoice> Invoices { get; set; } = [];
}

public sealed class StatusLog : TenantEntity {
  public Guid ServiceRequestId { get; set; }
  public string Status { get; set; } = string.Empty;
  public string Remarks { get; set; } = string.Empty;
  public Guid ChangedByUserId { get; set; }
  public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

  public ServiceRequest? ServiceRequest { get; set; }
  public AppUser? ChangedByUser { get; set; }
}

public sealed class Assignment : TenantEntity {
  public Guid ServiceRequestId { get; set; }
  public Guid AssignedUserId { get; set; }
  public Guid AssignedByUserId { get; set; }
  public DateTime? ScheduledStartUtc { get; set; }
  public DateTime? ScheduledEndUtc { get; set; }
  public string AssignmentStatus { get; set; } = string.Empty;
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public ServiceRequest? ServiceRequest { get; set; }
  public AppUser? AssignedUser { get; set; }
  public AppUser? AssignedByUser { get; set; }
  public ICollection<AssignmentEvent> Events { get; set; } = [];
  public ICollection<AssignmentEvidence> EvidenceItems { get; set; } = [];
}

public sealed class AssignmentEvent : TenantEntity {
  public Guid AssignmentId { get; set; }
  public string EventType { get; set; } = string.Empty;
  public Guid? PreviousAssignedUserId { get; set; }
  public Guid AssignedUserId { get; set; }
  public DateTime? PreviousScheduledStartUtc { get; set; }
  public DateTime? PreviousScheduledEndUtc { get; set; }
  public DateTime? ScheduledStartUtc { get; set; }
  public DateTime? ScheduledEndUtc { get; set; }
  public string AssignmentStatus { get; set; } = string.Empty;
  public string Remarks { get; set; } = string.Empty;
  public Guid ChangedByUserId { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Assignment? Assignment { get; set; }
  public AppUser? PreviousAssignedUser { get; set; }
  public AppUser? AssignedUser { get; set; }
  public AppUser? ChangedByUser { get; set; }
}

public sealed class AssignmentEvidence : TenantEntity {
  public Guid AssignmentId { get; set; }
  public Guid SubmittedByUserId { get; set; }
  public string Note { get; set; } = string.Empty;
  public string? OriginalFileName { get; set; }
  public string? StoredFileName { get; set; }
  public string? ContentType { get; set; }
  public string? RelativeUrl { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Assignment? Assignment { get; set; }
  public AppUser? SubmittedByUser { get; set; }
}

public sealed class TenantBillingRecord : TenantEntity {
  public Guid SubmittedByUserId { get; set; }
  public string BillingPeriodLabel { get; set; } = string.Empty;
  public DateTime CoverageStartUtc { get; set; }
  public DateTime CoverageEndUtc { get; set; }
  public DateTime DueDateUtc { get; set; }
  public decimal AmountDue { get; set; }
  public decimal AmountSubmitted { get; set; }
  public string PaymentMethod { get; set; } = string.Empty;
  public string ReferenceNumber { get; set; } = string.Empty;
  public string Status { get; set; } = string.Empty;
  public string? Note { get; set; }
  public string? ReviewRemarks { get; set; }
  public string? ProofOriginalFileName { get; set; }
  public string? ProofStoredFileName { get; set; }
  public string? ProofContentType { get; set; }
  public string? ProofRelativeUrl { get; set; }
  public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
  public DateTime? ReviewedAtUtc { get; set; }

  public Tenant? Tenant { get; set; }
  public AppUser? SubmittedByUser { get; set; }
}

public sealed class Invoice : TenantEntity {
  public Guid CustomerId { get; set; }
  public Guid? ServiceRequestId { get; set; }
  public string InvoiceNumber { get; set; } = string.Empty;
  public DateTime InvoiceDateUtc { get; set; } = DateTime.UtcNow;
  public decimal SubtotalAmount { get; set; }
  public decimal InterestableAmount { get; set; }
  public decimal DiscountAmount { get; set; }
  public decimal TotalAmount { get; set; }
  public decimal OutstandingAmount { get; set; }
  public string InvoiceStatus { get; set; } = string.Empty;

  public Customer? Customer { get; set; }
  public ServiceRequest? ServiceRequest { get; set; }
  public ICollection<InvoiceLine> InvoiceLines { get; set; } = [];
  public MicroLoan? MicroLoan { get; set; }
  public ICollection<LedgerTransaction> Transactions { get; set; } = [];
}

public sealed class InvoiceLine : TenantEntity {
  public Guid InvoiceId { get; set; }
  public string Description { get; set; } = string.Empty;
  public decimal Quantity { get; set; }
  public decimal UnitPrice { get; set; }
  public decimal LineTotal { get; set; }

  public Invoice? Invoice { get; set; }
}

public sealed class MicroLoan : TenantEntity {
  public Guid? InvoiceId { get; set; }
  public Guid CustomerId { get; set; }
  public decimal PrincipalAmount { get; set; }
  public decimal AnnualInterestRate { get; set; }
  public int TermMonths { get; set; }
  public decimal MonthlyInstallment { get; set; }
  public decimal TotalInterestAmount { get; set; }
  public decimal TotalRepayableAmount { get; set; }
  public DateTime LoanStartDate { get; set; }
  public DateTime MaturityDate { get; set; }
  public string LoanStatus { get; set; } = string.Empty;
  public Guid CreatedByUserId { get; set; }
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

  public Invoice? Invoice { get; set; }
  public Customer? Customer { get; set; }
  public AppUser? CreatedByUser { get; set; }
  public ICollection<AmortizationSchedule> AmortizationSchedules { get; set; } = [];
  public ICollection<LedgerTransaction> Transactions { get; set; } = [];
}

public sealed class AmortizationSchedule : TenantEntity {
  public Guid MicroLoanId { get; set; }
  public int InstallmentNumber { get; set; }
  public DateTime DueDate { get; set; }
  public decimal BeginningBalance { get; set; }
  public decimal PrincipalPortion { get; set; }
  public decimal InterestPortion { get; set; }
  public decimal InstallmentAmount { get; set; }
  public decimal EndingBalance { get; set; }
  public decimal PaidAmount { get; set; }
  public string InstallmentStatus { get; set; } = string.Empty;

  public MicroLoan? MicroLoan { get; set; }
  public ICollection<LedgerTransaction> Transactions { get; set; } = [];
}

public sealed class LedgerTransaction : TenantEntity {
  public Guid CustomerId { get; set; }
  public Guid? InvoiceId { get; set; }
  public Guid? MicroLoanId { get; set; }
  public Guid? AmortizationScheduleId { get; set; }
  public Guid? ReversalOfTransactionId { get; set; }
  public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
  public string TransactionType { get; set; } = string.Empty;
  public string ReferenceNumber { get; set; } = string.Empty;
  public decimal DebitAmount { get; set; }
  public decimal CreditAmount { get; set; }
  public decimal RunningBalance { get; set; }
  public string Remarks { get; set; } = string.Empty;
  public Guid CreatedByUserId { get; set; }

  public Customer? Customer { get; set; }
  public Invoice? Invoice { get; set; }
  public MicroLoan? MicroLoan { get; set; }
  public AmortizationSchedule? AmortizationSchedule { get; set; }
  public AppUser? CreatedByUser { get; set; }
}
