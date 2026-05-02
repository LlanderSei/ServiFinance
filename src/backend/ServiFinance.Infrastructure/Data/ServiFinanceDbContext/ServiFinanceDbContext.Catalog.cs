using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureTenant(ModelBuilder modelBuilder) {
    var tenant = modelBuilder.Entity<Tenant>();
    tenant.ToTable("Tenants");
    tenant.Property(entity => entity.Name).HasMaxLength(200);
    tenant.Property(entity => entity.Code).HasMaxLength(50);
    tenant.Property(entity => entity.DomainSlug).HasMaxLength(100);
    tenant.Property(entity => entity.BusinessSizeSegment).HasMaxLength(50);
    tenant.Property(entity => entity.SubscriptionEdition).HasMaxLength(50);
    tenant.Property(entity => entity.SubscriptionPlan).HasMaxLength(100);
    tenant.Property(entity => entity.SubscriptionStatus).HasMaxLength(100);
    tenant.Property(entity => entity.BillingProvider).HasMaxLength(50);
    tenant.Property(entity => entity.StripeCustomerId).HasMaxLength(ExternalBillingReferenceMaxLength);
    tenant.Property(entity => entity.StripeSubscriptionId).HasMaxLength(ExternalBillingReferenceMaxLength);
    tenant.HasIndex(entity => entity.Code).IsUnique();
    tenant.HasIndex(entity => entity.DomainSlug).IsUnique();
    tenant.HasOne(entity => entity.Theme)
        .WithOne(entity => entity.Tenant)
        .HasForeignKey<TenantTheme>(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureTenantThemes(ModelBuilder modelBuilder) {
    var tenantTheme = modelBuilder.Entity<TenantTheme>();
    tenantTheme.ToTable("TenantThemes");
    tenantTheme.Property(entity => entity.DisplayName).HasMaxLength(TenantDisplayNameMaxLength);
    tenantTheme.Property(entity => entity.LogoUrl).HasMaxLength(TenantLogoUrlMaxLength);
    tenantTheme.Property(entity => entity.PrimaryColor).HasMaxLength(TenantBrandColorMaxLength);
    tenantTheme.Property(entity => entity.SecondaryColor).HasMaxLength(TenantBrandColorMaxLength);
    tenantTheme.Property(entity => entity.HeaderBackgroundColor).HasMaxLength(TenantBrandColorMaxLength);
    tenantTheme.Property(entity => entity.PageBackgroundColor).HasMaxLength(TenantBrandColorMaxLength);
    ConfigureTenantOwned(tenantTheme);
    tenantTheme.HasIndex(entity => entity.TenantId).IsUnique();
  }

  private void ConfigureSubscriptionTiers(ModelBuilder modelBuilder) {
    var subscriptionTier = modelBuilder.Entity<SubscriptionTier>();
    subscriptionTier.ToTable("SubscriptionTiers");
    subscriptionTier.Property(entity => entity.Code).HasMaxLength(50);
    subscriptionTier.Property(entity => entity.DisplayName).HasMaxLength(100);
    subscriptionTier.Property(entity => entity.BusinessSizeSegment).HasMaxLength(50);
    subscriptionTier.Property(entity => entity.SubscriptionEdition).HasMaxLength(50);
    subscriptionTier.Property(entity => entity.AudienceSummary).HasMaxLength(200);
    subscriptionTier.Property(entity => entity.Description).HasMaxLength(1000);
    subscriptionTier.Property(entity => entity.PriceDisplay).HasMaxLength(100);
    subscriptionTier.Property(entity => entity.BillingLabel).HasMaxLength(100);
    subscriptionTier.Property(entity => entity.PlanSummary).HasMaxLength(300);
    subscriptionTier.Property(entity => entity.HighlightLabel).HasMaxLength(100);
    subscriptionTier.HasIndex(entity => entity.Code).IsUnique();
  }

  private void ConfigurePlatformModules(ModelBuilder modelBuilder) {
    var platformModule = modelBuilder.Entity<PlatformModule>();
    platformModule.ToTable("ModuleCatalog");
    platformModule.Property(entity => entity.Code).HasMaxLength(50);
    platformModule.Property(entity => entity.Name).HasMaxLength(150);
    platformModule.Property(entity => entity.Channel).HasMaxLength(50);
    platformModule.Property(entity => entity.Summary).HasMaxLength(300);
    platformModule.HasIndex(entity => entity.Code).IsUnique();
  }

  private void ConfigureSubscriptionTierModules(ModelBuilder modelBuilder) {
    var subscriptionTierModule = modelBuilder.Entity<SubscriptionTierModule>();
    subscriptionTierModule.ToTable("SubscriptionTierModules");
    subscriptionTierModule.Property(entity => entity.AccessLevel).HasMaxLength(30);
    subscriptionTierModule.HasIndex(entity => new { entity.SubscriptionTierId, entity.PlatformModuleId }).IsUnique();
    subscriptionTierModule.HasOne(entity => entity.SubscriptionTier)
        .WithMany(entity => entity.Modules)
        .HasForeignKey(entity => entity.SubscriptionTierId)
        .OnDelete(DeleteBehavior.Cascade);
    subscriptionTierModule.HasOne(entity => entity.PlatformModule)
        .WithMany(entity => entity.TierAssignments)
        .HasForeignKey(entity => entity.PlatformModuleId)
        .OnDelete(DeleteBehavior.Cascade);
  }
}
