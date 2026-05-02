using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureTenantBillingRecords(ModelBuilder modelBuilder) {
    var billingRecord = modelBuilder.Entity<TenantBillingRecord>();
    billingRecord.ToTable("TenantBillingRecords");
    ConfigureTenantOwned(billingRecord);
    billingRecord.Property(entity => entity.BillingPeriodLabel).HasMaxLength(100);
    billingRecord.Property(entity => entity.PaymentMethod).HasMaxLength(50);
    billingRecord.Property(entity => entity.ReferenceNumber).HasMaxLength(100);
    billingRecord.Property(entity => entity.Status).HasMaxLength(50);
    billingRecord.Property(entity => entity.Note).HasMaxLength(1000);
    billingRecord.Property(entity => entity.ReviewRemarks).HasMaxLength(1000);
    billingRecord.Property(entity => entity.ProofOriginalFileName).HasMaxLength(260);
    billingRecord.Property(entity => entity.ProofStoredFileName).HasMaxLength(260);
    billingRecord.Property(entity => entity.ProofContentType).HasMaxLength(120);
    billingRecord.Property(entity => entity.ProofRelativeUrl).HasMaxLength(500);
    ConfigureMoney(billingRecord.Property(entity => entity.AmountDue));
    ConfigureMoney(billingRecord.Property(entity => entity.AmountSubmitted));
    billingRecord.HasIndex(entity => new { entity.TenantId, entity.DueDateUtc });
    billingRecord.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.BillingRecords)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
    billingRecord.HasOne(entity => entity.SubmittedByUser)
        .WithMany(entity => entity.SubmittedBillingRecords)
        .HasForeignKey(entity => entity.SubmittedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }
}
