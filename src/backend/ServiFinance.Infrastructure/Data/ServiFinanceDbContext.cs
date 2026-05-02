using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ServiFinance.Application.Tenancy;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext : DbContext {
  private const int EmailMaxLength = 50;
  private const int PasswordHashMaxLength = 512;
  private const int FeedbackCommentsMaxLength = 1000;
  private const int TenantDisplayNameMaxLength = 200;
  private const int TenantBrandColorMaxLength = 20;
  private const int TenantLogoUrlMaxLength = 500;
  private const int ExternalBillingReferenceMaxLength = 200;

  private readonly Guid _currentTenantId;
  private readonly bool _hasRequestContext;

  public ServiFinanceDbContext(
      DbContextOptions<ServiFinanceDbContext> options,
      ITenantProvider tenantProvider)
      : base(options) {
    _currentTenantId = tenantProvider.CurrentTenantId;
    _hasRequestContext = tenantProvider.HasRequestContext;
  }

  public DbSet<Tenant> Tenants => Set<Tenant>();
  public DbSet<TenantTheme> TenantThemes => Set<TenantTheme>();
  public DbSet<PlatformTenantRegistration> PlatformTenantRegistrations => Set<PlatformTenantRegistration>();
  public DbSet<SubscriptionTier> SubscriptionTiers => Set<SubscriptionTier>();
  public DbSet<PlatformModule> PlatformModules => Set<PlatformModule>();
  public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
  public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
  public DbSet<SubscriptionTierModule> SubscriptionTierModules => Set<SubscriptionTierModule>();
  public DbSet<AppUser> Users => Set<AppUser>();
  public DbSet<Role> Roles => Set<Role>();
  public DbSet<UserRole> UserRoles => Set<UserRole>();
  public DbSet<Customer> Customers => Set<Customer>();
  public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
  public DbSet<StatusLog> StatusLogs => Set<StatusLog>();
  public DbSet<Assignment> Assignments => Set<Assignment>();
  public DbSet<AssignmentEvent> AssignmentEvents => Set<AssignmentEvent>();
  public DbSet<AssignmentEvidence> AssignmentEvidenceItems => Set<AssignmentEvidence>();
  public DbSet<TenantBillingRecord> TenantBillingRecords => Set<TenantBillingRecord>();
  public DbSet<Invoice> Invoices => Set<Invoice>();
  public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
  public DbSet<MicroLoan> MicroLoans => Set<MicroLoan>();
  public DbSet<AmortizationSchedule> AmortizationSchedules => Set<AmortizationSchedule>();
  public DbSet<LedgerTransaction> Transactions => Set<LedgerTransaction>();

  protected override void OnModelCreating(ModelBuilder modelBuilder) {
    ConfigureTenant(modelBuilder);
    ConfigureTenantThemes(modelBuilder);
    ConfigurePlatformTenantRegistrations(modelBuilder);
    ConfigureSubscriptionTiers(modelBuilder);
    ConfigurePlatformModules(modelBuilder);
    ConfigureRefreshSessions(modelBuilder);
    ConfigureAuditEvents(modelBuilder);
    ConfigureSubscriptionTierModules(modelBuilder);
    ConfigureUsers(modelBuilder);
    ConfigureRoles(modelBuilder);
    ConfigureUserRoles(modelBuilder);
    ConfigureCustomers(modelBuilder);
    ConfigureServiceRequests(modelBuilder);
    ConfigureStatusLogs(modelBuilder);
    ConfigureAssignments(modelBuilder);
    ConfigureAssignmentEvents(modelBuilder);
    ConfigureAssignmentEvidence(modelBuilder);
    ConfigureTenantBillingRecords(modelBuilder);
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

  private void ConfigureTenantOwned<TEntity>(EntityTypeBuilder<TEntity> builder)
      where TEntity : class, ITenantEntity {
    builder.Property(entity => entity.TenantId).IsRequired();
    builder.HasIndex(entity => entity.TenantId);
    builder.HasQueryFilter(entity => entity.TenantId == _currentTenantId);
  }

  private static void ConfigureMoney(PropertyBuilder<decimal> propertyBuilder, int precision = 12, int scale = 2) {
    propertyBuilder.HasPrecision(precision, scale);
  }
}
