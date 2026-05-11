using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureAuthProtectionRecords(ModelBuilder modelBuilder) {
    var authProtectionRecord = modelBuilder.Entity<AuthProtectionRecord>();
    authProtectionRecord.ToTable("AuthProtectionRecords");
    authProtectionRecord.Property(entity => entity.RecordKey).HasMaxLength(AuthProtectionRecordKeyMaxLength);
    authProtectionRecord.Property(entity => entity.Kind).HasMaxLength(AuthProtectionKindMaxLength);
    authProtectionRecord.Property(entity => entity.Scope).HasMaxLength(AuthProtectionScopeMaxLength);
    authProtectionRecord.Property(entity => entity.TenantDomainSlug).HasMaxLength(AuthProtectionTenantSlugMaxLength);
    authProtectionRecord.Property(entity => entity.IdentityHash).HasMaxLength(AuthProtectionIdentityHashMaxLength);
    authProtectionRecord.HasIndex(entity => entity.RecordKey).IsUnique();
    authProtectionRecord.HasIndex(entity => new { entity.Kind, entity.Scope, entity.TenantDomainSlug, entity.LockedUntilUtc });
    authProtectionRecord.HasIndex(entity => entity.WindowExpiresAtUtc);
  }
}
