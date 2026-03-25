using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ServiFinance.Infrastructure.Auth;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed class DevelopmentDataSeeder(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    ILogger<DevelopmentDataSeeder> logger) {
  public async Task SeedAsync(DevelopmentSeedOptions options, CancellationToken cancellationToken = default) {
    var platformTenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.PlatformTenantId, cancellationToken);

    if (platformTenant is null) {
      platformTenant = new Tenant {
          Id = ServiFinanceDatabaseDefaults.PlatformTenantId,
          Name = "ServiFinance Platform",
          Code = ServiFinanceDatabaseDefaults.PlatformTenantCode,
          DomainSlug = ServiFinanceDatabaseDefaults.PlatformTenantDomainSlug,
          SubscriptionPlan = "Platform",
          SubscriptionStatus = "Internal",
          CreatedAtUtc = DateTime.UtcNow,
          IsActive = true
      };

      dbContext.Tenants.Add(platformTenant);
      logger.LogInformation("Seeded platform tenant.");
    }

    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == options.TenantId, cancellationToken);

    if (tenant is null) {
      tenant = new Tenant {
          Id = options.TenantId,
          Name = "Example Domain Services",
          Code = "DEMO",
          DomainSlug = "exampledomain",
          SubscriptionPlan = "Academic",
          SubscriptionStatus = "Active",
          CreatedAtUtc = DateTime.UtcNow,
          IsActive = true
      };

      dbContext.Tenants.Add(tenant);
      logger.LogInformation("Seeded development tenant '{TenantCode}'.", tenant.Code);
    }
    else {
      tenant.DomainSlug = "exampledomain";
    }

    var superAdminRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultSuperAdminRoleId, cancellationToken);

    if (superAdminRole is null) {
      superAdminRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultSuperAdminRoleId,
          TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
          Name = "SuperAdmin",
          Description = "Root-domain platform super administrator."
      };

      dbContext.Roles.Add(superAdminRole);
      logger.LogInformation("Seeded platform superadmin role.");
    }
    else {
      superAdminRole.TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId;
    }

    var adminRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminRoleId, cancellationToken);

    if (adminRole is null) {
      adminRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminRoleId,
          TenantId = options.TenantId,
          Name = "Administrator",
          Description = "Full-access tenant administrator role."
      };

      dbContext.Roles.Add(adminRole);
      logger.LogInformation("Seeded development administrator role.");
    }
    else {
      adminRole.TenantId = options.TenantId;
    }

    var staffRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentStaffRoleId, cancellationToken);

    if (staffRole is null) {
      staffRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentStaffRoleId,
          TenantId = options.TenantId,
          Name = "Staff",
          Description = "Default staff role for service and finance users."
      };

      dbContext.Roles.Add(staffRole);
      logger.LogInformation("Seeded development staff role.");
    }
    else {
      staffRole.TenantId = options.TenantId;
    }

    var superAdminUser = await dbContext.Users
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultSuperAdminUserId, cancellationToken);

    if (superAdminUser is null) {
      superAdminUser = new AppUser {
          Id = ServiFinanceDatabaseDefaults.DefaultSuperAdminUserId,
          TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
          Email = options.SuperAdminEmail,
          FullName = "Platform Super Administrator",
          IsActive = true,
          CreatedAtUtc = DateTime.UtcNow
      };

      superAdminUser.PasswordHash = passwordHasher.HashPassword(superAdminUser, options.SuperAdminPassword);
      dbContext.Users.Add(superAdminUser);
      logger.LogInformation("Seeded superadmin user '{Email}'.", superAdminUser.Email);
    }
    else {
      superAdminUser.TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId;
      superAdminUser.Email = options.SuperAdminEmail;
      superAdminUser.PasswordHash = passwordHasher.HashPassword(superAdminUser, options.SuperAdminPassword);
      superAdminUser.IsActive = true;
    }

    var adminUser = await dbContext.Users
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminUserId, cancellationToken);

    if (adminUser is null) {
      adminUser = new AppUser {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminUserId,
          TenantId = options.TenantId,
          Email = options.AdminEmail,
          FullName = "Development Administrator",
          IsActive = true,
          CreatedAtUtc = DateTime.UtcNow
      };

      adminUser.PasswordHash = passwordHasher.HashPassword(adminUser, options.AdminPassword);
      dbContext.Users.Add(adminUser);
      logger.LogInformation("Seeded development administrator user '{AdminEmail}'.", adminUser.Email);
    }
    else {
      adminUser.TenantId = options.TenantId;
      adminUser.Email = options.AdminEmail;
      adminUser.PasswordHash = passwordHasher.HashPassword(adminUser, options.AdminPassword);
      adminUser.IsActive = true;
    }

    var userRole = await dbContext.UserRoles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.UserId == adminUser.Id && entity.RoleId == adminRole.Id, cancellationToken);

    if (userRole is null) {
      dbContext.UserRoles.Add(new UserRole {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminUserRoleId,
          TenantId = options.TenantId,
          UserId = adminUser.Id,
          RoleId = adminRole.Id,
          AssignedAtUtc = DateTime.UtcNow
      });

      logger.LogInformation("Linked development administrator user to administrator role.");
    }
    else {
      userRole.TenantId = options.TenantId;
      userRole.RoleId = adminRole.Id;
      userRole.UserId = adminUser.Id;
    }

    var superAdminUserRole = await dbContext.UserRoles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(
            entity => entity.UserId == superAdminUser.Id && entity.RoleId == superAdminRole.Id,
            cancellationToken);

    if (superAdminUserRole is null) {
      dbContext.UserRoles.Add(new UserRole {
          Id = ServiFinanceDatabaseDefaults.DefaultSuperAdminUserRoleId,
          TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
          UserId = superAdminUser.Id,
          RoleId = superAdminRole.Id,
          AssignedAtUtc = DateTime.UtcNow
      });

      logger.LogInformation("Linked superadmin user to superadmin role.");
    }
    else {
      superAdminUserRole.TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId;
      superAdminUserRole.RoleId = superAdminRole.Id;
      superAdminUserRole.UserId = superAdminUser.Id;
    }

    await dbContext.SaveChangesAsync(cancellationToken);
  }
}
