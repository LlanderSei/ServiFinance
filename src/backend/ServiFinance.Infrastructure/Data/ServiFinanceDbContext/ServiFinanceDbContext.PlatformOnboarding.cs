using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigurePlatformTenantRegistrations(ModelBuilder modelBuilder) {
    var registration = modelBuilder.Entity<PlatformTenantRegistration>();
    registration.ToTable("PlatformTenantRegistrations");
    registration.Property(entity => entity.BusinessName).HasMaxLength(200);
    registration.Property(entity => entity.TenantCode).HasMaxLength(50);
    registration.Property(entity => entity.DomainSlug).HasMaxLength(100);
    registration.Property(entity => entity.OwnerFullName).HasMaxLength(200);
    registration.Property(entity => entity.OwnerEmail).HasMaxLength(EmailMaxLength);
    registration.Property(entity => entity.OwnerPasswordHash).HasMaxLength(PasswordHashMaxLength);
    registration.Property(entity => entity.Status).HasMaxLength(50);
    registration.Property(entity => entity.StripeCheckoutSessionId).HasMaxLength(ExternalBillingReferenceMaxLength);
    registration.Property(entity => entity.StripeCustomerId).HasMaxLength(ExternalBillingReferenceMaxLength);
    registration.Property(entity => entity.StripeSubscriptionId).HasMaxLength(ExternalBillingReferenceMaxLength);
    registration.Property(entity => entity.FailureReason).HasMaxLength(500);
    registration.HasIndex(entity => entity.DomainSlug);
    registration.HasIndex(entity => entity.OwnerEmail);
    registration.HasIndex(entity => entity.Status);
    registration.HasIndex(entity => entity.StripeCheckoutSessionId).IsUnique();
    registration.HasIndex(entity => entity.StripeSubscriptionId).IsUnique();
    registration.HasOne(entity => entity.SubscriptionTier)
        .WithMany()
        .HasForeignKey(entity => entity.SubscriptionTierId)
        .OnDelete(DeleteBehavior.Restrict);
    registration.HasOne(entity => entity.Tenant)
        .WithMany()
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.SetNull);
  }
}
