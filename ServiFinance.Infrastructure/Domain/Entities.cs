namespace ServiFinance.Infrastructure.Domain;

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
  public string SubscriptionPlan { get; set; } = string.Empty;
  public string SubscriptionStatus { get; set; } = string.Empty;
  public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
  public bool IsActive { get; set; } = true;

  public ICollection<AppUser> Users { get; set; } = [];
  public ICollection<Role> Roles { get; set; } = [];
  public ICollection<Customer> Customers { get; set; } = [];
}

public sealed class SubscriptionTier : Entity {
  public string Code { get; set; } = string.Empty;
  public string DisplayName { get; set; } = string.Empty;
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
  public ICollection<MicroLoan> CreatedMicroLoans { get; set; } = [];
  public ICollection<LedgerTransaction> CreatedTransactions { get; set; } = [];
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
  public Guid InvoiceId { get; set; }
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
