using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;

namespace ServiFinance.Infrastructure.Data;

public sealed class DevelopmentDataSeeder(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    ILogger<DevelopmentDataSeeder> logger) {
  public async Task SeedAsync(DevelopmentSeedOptions options, CancellationToken cancellationToken = default) {
    var tierSeeds = GetSubscriptionTierSeeds();
    var moduleSeeds = GetPlatformModuleSeeds();
    var tierModuleSeeds = GetTierModuleSeeds();

    var tiersById = await dbContext.SubscriptionTiers
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);
    var modulesByCode = await dbContext.PlatformModules
        .ToDictionaryAsync(entity => entity.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);
    var tierModulesByKey = await dbContext.SubscriptionTierModules
        .ToDictionaryAsync(
            entity => (entity.SubscriptionTierId, entity.PlatformModuleId),
            cancellationToken);

    foreach (var seed in tierSeeds) {
      if (!tiersById.TryGetValue(seed.Id, out var tier)) {
        tier = new SubscriptionTier {
            Id = seed.Id
        };
        dbContext.SubscriptionTiers.Add(tier);
        tiersById[seed.Id] = tier;
        logger.LogInformation("Seeded subscription tier '{TierCode}'.", seed.Code);
      }

      tier.Code = seed.Code;
      tier.DisplayName = seed.DisplayName;
      tier.BusinessSizeSegment = seed.BusinessSizeSegment;
      tier.SubscriptionEdition = seed.SubscriptionEdition;
      tier.AudienceSummary = seed.AudienceSummary;
      tier.Description = seed.Description;
      tier.PriceDisplay = seed.PriceDisplay;
      tier.BillingLabel = seed.BillingLabel;
      tier.PlanSummary = seed.PlanSummary;
      tier.HighlightLabel = seed.HighlightLabel;
      tier.SortOrder = seed.SortOrder;
      tier.IncludesServiceManagementWeb = seed.IncludesServiceManagementWeb;
      tier.IncludesMicroLendingDesktop = seed.IncludesMicroLendingDesktop;
      tier.IsActive = true;
    }

    foreach (var seed in moduleSeeds) {
      if (!modulesByCode.TryGetValue(seed.Code, out var module)) {
        module = new PlatformModule();
        dbContext.PlatformModules.Add(module);
        modulesByCode[seed.Code] = module;
        logger.LogInformation("Seeded platform module '{ModuleCode}'.", seed.Code);
      }

      module.Code = seed.Code;
      module.Name = seed.Name;
      module.Channel = seed.Channel;
      module.Summary = seed.Summary;
      module.SortOrder = seed.SortOrder;
      module.IsActive = true;
    }

    var seededTierModuleKeys = new HashSet<(Guid TierId, Guid ModuleId)>();
    foreach (var seed in tierModuleSeeds) {
      var tier = tiersById[seed.SubscriptionTierId];
      var module = modulesByCode[seed.ModuleCode];
      var key = (tier.Id, module.Id);
      seededTierModuleKeys.Add(key);

      if (!tierModulesByKey.TryGetValue(key, out var tierModule)) {
        tierModule = new SubscriptionTierModule {
            SubscriptionTierId = tier.Id,
            PlatformModuleId = module.Id
        };
        dbContext.SubscriptionTierModules.Add(tierModule);
        tierModulesByKey[key] = tierModule;
      }

      tierModule.SubscriptionTierId = tier.Id;
      tierModule.PlatformModuleId = module.Id;
      tierModule.AccessLevel = seed.AccessLevel;
      tierModule.SortOrder = seed.SortOrder;
    }

    foreach (var existingTierModule in tierModulesByKey.Values) {
      var key = (existingTierModule.SubscriptionTierId, existingTierModule.PlatformModuleId);
      if (!seededTierModuleKeys.Contains(key)) {
        dbContext.SubscriptionTierModules.Remove(existingTierModule);
      }
    }

    var platformTenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.PlatformTenantId, cancellationToken);

    if (platformTenant is null) {
      platformTenant = new Tenant {
          Id = ServiFinanceDatabaseDefaults.PlatformTenantId,
          CreatedAtUtc = DateTime.UtcNow
      };

      dbContext.Tenants.Add(platformTenant);
      logger.LogInformation("Seeded platform tenant.");
    }

    platformTenant.Name = "ServiFinance Platform";
    platformTenant.Code = ServiFinanceDatabaseDefaults.PlatformTenantCode;
    platformTenant.DomainSlug = ServiFinanceDatabaseDefaults.PlatformTenantDomainSlug;
    platformTenant.BusinessSizeSegment = "Platform";
    platformTenant.SubscriptionEdition = "Internal";
    platformTenant.SubscriptionPlan = "Platform";
    platformTenant.SubscriptionStatus = "Internal";
    platformTenant.IsActive = true;

    var developmentTier = tiersById[ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId];
    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == options.TenantId, cancellationToken);

    if (tenant is null) {
      tenant = new Tenant {
          Id = options.TenantId,
          CreatedAtUtc = DateTime.UtcNow
      };

      dbContext.Tenants.Add(tenant);
      logger.LogInformation("Seeded development tenant '{TenantCode}'.", "DEMO");
    }

    tenant.Name = "Example Domain Services";
    tenant.Code = "DEMO";
    tenant.DomainSlug = "exampledomain";
    tenant.BusinessSizeSegment = developmentTier.BusinessSizeSegment;
    tenant.SubscriptionEdition = developmentTier.SubscriptionEdition;
    tenant.SubscriptionPlan = developmentTier.DisplayName;
    tenant.SubscriptionStatus = "Active";
    tenant.IsActive = true;

    var superAdminRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultSuperAdminRoleId, cancellationToken);

    if (superAdminRole is null) {
      superAdminRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultSuperAdminRoleId,
          Name = "SuperAdmin",
          Description = "Root-domain platform super administrator."
      };

      dbContext.Roles.Add(superAdminRole);
      logger.LogInformation("Seeded platform superadmin role.");
    }

    superAdminRole.TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId;

    var adminRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminRoleId, cancellationToken);

    if (adminRole is null) {
      adminRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminRoleId,
          Name = "Administrator",
          Description = "Full-access tenant administrator role."
      };

      dbContext.Roles.Add(adminRole);
      logger.LogInformation("Seeded development administrator role.");
    }

    adminRole.TenantId = options.TenantId;

    var staffRole = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentStaffRoleId, cancellationToken);

    if (staffRole is null) {
      staffRole = new Role {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentStaffRoleId,
          Name = "Staff",
          Description = "Default staff role for service and finance users."
      };

      dbContext.Roles.Add(staffRole);
      logger.LogInformation("Seeded development staff role.");
    }

    staffRole.TenantId = options.TenantId;

    var superAdminUser = await dbContext.Users
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultSuperAdminUserId, cancellationToken);

    if (superAdminUser is null) {
      superAdminUser = new AppUser {
          Id = ServiFinanceDatabaseDefaults.DefaultSuperAdminUserId,
          FullName = "Platform Super Administrator",
          CreatedAtUtc = DateTime.UtcNow
      };

      dbContext.Users.Add(superAdminUser);
      logger.LogInformation("Seeded superadmin user '{Email}'.", options.SuperAdminEmail);
    }

    superAdminUser.TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId;
    superAdminUser.Email = options.SuperAdminEmail;
    superAdminUser.PasswordHash = passwordHasher.HashPassword(superAdminUser, options.SuperAdminPassword);
    superAdminUser.IsActive = true;

    var adminUser = await dbContext.Users
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminUserId, cancellationToken);

    if (adminUser is null) {
      adminUser = new AppUser {
          Id = ServiFinanceDatabaseDefaults.DefaultDevelopmentAdminUserId,
          FullName = "Development Administrator",
          CreatedAtUtc = DateTime.UtcNow
      };

      dbContext.Users.Add(adminUser);
      logger.LogInformation("Seeded development administrator user '{AdminEmail}'.", options.AdminEmail);
    }

    adminUser.TenantId = options.TenantId;
    adminUser.Email = options.AdminEmail;
    adminUser.PasswordHash = passwordHasher.HashPassword(adminUser, options.AdminPassword);
    adminUser.IsActive = true;

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

  private static IReadOnlyList<SubscriptionTierSeed> GetSubscriptionTierSeeds() => [
      new(
          ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId,
          "MICRO_STANDARD",
          "Micro Standard",
          "Micro",
          "Standard",
          "For micro-businesses that need browser-based intake, status updates, and invoicing without desktop finance tools.",
          "Keep service work moving with a lean web workflow for intake, dispatch, and invoicing.",
          "Starts at PHP 1,490",
          "per tenant / month",
          "Lean web operations for micro service teams.",
          "Micro / Web Only",
          10,
          true,
          false),
      new(
          ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId,
          "MICRO_PREMIUM",
          "Micro Premium",
          "Micro",
          "Premium",
          "For micro-businesses that need service-linked lending from the same tenant operating model.",
          "Add desktop loan conversion, payment posting, and a simplified finance view to the micro service workflow.",
          "Starts at PHP 2,990",
          "per tenant / month",
          "Micro service operations plus service-linked lending.",
          "Micro / Web + Desktop",
          20,
          true,
          true),
      new(
          ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId,
          "SMALL_STANDARD",
          "Small Standard",
          "Small",
          "Standard",
          "For growing teams that need the full service-management workflow on the web.",
          "Run service intake, staffing, scheduling, job updates, invoicing, and reporting from a fuller web workspace.",
          "Starts at PHP 2,490",
          "per tenant / month",
          "Full web operations baseline for small teams.",
          "Small / Web Only",
          30,
          true,
          false),
      new(
          ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId,
          "SMALL_PREMIUM",
          "Small Premium",
          "Small",
          "Premium",
          "For small businesses combining service workflows with repeatable lending and collections work.",
          "Pair the full web service suite with desktop lending, payment posting, and a practical collections queue.",
          "Starts at PHP 4,490",
          "per tenant / month",
          "Full web and finance stack for small operations.",
          "Small / Web + Desktop",
          40,
          true,
          true),
      new(
          ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId,
          "MEDIUM_STANDARD",
          "Medium Standard",
          "Medium",
          "Standard",
          "For medium enterprises that need stronger operational visibility without desktop lending.",
          "Use the full service web suite with reporting and workforce visibility for broader teams.",
          "Starts at PHP 3,990",
          "per tenant / month",
          "Expanded web operations for medium teams.",
          "Medium / Web Only",
          50,
          true,
          false),
      new(
          ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId,
          "MEDIUM_PREMIUM",
          "Medium Premium",
          "Medium",
          "Premium",
          "For medium enterprises that need the broadest service and finance control surface, including audit visibility.",
          "Combine the full service web suite with desktop lending, collections, reporting, and audit review.",
          "Starts at PHP 6,990",
          "per tenant / month",
          "Full operational and finance control for medium enterprises.",
          "Medium / Web + Desktop",
          60,
          true,
          true)
  ];

  private static IReadOnlyList<PlatformModuleSeed> GetPlatformModuleSeeds() => [
      new("W1_SERVICE_INTAKE", "Service Intake And Customer Records", "Web", "Capture service requests and maintain customer records.", 10),
      new("W2_STAFF_ACCOUNTS", "Staff Accounts And Role Assignment", "Web", "Manage tenant staff accounts and role assignments.", 20),
      new("W3_SCHEDULING", "Scheduling And Dispatch", "Web", "Schedule jobs and assign field or workshop work.", 30),
      new("W4_JOB_UPDATES", "Job Status Updates And Job Photos", "Web", "Track service status updates and attach job photos.", 40),
      new("W5_INVOICING", "Invoicing And Customer Self-Service", "Web", "Create invoices and let customers track or pay service work.", 50),
      new("W6_REPORTS", "Operational Reports", "Web", "Review service activity, status, and summary reporting.", 60),
      new("W7_WORKFORCE_OVERVIEW", "Workforce Overview", "Web", "View technician workload, pending jobs, and daily assignment pressure.", 70),
      new("D1_SERVICE_LINKED_LOANS", "Service-Linked Micro-Loan Processing", "Desktop", "Convert service invoices into micro-loans from the desktop terminal.", 110),
      new("D2_STANDALONE_LOANS", "Standalone Loan Processing", "Desktop", "Create and manage standalone loans outside the service invoice flow.", 120),
      new("D3_FINANCIAL_RECORDS", "Customer Financial Records", "Desktop", "Review customer finance history, balances, and account state.", 130),
      new("D4_AMORTIZATION", "Amortization And Payment Posting", "Desktop", "Generate amortization schedules and post payments.", 140),
      new("D5_LEDGER_REPORTS", "Financial And Ledger Reports", "Desktop", "Review loan summaries, ledger reports, and transaction history.", 150),
      new("D6_AUDIT_LOGS", "Audit Log Review", "Desktop", "Review finance-side audit and activity history.", 160),
      new("D7_COLLECTIONS_QUEUE", "Collections Queue", "Desktop", "Review due, overdue, and partially paid accounts for follow-up.", 170)
  ];

  private static IReadOnlyList<TierModuleSeed> GetTierModuleSeeds() => [
      new(ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Limited", 20),
      new(ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId, "W3_SCHEDULING", "Limited", 30),
      new(ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId, "W4_JOB_UPDATES", "Limited", 40),
      new(ServiFinanceDatabaseDefaults.MicroStandardSubscriptionTierId, "W5_INVOICING", "Included", 50),

      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Limited", 20),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "W3_SCHEDULING", "Limited", 30),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "W4_JOB_UPDATES", "Limited", 40),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "W5_INVOICING", "Included", 50),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "D1_SERVICE_LINKED_LOANS", "Included", 110),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "D3_FINANCIAL_RECORDS", "Limited", 130),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "D4_AMORTIZATION", "Included", 140),
      new(ServiFinanceDatabaseDefaults.MicroPremiumSubscriptionTierId, "D5_LEDGER_REPORTS", "Limited", 150),

      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Included", 20),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W3_SCHEDULING", "Included", 30),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W4_JOB_UPDATES", "Included", 40),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W5_INVOICING", "Included", 50),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W6_REPORTS", "Included", 60),
      new(ServiFinanceDatabaseDefaults.SmallStandardSubscriptionTierId, "W7_WORKFORCE_OVERVIEW", "Included", 70),

      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Included", 20),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W3_SCHEDULING", "Included", 30),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W4_JOB_UPDATES", "Included", 40),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W5_INVOICING", "Included", 50),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W6_REPORTS", "Included", 60),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "W7_WORKFORCE_OVERVIEW", "Included", 70),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D1_SERVICE_LINKED_LOANS", "Included", 110),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D2_STANDALONE_LOANS", "Included", 120),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D3_FINANCIAL_RECORDS", "Included", 130),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D4_AMORTIZATION", "Included", 140),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D5_LEDGER_REPORTS", "Included", 150),
      new(ServiFinanceDatabaseDefaults.SmallPremiumSubscriptionTierId, "D7_COLLECTIONS_QUEUE", "Included", 170),

      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Included", 20),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W3_SCHEDULING", "Included", 30),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W4_JOB_UPDATES", "Included", 40),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W5_INVOICING", "Included", 50),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W6_REPORTS", "Included", 60),
      new(ServiFinanceDatabaseDefaults.MediumStandardSubscriptionTierId, "W7_WORKFORCE_OVERVIEW", "Included", 70),

      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W1_SERVICE_INTAKE", "Included", 10),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W2_STAFF_ACCOUNTS", "Included", 20),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W3_SCHEDULING", "Included", 30),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W4_JOB_UPDATES", "Included", 40),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W5_INVOICING", "Included", 50),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W6_REPORTS", "Included", 60),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "W7_WORKFORCE_OVERVIEW", "Included", 70),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D1_SERVICE_LINKED_LOANS", "Included", 110),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D2_STANDALONE_LOANS", "Included", 120),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D3_FINANCIAL_RECORDS", "Included", 130),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D4_AMORTIZATION", "Included", 140),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D5_LEDGER_REPORTS", "Included", 150),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D6_AUDIT_LOGS", "Included", 160),
      new(ServiFinanceDatabaseDefaults.MediumPremiumSubscriptionTierId, "D7_COLLECTIONS_QUEUE", "Included", 170)
  ];

  private sealed record SubscriptionTierSeed(
      Guid Id,
      string Code,
      string DisplayName,
      string BusinessSizeSegment,
      string SubscriptionEdition,
      string AudienceSummary,
      string Description,
      string PriceDisplay,
      string BillingLabel,
      string PlanSummary,
      string HighlightLabel,
      int SortOrder,
      bool IncludesServiceManagementWeb,
      bool IncludesMicroLendingDesktop);

  private sealed record PlatformModuleSeed(
      string Code,
      string Name,
      string Channel,
      string Summary,
      int SortOrder);

  private sealed record TierModuleSeed(
      Guid SubscriptionTierId,
      string ModuleCode,
      string AccessLevel,
      int SortOrder);
}
