using Microsoft.EntityFrameworkCore;
using ServiFinance.Infrastructure.Domain;
using ServiFinance.Infrastructure.Tenancy;

namespace ServiFinance.Infrastructure.Data;

public sealed class ServiFinanceDbContext(
    DbContextOptions<ServiFinanceDbContext> options,
    ITenantProvider tenantProvider) : DbContext(options) {
  private static readonly Type[] TenantEntityTypes = [
      typeof(AppUser),
      typeof(Role),
      typeof(UserRole),
      typeof(Customer),
      typeof(ServiceRequest),
      typeof(StatusLog),
      typeof(Assignment),
      typeof(Invoice),
      typeof(InvoiceLine),
      typeof(MicroLoan),
      typeof(AmortizationSchedule),
      typeof(LedgerTransaction)
  ];

  private readonly Guid _currentTenantId = tenantProvider.CurrentTenantId;
  private readonly bool _hasRequestContext = tenantProvider.HasRequestContext;

  public DbSet<Tenant> Tenants => Set<Tenant>();
  public DbSet<AppUser> Users => Set<AppUser>();
  public DbSet<Role> Roles => Set<Role>();
  public DbSet<UserRole> UserRoles => Set<UserRole>();
  public DbSet<Customer> Customers => Set<Customer>();
  public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
  public DbSet<StatusLog> StatusLogs => Set<StatusLog>();
  public DbSet<Assignment> Assignments => Set<Assignment>();
  public DbSet<Invoice> Invoices => Set<Invoice>();
  public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
  public DbSet<MicroLoan> MicroLoans => Set<MicroLoan>();
  public DbSet<AmortizationSchedule> AmortizationSchedules => Set<AmortizationSchedule>();
  public DbSet<LedgerTransaction> Transactions => Set<LedgerTransaction>();

  protected override void OnModelCreating(ModelBuilder modelBuilder) {
    ConfigureTenant(modelBuilder);
    ConfigureUsers(modelBuilder);
    ConfigureRoles(modelBuilder);
    ConfigureUserRoles(modelBuilder);
    ConfigureCustomers(modelBuilder);
    ConfigureServiceRequests(modelBuilder);
    ConfigureStatusLogs(modelBuilder);
    ConfigureAssignments(modelBuilder);
    ConfigureInvoices(modelBuilder);
    ConfigureInvoiceLines(modelBuilder);
    ConfigureMicroLoans(modelBuilder);
    ConfigureAmortizationSchedules(modelBuilder);
    ConfigureTransactions(modelBuilder);

    base.OnModelCreating(modelBuilder);
  }

  public override int SaveChanges() {
    ApplyTenantRules();
    return base.SaveChanges();
  }

  public override int SaveChanges(bool acceptAllChangesOnSuccess) {
    ApplyTenantRules();
    return base.SaveChanges(acceptAllChangesOnSuccess);
  }

  public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) {
    ApplyTenantRules();
    return base.SaveChangesAsync(cancellationToken);
  }

  public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default) {
    ApplyTenantRules();
    return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
  }

  private void ApplyTenantRules() {
    foreach (var entry in ChangeTracker.Entries<ITenantEntity>()) {
      if (entry.State == EntityState.Added) {
        if (entry.Entity.TenantId == Guid.Empty) {
          entry.Entity.TenantId = _currentTenantId;
        }
        continue;
      }

      if (!_hasRequestContext) {
        continue;
      }

      if (entry.State == EntityState.Modified && entry.Entity.TenantId != _currentTenantId) {
        throw new InvalidOperationException(
            $"Tenant mismatch detected for entity '{entry.Metadata.ClrType.Name}'.");
      }
    }
  }

  private void ConfigureTenant(ModelBuilder modelBuilder) {
    var tenant = modelBuilder.Entity<Tenant>();
    tenant.ToTable("Tenants");
    tenant.Property(entity => entity.Name).HasMaxLength(200);
    tenant.Property(entity => entity.Code).HasMaxLength(50);
    tenant.Property(entity => entity.DomainSlug).HasMaxLength(100);
    tenant.Property(entity => entity.SubscriptionPlan).HasMaxLength(100);
    tenant.Property(entity => entity.SubscriptionStatus).HasMaxLength(100);
    tenant.HasIndex(entity => entity.Code).IsUnique();
    tenant.HasIndex(entity => entity.DomainSlug).IsUnique();
  }

  private void ConfigureUsers(ModelBuilder modelBuilder) {
    var user = modelBuilder.Entity<AppUser>();
    user.ToTable("Users");
    ConfigureTenantOwned(user);
    user.Property(entity => entity.Email).HasMaxLength(256);
    user.Property(entity => entity.PasswordHash).HasMaxLength(512);
    user.Property(entity => entity.FullName).HasMaxLength(200);
    user.HasIndex(entity => new { entity.TenantId, entity.Email }).IsUnique();
    user.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.Users)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureRoles(ModelBuilder modelBuilder) {
    var role = modelBuilder.Entity<Role>();
    role.ToTable("Roles");
    ConfigureTenantOwned(role);
    role.Property(entity => entity.Name).HasMaxLength(100);
    role.Property(entity => entity.Description).HasMaxLength(256);
    role.HasIndex(entity => new { entity.TenantId, entity.Name }).IsUnique();
    role.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.Roles)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureUserRoles(ModelBuilder modelBuilder) {
    var userRole = modelBuilder.Entity<UserRole>();
    userRole.ToTable("UserRoles");
    ConfigureTenantOwned(userRole);
    userRole.HasIndex(entity => new { entity.TenantId, entity.UserId, entity.RoleId }).IsUnique();
    userRole.HasOne(entity => entity.User)
        .WithMany(entity => entity.UserRoles)
        .HasForeignKey(entity => entity.UserId)
        .OnDelete(DeleteBehavior.Restrict);
    userRole.HasOne(entity => entity.Role)
        .WithMany(entity => entity.UserRoles)
        .HasForeignKey(entity => entity.RoleId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureCustomers(ModelBuilder modelBuilder) {
    var customer = modelBuilder.Entity<Customer>();
    customer.ToTable("Customers");
    ConfigureTenantOwned(customer);
    customer.Property(entity => entity.CustomerCode).HasMaxLength(50);
    customer.Property(entity => entity.FullName).HasMaxLength(200);
    customer.Property(entity => entity.MobileNumber).HasMaxLength(50);
    customer.Property(entity => entity.Email).HasMaxLength(256);
    customer.Property(entity => entity.Address).HasMaxLength(500);
    customer.HasIndex(entity => new { entity.TenantId, entity.CustomerCode }).IsUnique();
    customer.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.Customers)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureServiceRequests(ModelBuilder modelBuilder) {
    var serviceRequest = modelBuilder.Entity<ServiceRequest>();
    serviceRequest.ToTable("ServiceRequests");
    ConfigureTenantOwned(serviceRequest);
    serviceRequest.Property(entity => entity.RequestNumber).HasMaxLength(50);
    serviceRequest.Property(entity => entity.ItemType).HasMaxLength(100);
    serviceRequest.Property(entity => entity.ItemDescription).HasMaxLength(500);
    serviceRequest.Property(entity => entity.IssueDescription).HasMaxLength(1000);
    serviceRequest.Property(entity => entity.Priority).HasMaxLength(50);
    serviceRequest.Property(entity => entity.CurrentStatus).HasMaxLength(50);
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.RequestNumber }).IsUnique();
    serviceRequest.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.ServiceRequests)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    serviceRequest.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedServiceRequests)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureStatusLogs(ModelBuilder modelBuilder) {
    var statusLog = modelBuilder.Entity<StatusLog>();
    statusLog.ToTable("StatusLogs");
    ConfigureTenantOwned(statusLog);
    statusLog.Property(entity => entity.Status).HasMaxLength(50);
    statusLog.Property(entity => entity.Remarks).HasMaxLength(1000);
    statusLog.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.StatusLogs)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
    statusLog.HasOne(entity => entity.ChangedByUser)
        .WithMany(entity => entity.StatusLogs)
        .HasForeignKey(entity => entity.ChangedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAssignments(ModelBuilder modelBuilder) {
    var assignment = modelBuilder.Entity<Assignment>();
    assignment.ToTable("Assignments");
    ConfigureTenantOwned(assignment);
    assignment.Property(entity => entity.AssignmentStatus).HasMaxLength(50);
    assignment.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.Assignments)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
    assignment.HasOne(entity => entity.AssignedUser)
        .WithMany(entity => entity.AssignedAssignments)
        .HasForeignKey(entity => entity.AssignedUserId)
        .OnDelete(DeleteBehavior.Restrict);
    assignment.HasOne(entity => entity.AssignedByUser)
        .WithMany(entity => entity.CreatedAssignments)
        .HasForeignKey(entity => entity.AssignedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureInvoices(ModelBuilder modelBuilder) {
    var invoice = modelBuilder.Entity<Invoice>();
    invoice.ToTable("Invoices");
    ConfigureTenantOwned(invoice);
    invoice.Property(entity => entity.InvoiceNumber).HasMaxLength(50);
    invoice.Property(entity => entity.InvoiceStatus).HasMaxLength(50);
    ConfigureMoney(invoice.Property(entity => entity.SubtotalAmount));
    ConfigureMoney(invoice.Property(entity => entity.InterestableAmount));
    ConfigureMoney(invoice.Property(entity => entity.DiscountAmount));
    ConfigureMoney(invoice.Property(entity => entity.TotalAmount));
    ConfigureMoney(invoice.Property(entity => entity.OutstandingAmount));
    invoice.HasIndex(entity => new { entity.TenantId, entity.InvoiceNumber }).IsUnique();
    invoice.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.Invoices)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    invoice.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.Invoices)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureInvoiceLines(ModelBuilder modelBuilder) {
    var invoiceLine = modelBuilder.Entity<InvoiceLine>();
    invoiceLine.ToTable("InvoiceLines");
    ConfigureTenantOwned(invoiceLine);
    invoiceLine.Property(entity => entity.Description).HasMaxLength(500);
    ConfigureMoney(invoiceLine.Property(entity => entity.Quantity), 18, 4);
    ConfigureMoney(invoiceLine.Property(entity => entity.UnitPrice));
    ConfigureMoney(invoiceLine.Property(entity => entity.LineTotal));
    invoiceLine.HasOne(entity => entity.Invoice)
        .WithMany(entity => entity.InvoiceLines)
        .HasForeignKey(entity => entity.InvoiceId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureMicroLoans(ModelBuilder modelBuilder) {
    var microLoan = modelBuilder.Entity<MicroLoan>();
    microLoan.ToTable("MicroLoans");
    ConfigureTenantOwned(microLoan);
    microLoan.Property(entity => entity.LoanStatus).HasMaxLength(50);
    ConfigureMoney(microLoan.Property(entity => entity.PrincipalAmount));
    ConfigureMoney(microLoan.Property(entity => entity.AnnualInterestRate), 9, 4);
    ConfigureMoney(microLoan.Property(entity => entity.MonthlyInstallment));
    ConfigureMoney(microLoan.Property(entity => entity.TotalInterestAmount));
    ConfigureMoney(microLoan.Property(entity => entity.TotalRepayableAmount));
    microLoan.HasIndex(entity => entity.InvoiceId).IsUnique();
    microLoan.HasOne(entity => entity.Invoice)
        .WithOne(entity => entity.MicroLoan)
        .HasForeignKey<MicroLoan>(entity => entity.InvoiceId)
        .OnDelete(DeleteBehavior.Restrict);
    microLoan.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.MicroLoans)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    microLoan.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedMicroLoans)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAmortizationSchedules(ModelBuilder modelBuilder) {
    var schedule = modelBuilder.Entity<AmortizationSchedule>();
    schedule.ToTable("AmortizationSchedules");
    ConfigureTenantOwned(schedule);
    schedule.Property(entity => entity.InstallmentStatus).HasMaxLength(50);
    ConfigureMoney(schedule.Property(entity => entity.BeginningBalance));
    ConfigureMoney(schedule.Property(entity => entity.PrincipalPortion));
    ConfigureMoney(schedule.Property(entity => entity.InterestPortion));
    ConfigureMoney(schedule.Property(entity => entity.InstallmentAmount));
    ConfigureMoney(schedule.Property(entity => entity.EndingBalance));
    ConfigureMoney(schedule.Property(entity => entity.PaidAmount));
    schedule.HasIndex(entity => new { entity.MicroLoanId, entity.InstallmentNumber }).IsUnique();
    schedule.HasOne(entity => entity.MicroLoan)
        .WithMany(entity => entity.AmortizationSchedules)
        .HasForeignKey(entity => entity.MicroLoanId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureTransactions(ModelBuilder modelBuilder) {
    var transaction = modelBuilder.Entity<LedgerTransaction>();
    transaction.ToTable("Transactions");
    ConfigureTenantOwned(transaction);
    transaction.Property(entity => entity.TransactionType).HasMaxLength(50);
    transaction.Property(entity => entity.ReferenceNumber).HasMaxLength(100);
    transaction.Property(entity => entity.Remarks).HasMaxLength(1000);
    ConfigureMoney(transaction.Property(entity => entity.DebitAmount));
    ConfigureMoney(transaction.Property(entity => entity.CreditAmount));
    ConfigureMoney(transaction.Property(entity => entity.RunningBalance));
    transaction.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.Invoice)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.InvoiceId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.MicroLoan)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.MicroLoanId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.AmortizationSchedule)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.AmortizationScheduleId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedTransactions)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureTenantOwned<TEntity>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> builder)
      where TEntity : class, ITenantEntity {
    builder.Property(entity => entity.TenantId).IsRequired();
    builder.HasIndex(entity => entity.TenantId);
    builder.HasQueryFilter(entity => entity.TenantId == _currentTenantId);
  }

  private static void ConfigureMoney(Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<decimal> propertyBuilder, int precision = 18, int scale = 2) {
    propertyBuilder.HasPrecision(precision, scale);
  }
}
