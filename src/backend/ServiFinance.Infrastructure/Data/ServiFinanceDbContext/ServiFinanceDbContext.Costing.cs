using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureTenantCostingPolicies(ModelBuilder modelBuilder) {
    var policy = modelBuilder.Entity<TenantCostingPolicy>();
    policy.ToTable("TenantCostingPolicies");
    ConfigureTenantOwned(policy);
    policy.Property(entity => entity.TaxLabel).HasMaxLength(80);
    ConfigureMoney(policy.Property(entity => entity.DefaultTaxRate), 6, 2);
    policy.HasIndex(entity => entity.TenantId).IsUnique();
    policy.HasOne(entity => entity.Tenant)
        .WithOne(entity => entity.CostingPolicy)
        .HasForeignKey<TenantCostingPolicy>(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureServiceCostPresets(ModelBuilder modelBuilder) {
    var preset = modelBuilder.Entity<ServiceCostPreset>();
    preset.ToTable("ServiceCostPresets");
    ConfigureTenantOwned(preset);
    preset.Property(entity => entity.Category).HasMaxLength(50);
    preset.Property(entity => entity.Name).HasMaxLength(160);
    preset.Property(entity => entity.DefaultSpecification).HasMaxLength(300);
    ConfigureMoney(preset.Property(entity => entity.DefaultQuantity), 10, 2);
    ConfigureMoney(preset.Property(entity => entity.DefaultUnitPrice));
    preset.HasIndex(entity => new { entity.TenantId, entity.Category, entity.SortOrder });
    preset.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.ServiceCostPresets)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureServiceCostSheets(ModelBuilder modelBuilder) {
    var sheet = modelBuilder.Entity<ServiceCostSheet>();
    sheet.ToTable("ServiceCostSheets");
    ConfigureTenantOwned(sheet);
    sheet.Property(entity => entity.Status).HasMaxLength(50);
    sheet.Property(entity => entity.TaxLabel).HasMaxLength(80);
    sheet.Property(entity => entity.Notes).HasMaxLength(1000);
    ConfigureMoney(sheet.Property(entity => entity.TaxRate), 6, 2);
    sheet.HasIndex(entity => entity.ServiceRequestId).IsUnique();
    sheet.HasOne(entity => entity.ServiceRequest)
        .WithOne(entity => entity.CostSheet)
        .HasForeignKey<ServiceCostSheet>(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureServiceCostLines(ModelBuilder modelBuilder) {
    var line = modelBuilder.Entity<ServiceCostLine>();
    line.ToTable("ServiceCostLines");
    ConfigureTenantOwned(line);
    line.Property(entity => entity.Category).HasMaxLength(50);
    line.Property(entity => entity.Name).HasMaxLength(160);
    line.Property(entity => entity.Specification).HasMaxLength(300);
    ConfigureMoney(line.Property(entity => entity.Quantity), 10, 2);
    ConfigureMoney(line.Property(entity => entity.UnitPrice));
    line.HasIndex(entity => new { entity.ServiceCostSheetId, entity.SortOrder });
    line.HasOne(entity => entity.ServiceCostSheet)
        .WithMany(entity => entity.Lines)
        .HasForeignKey(entity => entity.ServiceCostSheetId)
        .OnDelete(DeleteBehavior.Cascade);
    line.HasOne(entity => entity.ServiceCostPreset)
        .WithMany(entity => entity.CostLines)
        .HasForeignKey(entity => entity.ServiceCostPresetId)
        .OnDelete(DeleteBehavior.SetNull);
  }
}
