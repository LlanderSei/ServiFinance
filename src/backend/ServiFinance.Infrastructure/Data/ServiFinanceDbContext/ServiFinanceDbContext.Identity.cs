using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureUsers(ModelBuilder modelBuilder) {
    var user = modelBuilder.Entity<AppUser>();
    user.ToTable("Users");
    ConfigureTenantOwned(user);
    user.Property(entity => entity.Email).HasMaxLength(EmailMaxLength);
    user.Property(entity => entity.PasswordHash).HasMaxLength(PasswordHashMaxLength);
    user.Property(entity => entity.FullName).HasMaxLength(200);
    user.HasIndex(entity => entity.Email).IsUnique();
    user.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.Users)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureRefreshSessions(ModelBuilder modelBuilder) {
    var refreshSession = modelBuilder.Entity<RefreshSession>();
    refreshSession.ToTable("RefreshSessions");
    refreshSession.Property(entity => entity.Surface).HasMaxLength(50);
    refreshSession.Property(entity => entity.RefreshTokenHash).HasMaxLength(128);
    refreshSession.HasIndex(entity => entity.RefreshTokenHash).IsUnique();
    refreshSession.HasIndex(entity => entity.ExpiresAtUtc);
    refreshSession.HasOne(entity => entity.User)
        .WithMany(entity => entity.RefreshSessions)
        .HasForeignKey(entity => entity.UserId)
        .IsRequired(false)
        .OnDelete(DeleteBehavior.SetNull);
    refreshSession.HasOne(entity => entity.Customer)
        .WithMany()
        .HasForeignKey(entity => entity.CustomerId)
        .IsRequired(false)
        .OnDelete(DeleteBehavior.SetNull);
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
}
