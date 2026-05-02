using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureAuditEvents(ModelBuilder modelBuilder) {
    var auditEvent = modelBuilder.Entity<AuditEvent>();
    auditEvent.ToTable("AuditEvents");
    ConfigureTenantOwned(auditEvent);
    auditEvent.Property(entity => entity.Scope).HasMaxLength(50);
    auditEvent.Property(entity => entity.Category).HasMaxLength(50);
    auditEvent.Property(entity => entity.ActionType).HasMaxLength(100);
    auditEvent.Property(entity => entity.Outcome).HasMaxLength(50);
    auditEvent.Property(entity => entity.ActorName).HasMaxLength(200);
    auditEvent.Property(entity => entity.ActorEmail).HasMaxLength(EmailMaxLength);
    auditEvent.Property(entity => entity.SubjectType).HasMaxLength(100);
    auditEvent.Property(entity => entity.SubjectLabel).HasMaxLength(300);
    auditEvent.Property(entity => entity.Detail).HasMaxLength(1000);
    auditEvent.Property(entity => entity.IpAddress).HasMaxLength(80);
    auditEvent.Property(entity => entity.UserAgent).HasMaxLength(500);
    auditEvent.HasIndex(entity => new { entity.TenantId, entity.Scope, entity.Category, entity.OccurredAtUtc });
    auditEvent.HasOne(entity => entity.Tenant)
        .WithMany()
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
    auditEvent.HasOne(entity => entity.ActorUser)
        .WithMany()
        .HasForeignKey(entity => entity.ActorUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }
}
