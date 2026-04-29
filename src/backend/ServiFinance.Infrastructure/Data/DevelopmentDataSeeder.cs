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
    IPasswordHasher<Customer> customerPasswordHasher,
    ILogger<DevelopmentDataSeeder> logger) {
  public async Task SeedAsync(DevelopmentSeedOptions options, CancellationToken cancellationToken = default) {
    var tierSeeds = GetSubscriptionTierSeeds();
    var moduleSeeds = GetPlatformModuleSeeds();
    var tierModuleSeeds = GetTierModuleSeeds();
    var customerSeeds = GetDevelopmentCustomerSeeds();
    var serviceRequestSeeds = GetDevelopmentServiceRequestSeeds();
    var invoiceSeeds = GetDevelopmentInvoiceSeeds();
    var staffUserSeeds = GetDevelopmentStaffUserSeeds();
    var assignmentSeeds = GetDevelopmentAssignmentSeeds();

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

    var tenantUsersById = await dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == options.TenantId)
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);

    tenantUsersById[adminUser.Id] = adminUser;

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

    foreach (var seed in staffUserSeeds) {
      if (!tenantUsersById.TryGetValue(seed.Id, out var staffUser)) {
        staffUser = new AppUser {
            Id = seed.Id,
            TenantId = options.TenantId,
            CreatedAtUtc = seed.CreatedAtUtc
        };
        dbContext.Users.Add(staffUser);
        tenantUsersById[seed.Id] = staffUser;
        logger.LogInformation("Seeded development staff user '{Email}'.", seed.Email);
      }

      staffUser.TenantId = options.TenantId;
      staffUser.FullName = seed.FullName;
      staffUser.Email = seed.Email;
      staffUser.PasswordHash = passwordHasher.HashPassword(staffUser, options.AdminPassword);
      staffUser.IsActive = true;
      staffUser.CreatedAtUtc = seed.CreatedAtUtc;

      var staffUserRole = await dbContext.UserRoles
          .IgnoreQueryFilters()
          .SingleOrDefaultAsync(entity => entity.UserId == staffUser.Id && entity.RoleId == staffRole.Id, cancellationToken);

      if (staffUserRole is null) {
        dbContext.UserRoles.Add(new UserRole {
            Id = seed.UserRoleId,
            TenantId = options.TenantId,
            UserId = staffUser.Id,
            RoleId = staffRole.Id,
            AssignedAtUtc = DateTime.UtcNow
        });

        logger.LogInformation("Linked development staff user '{Email}' to staff role.", seed.Email);
      }
      else {
        staffUserRole.TenantId = options.TenantId;
        staffUserRole.UserId = staffUser.Id;
        staffUserRole.RoleId = staffRole.Id;
      }
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

    var customersById = await dbContext.Customers
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == options.TenantId)
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);

    foreach (var seed in customerSeeds) {
      if (!customersById.TryGetValue(seed.Id, out var customer)) {
        customer = new Customer {
            Id = seed.Id,
            TenantId = options.TenantId
        };
        dbContext.Customers.Add(customer);
        customersById[seed.Id] = customer;
        logger.LogInformation("Seeded development customer '{CustomerCode}'.", seed.CustomerCode);
      }

      customer.TenantId = options.TenantId;
      customer.CustomerCode = seed.CustomerCode;
      customer.FullName = seed.FullName;
      customer.MobileNumber = seed.MobileNumber;
      customer.Email = seed.Email;
      
      var firstName = seed.FullName.Split(' ')[0];
      customer.PasswordHash = customerPasswordHasher.HashPassword(customer, firstName);
      
      customer.Address = seed.Address;
      customer.CreatedAtUtc = seed.CreatedAtUtc;
    }

    var serviceRequestsById = await dbContext.ServiceRequests
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == options.TenantId)
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);

    foreach (var seed in serviceRequestSeeds) {
      if (!serviceRequestsById.TryGetValue(seed.Id, out var serviceRequest)) {
        serviceRequest = new ServiceRequest {
            Id = seed.Id,
            TenantId = options.TenantId
        };
        dbContext.ServiceRequests.Add(serviceRequest);
        serviceRequestsById[seed.Id] = serviceRequest;
        logger.LogInformation("Seeded development service request '{RequestNumber}'.", seed.RequestNumber);
      }

      serviceRequest.TenantId = options.TenantId;
      serviceRequest.CustomerId = seed.CustomerId;
      serviceRequest.RequestNumber = seed.RequestNumber;
      serviceRequest.ItemType = seed.ItemType;
      serviceRequest.ItemDescription = seed.ItemDescription;
      serviceRequest.IssueDescription = seed.IssueDescription;
      serviceRequest.RequestedServiceDate = seed.RequestedServiceDate;
      serviceRequest.Priority = seed.Priority;
      serviceRequest.CurrentStatus = seed.CurrentStatus;
      serviceRequest.CreatedByUserId = adminUser.Id;
      serviceRequest.CreatedAtUtc = seed.CreatedAtUtc;
    }

    var invoicesById = await dbContext.Invoices
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == options.TenantId)
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);

    foreach (var seed in invoiceSeeds) {
      if (!invoicesById.TryGetValue(seed.Id, out var invoice)) {
        invoice = new Invoice {
            Id = seed.Id,
            TenantId = options.TenantId
        };
        dbContext.Invoices.Add(invoice);
        invoicesById[seed.Id] = invoice;
        logger.LogInformation("Seeded development invoice '{InvoiceNumber}'.", seed.InvoiceNumber);
      }

      invoice.TenantId = options.TenantId;
      invoice.CustomerId = seed.CustomerId;
      invoice.ServiceRequestId = seed.ServiceRequestId;
      invoice.InvoiceNumber = seed.InvoiceNumber;
      invoice.InvoiceDateUtc = seed.InvoiceDateUtc;
      invoice.SubtotalAmount = seed.SubtotalAmount;
      invoice.InterestableAmount = seed.InterestableAmount;
      invoice.DiscountAmount = seed.DiscountAmount;
      invoice.TotalAmount = seed.TotalAmount;
      invoice.OutstandingAmount = seed.OutstandingAmount;
      invoice.InvoiceStatus = seed.InvoiceStatus;
    }

    var assignmentsById = await dbContext.Assignments
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == options.TenantId)
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);

    foreach (var seed in assignmentSeeds) {
      if (!assignmentsById.TryGetValue(seed.Id, out var assignment)) {
        assignment = new Assignment {
            Id = seed.Id,
            TenantId = options.TenantId
        };
        dbContext.Assignments.Add(assignment);
        assignmentsById[seed.Id] = assignment;
        logger.LogInformation("Seeded development assignment for request '{RequestId}'.", seed.ServiceRequestId);
      }

      assignment.TenantId = options.TenantId;
      assignment.ServiceRequestId = seed.ServiceRequestId;
      assignment.AssignedUserId = seed.AssignedUserId;
      assignment.AssignedByUserId = adminUser.Id;
      assignment.ScheduledStartUtc = seed.ScheduledStartUtc;
      assignment.ScheduledEndUtc = seed.ScheduledEndUtc;
      assignment.AssignmentStatus = seed.AssignmentStatus;
      assignment.CreatedAtUtc = seed.CreatedAtUtc;
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

  private static IReadOnlyList<DevelopmentCustomerSeed> GetDevelopmentCustomerSeeds() => [
      new(
          Guid.Parse("aaaa1111-1111-1111-1111-111111111111"),
          "CUS-0001",
          "Marian Dela Cruz",
          "09171234567",
          "marian.delacruz@example.test",
          "San Pedro, Laguna",
          DateTime.UtcNow.AddDays(-7)),
      new(
          Guid.Parse("aaaa2222-2222-2222-2222-222222222222"),
          "CUS-0002",
          "Rogelio Santos",
          "09179876543",
          "rogelio.santos@example.test",
          "Santa Rosa, Laguna",
          DateTime.UtcNow.AddDays(-4))
  ];

  private static IReadOnlyList<DevelopmentServiceRequestSeed> GetDevelopmentServiceRequestSeeds() => [
      new(
          Guid.Parse("bbbb1111-1111-1111-1111-111111111111"),
          Guid.Parse("aaaa1111-1111-1111-1111-111111111111"),
          "SR-0001",
          "Commercial Oven",
          "Double-deck gas oven",
          "Uneven heating on the lower deck during production runs.",
          DateTime.UtcNow.AddDays(1),
          "High",
          "Scheduled",
          DateTime.UtcNow.AddDays(-3)),
      new(
          Guid.Parse("bbbb2222-2222-2222-2222-222222222222"),
          Guid.Parse("aaaa2222-2222-2222-2222-222222222222"),
          "SR-0002",
          "Laptop",
          "15-inch office laptop",
          "Intermittent power loss and battery swelling concerns.",
          DateTime.UtcNow.AddDays(2),
          "Normal",
          "In Service",
          DateTime.UtcNow.AddDays(-1))
  ];

  private static IReadOnlyList<DevelopmentInvoiceSeed> GetDevelopmentInvoiceSeeds() => [
      new(
          Guid.Parse("dddd1111-1111-1111-1111-111111111111"),
          Guid.Parse("aaaa1111-1111-1111-1111-111111111111"),
          Guid.Parse("bbbb1111-1111-1111-1111-111111111111"),
          "INV-0001",
          DateTime.UtcNow.AddDays(-2),
          16500m,
          12000m,
          500m,
          16000m,
          12000m,
          "Finalized"),
      new(
          Guid.Parse("dddd2222-2222-2222-2222-222222222222"),
          Guid.Parse("aaaa2222-2222-2222-2222-222222222222"),
          Guid.Parse("bbbb2222-2222-2222-2222-222222222222"),
          "INV-0002",
          DateTime.UtcNow.AddDays(-1),
          9800m,
          7200m,
          300m,
          9500m,
          7200m,
          "Finalized")
  ];

  private static IReadOnlyList<DevelopmentStaffUserSeed> GetDevelopmentStaffUserSeeds() => [
      new(
          Guid.Parse("12121212-1212-1212-1212-121212121212"),
          Guid.Parse("34343434-3434-3434-3434-343434343434"),
          "Ramon Villanueva",
          "ramon.villanueva@example.test",
          DateTime.UtcNow.AddDays(-12)),
      new(
          Guid.Parse("56565656-5656-5656-5656-565656565656"),
          Guid.Parse("78787878-7878-7878-7878-787878787878"),
          "Lucia Mendoza",
          "lucia.mendoza@example.test",
          DateTime.UtcNow.AddDays(-10))
  ];

  private static IReadOnlyList<DevelopmentAssignmentSeed> GetDevelopmentAssignmentSeeds() => [
      new(
          Guid.Parse("cccc1111-1111-1111-1111-111111111111"),
          Guid.Parse("bbbb1111-1111-1111-1111-111111111111"),
          Guid.Parse("12121212-1212-1212-1212-121212121212"),
          DateTime.UtcNow.AddDays(1).Date.AddHours(9),
          DateTime.UtcNow.AddDays(1).Date.AddHours(12),
          "Scheduled",
          DateTime.UtcNow.AddDays(-2)),
      new(
          Guid.Parse("cccc2222-2222-2222-2222-222222222222"),
          Guid.Parse("bbbb2222-2222-2222-2222-222222222222"),
          Guid.Parse("56565656-5656-5656-5656-565656565656"),
          DateTime.UtcNow.Date.AddHours(13),
          DateTime.UtcNow.Date.AddHours(17),
          "In Progress",
          DateTime.UtcNow.AddHours(-8))
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

  private sealed record DevelopmentCustomerSeed(
      Guid Id,
      string CustomerCode,
      string FullName,
      string MobileNumber,
      string Email,
      string Address,
      DateTime CreatedAtUtc);

  private sealed record DevelopmentServiceRequestSeed(
      Guid Id,
      Guid CustomerId,
      string RequestNumber,
      string ItemType,
      string ItemDescription,
      string IssueDescription,
      DateTime? RequestedServiceDate,
      string Priority,
      string CurrentStatus,
      DateTime CreatedAtUtc);

  private sealed record DevelopmentStaffUserSeed(
      Guid Id,
      Guid UserRoleId,
      string FullName,
      string Email,
      DateTime CreatedAtUtc);

  private sealed record DevelopmentAssignmentSeed(
      Guid Id,
      Guid ServiceRequestId,
      Guid AssignedUserId,
      DateTime? ScheduledStartUtc,
      DateTime? ScheduledEndUtc,
      string AssignmentStatus,
      DateTime CreatedAtUtc);

  private sealed record DevelopmentInvoiceSeed(
      Guid Id,
      Guid CustomerId,
      Guid ServiceRequestId,
      string InvoiceNumber,
      DateTime InvoiceDateUtc,
      decimal SubtotalAmount,
      decimal InterestableAmount,
      decimal DiscountAmount,
      decimal TotalAmount,
      decimal OutstandingAmount,
      string InvoiceStatus);
}
