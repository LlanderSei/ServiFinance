using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Payments;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;

namespace ServiFinance.Infrastructure.Data;

public sealed class ProductionPlaythroughDataSeeder(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    IPasswordHasher<Customer> customerPasswordHasher,
    ILogger<ProductionPlaythroughDataSeeder> logger) {
  private const string AdminPassword = "Admin123!";
  private const string StaffPassword = "Staff123!";
  private const string CustomerPassword = "Customer123!";
  private const string SeedPrefix = "production-playthrough";

  private static readonly TenantPlaythroughSeed[] TenantSeeds = [
    new("microstandard", "micro-standard", "Micro Standard Services", "MSTD", "MICRO_STANDARD", "admin@microstandard.com", "#2563eb", "#dbeafe"),
    new("smallstandard", "small-standard", "Small Standard Services", "SSTD", "SMALL_STANDARD", "admin@smallstandard.com", "#0f766e", "#ccfbf1"),
    new("mediumstandard", "medium-standard", "Medium Standard Services", "MDST", "MEDIUM_STANDARD", "admin@mediumstandard.com", "#b45309", "#fef3c7"),
    new("micropremium", "micro-premium", "Micro Premium Services", "MPRM", "MICRO_PREMIUM", "admin@micropremium.com", "#4f46e5", "#e0e7ff"),
    new("smallpremium", "small-premium", "Small Premium Services", "SPRM", "SMALL_PREMIUM", "admin@smallpremium.com", "#7c3aed", "#ede9fe"),
    new("mediumpremium", "medium-premium", "Medium Premium Services", "MPR2", "MEDIUM_PREMIUM", "admin@mediumpremium.com", "#be123c", "#ffe4e6")
  ];

  private static readonly CustomerPlaythroughSeed[] CustomerSeeds = [
    new("llander", "Llander Reyes", "+639171110001", "llander@customer.com", "Elysian Realm, Quezon City", "Unit 8, North Wing, near service gate"),
    new("marian", "Marian Dela Cruz", "+639171110002", "marian@customer.com", "Makati Central Business District", "Tower 2, 18th floor reception"),
    new("rogelio", "Rogelio Santos", "+639171110003", "rogelio@customer.com", "Cebu IT Park", "Door 4B, behind loading bay"),
    new("elysia", "Elysia Tan", "+639171110004", "elysia@customer.com", "Davao City Poblacion", "Lot 14, blue gate beside bakery")
  ];

  private static readonly RequestPlaythroughSeed[] RequestSeeds = [
    new("laptop", "Laptop", "Lenovo ThinkPad T14", "Unit does not boot after a power surge.", "Drop-off", "Normal", 1250m),
    new("oven", "Commercial Oven", "Three-tray convection oven", "Temperature drops mid-cycle and shuts down service.", "On-site", "High", 3400m),
    new("printer", "Printer", "Brother MFC-L3770CDW", "Paper feed jams after every third page.", "Drop-off", "Normal", 900m),
    new("router", "Network Router", "MikroTik hEX S", "Random connection drops during business hours.", "On-site", "High", 1800m),
    new("phone", "Mobile Phone", "Android service phone", "Screen cracked and battery swelling reported.", "Drop-off", "Normal", 2100m),
    new("pos", "POS Terminal", "Counter checkout terminal", "Card reader intermittently fails transactions.", "On-site", "Critical", 2750m),
    new("desktop", "Desktop PC", "Accounting workstation", "Slow boot and suspected drive failure.", "On-site", "Normal", 2200m),
    new("washer", "Washing Machine", "Commercial front load washer", "Drain pump does not complete cycle.", "On-site", "High", 3100m)
  ];

  public async Task SeedAsync(DevelopmentSeedOptions options, CancellationToken cancellationToken = default) {
    var today = DateTime.UtcNow.Date;
    var yearStart = new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    var tiersByCode = await dbContext.SubscriptionTiers
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .Where(entity => entity.IsActive)
        .ToDictionaryAsync(entity => entity.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

    foreach (var seed in TenantSeeds) {
      if (!tiersByCode.TryGetValue(seed.TierCode, out var tier)) {
        throw new InvalidOperationException($"Subscription tier '{seed.TierCode}' must exist before production playthrough seeding.");
      }

      var tenant = await EnsureTenantAsync(seed, tier, yearStart, cancellationToken);
      await EnsureTenantThemeAsync(seed, tenant.Id, cancellationToken);
      await EnsureTenantRegistrationAsync(seed, tenant, tier, yearStart, cancellationToken);
      var roles = await EnsureRolesAsync(seed, tenant.Id, cancellationToken);
      var users = await EnsureUsersAsync(seed, tenant.Id, roles, yearStart, tier.IncludesMicroLendingDesktop, cancellationToken);
      var customers = await EnsureCustomersAsync(seed, tenant.Id, yearStart, cancellationToken);

      await EnsureCostingWorkspaceAsync(seed, tenant.Id, yearStart, cancellationToken);
      var serviceContext = await EnsureSmsPlaythroughAsync(seed, tenant.Id, tier, users, customers, yearStart, today, cancellationToken);
      await EnsureBillingPlaythroughAsync(seed, tenant.Id, tier, users.Admin, yearStart, today, cancellationToken);

      if (tier.IncludesMicroLendingDesktop) {
        await EnsureMlsPlaythroughAsync(seed, tenant.Id, tier, users, customers, serviceContext, yearStart, today, cancellationToken);
      }

      await EnsureAuditPlaythroughAsync(seed, tenant.Id, users, customers, yearStart, today, tier.IncludesMicroLendingDesktop, cancellationToken);
      logger.LogInformation("Production playthrough seeded tenant '{TenantSlug}' with tier '{TierCode}'.", seed.DomainSlug, seed.TierCode);
    }

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task<Tenant> EnsureTenantAsync(
      TenantPlaythroughSeed seed,
      SubscriptionTier tier,
      DateTime yearStart,
      CancellationToken cancellationToken) {
    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.DomainSlug == seed.DomainSlug, cancellationToken);

    if (tenant is null) {
      tenant = new Tenant {
        Id = StableGuid(seed.Key, "tenant"),
        CreatedAtUtc = yearStart
      };
      dbContext.Tenants.Add(tenant);
    }

    tenant.Name = seed.BusinessName;
    tenant.Code = seed.TenantCode;
    tenant.DomainSlug = seed.DomainSlug;
    tenant.BusinessSizeSegment = tier.BusinessSizeSegment;
    tenant.SubscriptionEdition = tier.SubscriptionEdition;
    tenant.SubscriptionPlan = tier.DisplayName;
    tenant.SubscriptionStatus = "Active";
    tenant.BillingProvider = "Seeded Auto-Renewal";
    tenant.StripeCustomerId = null;
    tenant.StripeSubscriptionId = null;
    tenant.PendingSubscriptionTierId = null;
    tenant.PendingSubscriptionChangeRequestedAtUtc = null;
    tenant.PendingSubscriptionChangeEffectiveAtUtc = null;
    tenant.PendingSubscriptionChangeCancelledAtUtc = null;
    tenant.SubscriptionChangeCooldownUntilUtc = null;
    tenant.IsActive = true;

    return tenant;
  }

  private async Task EnsureTenantThemeAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      CancellationToken cancellationToken) {
    var theme = await dbContext.TenantThemes
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken)
        ?? await FindOrAddAsync(
            StableGuid(seed.Key, "theme"),
            () => new TenantTheme(),
            cancellationToken);

    theme.TenantId = tenantId;
    theme.DisplayName = seed.BusinessName;
    theme.LogoUrl = null;
    theme.PrimaryColor = seed.PrimaryColor;
    theme.SecondaryColor = seed.SecondaryColor;
    theme.HeaderBackgroundColor = seed.PrimaryColor;
    theme.PageBackgroundColor = seed.SecondaryColor;
  }

  private async Task EnsureTenantRegistrationAsync(
      TenantPlaythroughSeed seed,
      Tenant tenant,
      SubscriptionTier tier,
      DateTime yearStart,
      CancellationToken cancellationToken) {
    var registration = await FindOrAddAsync(
        StableGuid(seed.Key, "registration"),
        () => new PlatformTenantRegistration(),
        cancellationToken);
    var passwordShell = new AppUser { Email = seed.AdminEmail, FullName = $"{tier.DisplayName} Administrator" };

    registration.SubscriptionTierId = tier.Id;
    registration.TenantId = tenant.Id;
    registration.BusinessName = seed.BusinessName;
    registration.TenantCode = seed.TenantCode;
    registration.DomainSlug = seed.DomainSlug;
    registration.OwnerFullName = $"{tier.DisplayName} Administrator";
    registration.OwnerEmail = seed.AdminEmail;
    registration.OwnerPasswordHash = passwordHasher.HashPassword(passwordShell, AdminPassword);
    registration.Status = "Provisioned";
    registration.StripeCheckoutSessionId = $"cs_test_seed_{seed.Key}";
    registration.StripeCustomerId = $"cus_seed_{seed.Key}";
    registration.StripeSubscriptionId = $"sub_seed_{seed.Key}";
    registration.CreatedAtUtc = yearStart.AddHours(9);
    registration.UpdatedAtUtc = yearStart.AddHours(10);
    registration.CheckoutExpiresAtUtc = yearStart.AddHours(2);
    registration.ProvisionedAtUtc = yearStart.AddHours(10);
    registration.FailureReason = null;
  }

  private async Task<IReadOnlyDictionary<string, Role>> EnsureRolesAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      CancellationToken cancellationToken) {
    var existingRoles = await dbContext.Roles
        .IgnoreQueryFilters()
        .Include(entity => entity.Permissions)
        .Where(entity => entity.TenantId == tenantId)
        .ToListAsync(cancellationToken);
    var rolesByName = existingRoles.ToDictionary(entity => entity.Name, StringComparer.OrdinalIgnoreCase);

    foreach (var definition in RolePermissionCatalog.GetTenantRoles()) {
      if (!rolesByName.TryGetValue(definition.Name, out var role)) {
        role = new Role {
          Id = StableGuid(seed.Key, "role", definition.Name),
          TenantId = tenantId,
          Name = definition.Name
        };
        dbContext.Roles.Add(role);
        rolesByName[role.Name] = role;
      }

      role.TenantId = tenantId;
      role.Name = definition.Name;
      role.Description = definition.Description;
      role.PlatformScope = definition.PlatformScope;
      role.Rank = definition.Rank;
      role.IsSystemRole = definition.IsSystemRole;
      role.IsPermissionSetLocked = definition.IsPermissionSetLocked;
      EnsureRolePermissions(role, definition);
    }

    return rolesByName;
  }

  private void EnsureRolePermissions(Role role, DefaultRoleDefinition definition) {
    var allowedKeys = definition.PermissionKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);
    if (definition.IsPermissionSetLocked) {
      dbContext.RolePermissions.RemoveRange(role.Permissions
          .Where(permission => !allowedKeys.Contains(permission.PermissionKey)));
    }

    var currentKeys = role.Permissions
        .Select(permission => permission.PermissionKey)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    foreach (var permissionKey in definition.PermissionKeys.Where(permissionKey => !currentKeys.Contains(permissionKey))) {
      var rolePermission = new RolePermission {
        Id = StableGuid(role.TenantId.ToString(), role.Name, permissionKey),
        TenantId = role.TenantId,
        RoleId = role.Id,
        PermissionKey = permissionKey,
        GrantedAtUtc = DateTime.UtcNow
      };
      dbContext.RolePermissions.Add(rolePermission);
      role.Permissions.Add(rolePermission);
    }
  }

  private async Task<PlaythroughUsers> EnsureUsersAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      IReadOnlyDictionary<string, Role> roles,
      DateTime yearStart,
      bool includesMls,
      CancellationToken cancellationToken) {
    var admin = await EnsureUserAsync(
        StableGuid(seed.Key, "user", "admin"),
        tenantId,
        seed.AdminEmail,
        $"{ToTitle(seed.Key)} Administrator",
        AdminPassword,
        yearStart.AddHours(10),
        cancellationToken);
    await EnsureUserRoleAsync(seed, tenantId, admin.Id, roles[PlatformRolePolicy.AdministratorRole].Id, "admin", cancellationToken);

    var smsStaff = await EnsureUserAsync(
        StableGuid(seed.Key, "user", "staff"),
        tenantId,
        $"staff.{seed.Key}.com",
        $"{ToTitle(seed.Key)} SMS Staff",
        StaffPassword,
        yearStart.AddDays(1),
        cancellationToken);
    await EnsureUserRoleAsync(seed, tenantId, smsStaff.Id, roles[PlatformRolePolicy.SmsStaffRole].Id, "staff", cancellationToken);

    var dispatcher = await EnsureUserAsync(
        StableGuid(seed.Key, "user", "dispatcher"),
        tenantId,
        $"dispatcher.{seed.Key}.com",
        $"{ToTitle(seed.Key)} Dispatcher",
        StaffPassword,
        yearStart.AddDays(1).AddHours(1),
        cancellationToken);
    await EnsureUserRoleAsync(seed, tenantId, dispatcher.Id, roles[PlatformRolePolicy.SmsDispatcherRole].Id, "dispatcher", cancellationToken);

    var technician = await EnsureUserAsync(
        StableGuid(seed.Key, "user", "technician"),
        tenantId,
        $"technician.{seed.Key}.com",
        $"{ToTitle(seed.Key)} Technician",
        StaffPassword,
        yearStart.AddDays(1).AddHours(2),
        cancellationToken);
    await EnsureUserRoleAsync(seed, tenantId, technician.Id, roles[PlatformRolePolicy.SmsTechnicianRole].Id, "technician", cancellationToken);

    AppUser? mlsStaff = null;
    AppUser? cashier = null;
    if (includesMls) {
      mlsStaff = await EnsureUserAsync(
          StableGuid(seed.Key, "user", "mls-staff"),
          tenantId,
          $"mls.{seed.Key}.com",
          $"{ToTitle(seed.Key)} MLS Staff",
          StaffPassword,
          yearStart.AddDays(2),
          cancellationToken);
      await EnsureUserRoleAsync(seed, tenantId, mlsStaff.Id, roles[PlatformRolePolicy.MlsStaffRole].Id, "mls-staff", cancellationToken);

      cashier = await EnsureUserAsync(
          StableGuid(seed.Key, "user", "cashier"),
          tenantId,
          $"cashier.{seed.Key}.com",
          $"{ToTitle(seed.Key)} Cashier",
          StaffPassword,
          yearStart.AddDays(2).AddHours(1),
          cancellationToken);
      await EnsureUserRoleAsync(seed, tenantId, cashier.Id, roles[PlatformRolePolicy.MlsCashierRole].Id, "cashier", cancellationToken);
    }

    return new PlaythroughUsers(admin, smsStaff, dispatcher, technician, mlsStaff, cashier);
  }

  private async Task<AppUser> EnsureUserAsync(
      Guid id,
      Guid tenantId,
      string email,
      string fullName,
      string password,
      DateTime createdAtUtc,
      CancellationToken cancellationToken) {
    var user = await dbContext.Users
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.Id == id, cancellationToken);

    if (user is null) {
      user = new AppUser {
        Id = id,
        CreatedAtUtc = createdAtUtc
      };
      dbContext.Users.Add(user);
    }

    user.TenantId = tenantId;
    user.Email = email;
    user.FullName = fullName;
    user.PasswordHash = passwordHasher.HashPassword(user, password);
    user.IsActive = true;
    return user;
  }

  private async Task EnsureUserRoleAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Guid userId,
      Guid roleId,
      string roleKey,
      CancellationToken cancellationToken) {
    var userRole = await dbContext.UserRoles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(
            entity => entity.TenantId == tenantId && entity.UserId == userId && entity.RoleId == roleId,
            cancellationToken);

    if (userRole is null) {
      userRole = await FindOrAddAsync(
          StableGuid(seed.Key, "user-role", userId.ToString(), roleKey),
          () => new UserRole(),
          cancellationToken);
    }

    userRole.TenantId = tenantId;
    userRole.UserId = userId;
    userRole.RoleId = roleId;
    userRole.AssignedAtUtc = DateTime.UtcNow;
  }

  private async Task<IReadOnlyList<Customer>> EnsureCustomersAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      DateTime yearStart,
      CancellationToken cancellationToken) {
    var customers = new List<Customer>();
    for (var index = 0; index < CustomerSeeds.Length; index++) {
      var customerSeed = CustomerSeeds[index];
      var customer = await FindOrAddAsync(
          StableGuid(seed.Key, "customer", customerSeed.Key),
          () => new Customer(),
          cancellationToken);

      customer.TenantId = tenantId;
      customer.CustomerCode = $"CUST-{seed.TenantCode}-{index + 1:000}";
      customer.FullName = customerSeed.FullName;
      customer.MobileNumber = customerSeed.MobileNumber;
      customer.Email = customerSeed.Email;
      customer.PasswordHash = customerPasswordHasher.HashPassword(customer, CustomerPassword);
      customer.Address = customerSeed.Address;
      customer.AddressDetails = customerSeed.AddressDetails;
      customer.CreatedAtUtc = yearStart.AddDays(index + 1).AddHours(8);
      customers.Add(customer);

      await EnsureContactOptionAsync(seed, tenantId, customer, customerSeed, "Primary", true, cancellationToken);
      await EnsureContactOptionAsync(seed, tenantId, customer, customerSeed, "Service site", false, cancellationToken);
    }

    return customers;
  }

  private async Task EnsureContactOptionAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Customer customer,
      CustomerPlaythroughSeed customerSeed,
      string label,
      bool isDefault,
      CancellationToken cancellationToken) {
    var contact = await FindOrAddAsync(
        StableGuid(seed.Key, "contact", customerSeed.Key, label),
        () => new CustomerContactOption(),
        cancellationToken);

    contact.TenantId = tenantId;
    contact.CustomerId = customer.Id;
    contact.Label = label;
    contact.ContactName = customer.FullName;
    contact.PhoneNumber = customer.MobileNumber;
    contact.Address = isDefault ? customerSeed.Address : $"{customerSeed.Address} service entrance";
    contact.AddressDetails = isDefault ? customerSeed.AddressDetails : $"{customerSeed.AddressDetails}; notify guard before arrival";
    contact.IsDefault = isDefault;
    contact.CreatedAtUtc = customer.CreatedAtUtc.AddHours(2);
  }

  private async Task EnsureCostingWorkspaceAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      DateTime yearStart,
      CancellationToken cancellationToken) {
    var policy = await dbContext.TenantCostingPolicies
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken)
        ?? await FindOrAddAsync(
            StableGuid(seed.Key, "costing-policy"),
            () => new TenantCostingPolicy(),
            cancellationToken);
    policy.TenantId = tenantId;
    policy.TaxLabel = "VAT";
    policy.DefaultTaxRate = 12m;
    policy.TaxEnabledByDefault = true;
    policy.LoanLateFeeEnabled = true;
    policy.LoanLateFeeGracePeriodDays = seed.Key.Contains("medium", StringComparison.OrdinalIgnoreCase) ? 2 : 3;
    policy.LoanLateFeeFlatAmount = seed.Key.Contains("micro", StringComparison.OrdinalIgnoreCase) ? 75m : 125m;
    policy.LoanLateFeeRatePercent = seed.Key.Contains("premium", StringComparison.OrdinalIgnoreCase) ? 2.5m : 2m;
    policy.CreatedAtUtc = yearStart;
    policy.UpdatedAtUtc = DateTime.UtcNow;

    var presets = new[] {
      new PresetSeed("base", "Base Charge", "Labor", "Default labor diagnostic", 1m, 500m),
      new PresetSeed("cleaning", "Service", "Cleaning", "General cleaning and burn-in test", 1m, 250m),
      new PresetSeed("battery", "Part", "Battery Replacement", "Model-specific battery pack", 1m, 1800m),
      new PresetSeed("screen", "Part", "Screen Assembly", "Panel, adhesive, and calibration", 1m, 3200m),
      new PresetSeed("travel", "Service", "On-site Visit", "Local service travel allowance", 1m, 300m)
    };

    for (var index = 0; index < presets.Length; index++) {
      var presetSeed = presets[index];
      var preset = await FindOrAddAsync(
          StableGuid(seed.Key, "preset", presetSeed.Key),
          () => new ServiceCostPreset(),
          cancellationToken);
      preset.TenantId = tenantId;
      preset.Category = presetSeed.Category;
      preset.Name = presetSeed.Name;
      preset.DefaultSpecification = presetSeed.Specification;
      preset.DefaultQuantity = presetSeed.Quantity;
      preset.DefaultUnitPrice = presetSeed.UnitPrice;
      preset.IsActive = true;
      preset.SortOrder = (index + 1) * 10;
      preset.CreatedAtUtc = yearStart.AddDays(2);
      preset.UpdatedAtUtc = DateTime.UtcNow;
    }
  }

  private async Task<ServicePlaythroughContext> EnsureSmsPlaythroughAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      SubscriptionTier tier,
      PlaythroughUsers users,
      IReadOnlyList<Customer> customers,
      DateTime yearStart,
      DateTime today,
      CancellationToken cancellationToken) {
    var requestCount = ResolveServiceRequestCount(seed, tier);
    var totalDays = Math.Max(1, (today - yearStart).Days);
    var completedInvoices = new List<Invoice>();
    var financeQueueInvoices = new List<Invoice>();
    var allRequests = new List<ServiceRequest>();

    for (var index = 0; index < requestCount; index++) {
      var requestSeed = RequestSeeds[index % RequestSeeds.Length];
      var customer = customers[index % customers.Count];
      var createdAt = yearStart.AddDays(Math.Min(totalDays, 3 + index * Math.Max(1, totalDays / Math.Max(requestCount, 1)))).AddHours(8 + index % 8);
      var status = ResolveServiceStatus(index, requestCount);
      var serviceRequest = await EnsureServiceRequestAsync(
          seed,
          tenantId,
          users,
          customer,
          requestSeed,
          index,
          status,
          createdAt,
          today,
          cancellationToken);

      allRequests.Add(serviceRequest);
      await EnsureStatusLogsAsync(seed, tenantId, serviceRequest, users, customer, status, createdAt, cancellationToken);

      if (CanSeedAssignment(status)) {
        await EnsureAssignmentPlaythroughAsync(seed, tenantId, users, serviceRequest, status, createdAt, cancellationToken);
      }

      if (CanSeedCostSheet(status)) {
        await EnsureCostSheetAsync(seed, tenantId, serviceRequest, requestSeed, index, status, createdAt, cancellationToken);
      }

      if (string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase)) {
        var invoice = await EnsureInvoiceAsync(seed, tenantId, users, customer, serviceRequest, requestSeed, index, createdAt, tier.IncludesMicroLendingDesktop, cancellationToken);
        completedInvoices.Add(invoice);
        if (invoice.OutstandingAmount > 0m && string.Equals(invoice.InvoiceStatus, ServiceInvoiceFinancePolicy.FinalizedStatus, StringComparison.OrdinalIgnoreCase)) {
          financeQueueInvoices.Add(invoice);
        }
      }
    }

    return new ServicePlaythroughContext(allRequests, completedInvoices, financeQueueInvoices);
  }

  private async Task<ServiceRequest> EnsureServiceRequestAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      PlaythroughUsers users,
      Customer customer,
      RequestPlaythroughSeed requestSeed,
      int index,
      string status,
      DateTime createdAt,
      DateTime today,
      CancellationToken cancellationToken) {
    var request = await FindOrAddAsync(
        StableGuid(seed.Key, "service-request", index.ToString(CultureInfo.InvariantCulture)),
        () => new ServiceRequest(),
        cancellationToken);
    var requestedDate = createdAt.Date.AddDays(2 + index % 4);
    var isCustomerCreated = index % 2 == 0;
    var isOnSite = string.Equals(requestSeed.ServiceMode, "On-site", StringComparison.OrdinalIgnoreCase);
    var completedAt = string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase)
        ? createdAt.AddDays(3).AddHours(3)
        : (DateTime?)null;
    var cancelledAt = string.Equals(status, "Cancelled", StringComparison.OrdinalIgnoreCase)
        ? createdAt.AddDays(1).AddHours(4)
        : (DateTime?)null;
    var cancellationRequestedAt = status is "Cancelled" or "Cancellation Requested"
        ? createdAt.AddDays(1).AddHours(1)
        : (DateTime?)null;

    request.TenantId = tenantId;
    request.CustomerId = customer.Id;
    request.RequestNumber = $"SR-{seed.TenantCode}-{index + 1:000}";
    request.ItemType = requestSeed.ItemType;
    request.ItemDescription = requestSeed.ItemDescription;
    request.IssueDescription = requestSeed.IssueDescription;
    request.RequestedServiceDate = requestedDate;
    request.ServiceMode = requestSeed.ServiceMode;
    request.ServiceAddress = isOnSite ? customer.Address : "Tenant workshop counter";
    request.ServiceAddressDetails = isOnSite ? customer.AddressDetails : "Customer will bring the item to the front desk.";
    request.ContactName = customer.FullName;
    request.ContactPhone = customer.MobileNumber;
    request.PreferredScheduleStartUtc = requestedDate.AddHours(9);
    request.PreferredScheduleEndUtc = requestedDate.AddHours(12);
    request.NeededByUtc = requestedDate.AddDays(index % 3 + 1).AddHours(17);
    request.Priority = requestSeed.Priority;
    request.CurrentStatus = status;
    request.CreatedByCustomerId = isCustomerCreated ? customer.Id : null;
    request.CreatedByUserId = isCustomerCreated ? null : users.SmsStaff.Id;
    request.CreatedAtUtc = createdAt;
    request.CompletedAtUtc = completedAt;
    request.CancellationRequestedAtUtc = cancellationRequestedAt;
    request.CancelledAtUtc = cancelledAt;
    request.CancellationReason = cancelledAt is null ? null : "Customer cancelled before dispatch confirmation.";

    if (completedAt is not null) {
      request.FeedbackExpiresAtUtc = completedAt.Value.AddDays(7);
      if (index % 3 != 0 && request.FeedbackExpiresAtUtc.Value <= today.AddDays(1)) {
        request.Rating = 3 + index % 3;
        request.FeedbackComments = index % 2 == 0
            ? "Service was clear and the technician explained the next care steps."
            : "Resolution was good, but pickup updates could be faster.";
        request.FeedbackSuggestionCategory = index % 2 == 0 ? "Service quality" : "Communication";
        request.FeedbackSubmittedAtUtc = completedAt.Value.AddDays(2);
      } else {
        request.Rating = null;
        request.FeedbackComments = null;
        request.FeedbackSuggestionCategory = null;
        request.FeedbackSubmittedAtUtc = null;
      }
    } else {
      request.Rating = null;
      request.FeedbackComments = null;
      request.FeedbackSuggestionCategory = null;
      request.FeedbackSubmittedAtUtc = null;
      request.FeedbackExpiresAtUtc = null;
    }

    if (index % 4 == 0) {
      await EnsureServiceAttachmentAsync(seed, tenantId, request, customer, index, createdAt, cancellationToken);
    }

    return request;
  }

  private async Task EnsureServiceAttachmentAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      ServiceRequest request,
      Customer customer,
      int index,
      DateTime createdAt,
      CancellationToken cancellationToken) {
    var attachment = await FindOrAddAsync(
        StableGuid(seed.Key, "request-attachment", index.ToString(CultureInfo.InvariantCulture)),
        () => new ServiceRequestAttachment(),
        cancellationToken);

    attachment.TenantId = tenantId;
    attachment.ServiceRequestId = request.Id;
    attachment.SubmittedByCustomerId = customer.Id;
    attachment.OriginalFileName = $"customer-photo-{index + 1}.jpg";
    attachment.StoredFileName = $"seed-{seed.Key}-request-{index + 1}.jpg";
    attachment.ContentType = "image/jpeg";
    attachment.RelativeUrl = $"https://i.ibb.co/seed/{seed.Key}-request-{index + 1}.jpg";
    attachment.CreatedAtUtc = createdAt.AddMinutes(20);
  }

  private async Task EnsureStatusLogsAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      ServiceRequest request,
      PlaythroughUsers users,
      Customer customer,
      string status,
      DateTime createdAt,
      CancellationToken cancellationToken) {
    await EnsureStatusLogAsync(seed, tenantId, request.Id, 1, "New", "Request captured from the production playthrough.", null, customer.Id, createdAt, cancellationToken);

    if (status is "Scheduled" or "In Service" or "On Hold" or "Completed") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 2, "Scheduled", "Dispatcher scheduled the service window.", users.Dispatcher.Id, null, createdAt.AddDays(1), cancellationToken);
    }

    if (status is "In Service" or "On Hold" or "Completed") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 3, "In Service", "Technician started service work.", users.Technician.Id, null, createdAt.AddDays(2), cancellationToken);
    }

    if (status == "On Hold") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 4, "On Hold", "Waiting for customer approval on replacement part.", users.Technician.Id, null, createdAt.AddDays(2).AddHours(3), cancellationToken);
    }

    if (status == "Completed") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 4, "Completed", "Service completed and ready for billing.", users.Technician.Id, null, createdAt.AddDays(3).AddHours(3), cancellationToken);
    }

    if (status is "Cancelled" or "Cancellation Requested") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 2, "Cancellation Requested", "Customer asked to stop the request.", null, customer.Id, createdAt.AddDays(1), cancellationToken);
    }

    if (status == "Cancelled") {
      await EnsureStatusLogAsync(seed, tenantId, request.Id, 3, "Cancelled", "Cancellation accepted before assignment.", users.Dispatcher.Id, null, createdAt.AddDays(1).AddHours(4), cancellationToken);
    }
  }

  private async Task EnsureStatusLogAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Guid serviceRequestId,
      int sequence,
      string status,
      string remarks,
      Guid? changedByUserId,
      Guid? changedByCustomerId,
      DateTime changedAtUtc,
      CancellationToken cancellationToken) {
    var log = await FindOrAddAsync(
        StableGuid(seed.Key, "status-log", serviceRequestId.ToString(), sequence.ToString(CultureInfo.InvariantCulture)),
        () => new StatusLog(),
        cancellationToken);

    log.TenantId = tenantId;
    log.ServiceRequestId = serviceRequestId;
    log.Status = status;
    log.Remarks = remarks;
    log.ChangedByUserId = changedByUserId;
    log.ChangedByCustomerId = changedByCustomerId;
    log.ChangedAtUtc = changedAtUtc;
  }

  private async Task EnsureAssignmentPlaythroughAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      PlaythroughUsers users,
      ServiceRequest request,
      string status,
      DateTime createdAt,
      CancellationToken cancellationToken) {
    var assignment = await FindOrAddAsync(
        StableGuid(seed.Key, "assignment", request.Id.ToString()),
        () => new Assignment(),
        cancellationToken);

    var scheduledStart = createdAt.AddDays(1).Date.AddHours(9 + (createdAt.Day % 4));
    assignment.TenantId = tenantId;
    assignment.ServiceRequestId = request.Id;
    assignment.AssignedUserId = users.Technician.Id;
    assignment.AssignedByUserId = users.Dispatcher.Id;
    assignment.ScheduledStartUtc = scheduledStart;
    assignment.ScheduledEndUtc = scheduledStart.AddHours(3);
    assignment.AssignmentStatus = status switch {
      "Completed" => "Completed",
      "In Service" => "In Progress",
      "On Hold" => "On Hold",
      _ => "Scheduled"
    };
    assignment.CreatedAtUtc = createdAt.AddDays(1);

    await EnsureAssignmentEventAsync(seed, tenantId, assignment.Id, 1, "Scheduled", assignment.AssignmentStatus, users.Dispatcher.Id, users.Technician.Id, scheduledStart, scheduledStart.AddHours(3), createdAt.AddDays(1), cancellationToken);
    if (status is "In Service" or "On Hold" or "Completed") {
      await EnsureAssignmentEventAsync(seed, tenantId, assignment.Id, 2, "Started", "In Progress", users.Technician.Id, users.Technician.Id, scheduledStart, scheduledStart.AddHours(3), createdAt.AddDays(2), cancellationToken);
      await EnsureAssignmentEvidenceAsync(seed, tenantId, assignment.Id, users.Technician.Id, createdAt.AddDays(2).AddHours(1), cancellationToken);
    }

    if (status == "Completed") {
      await EnsureAssignmentEventAsync(seed, tenantId, assignment.Id, 3, "Completed", "Completed", users.Technician.Id, users.Technician.Id, scheduledStart, scheduledStart.AddHours(3), createdAt.AddDays(3).AddHours(2), cancellationToken);
    }
  }

  private async Task EnsureAssignmentEventAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Guid assignmentId,
      int sequence,
      string eventType,
      string assignmentStatus,
      Guid changedByUserId,
      Guid assignedUserId,
      DateTime? scheduledStartUtc,
      DateTime? scheduledEndUtc,
      DateTime createdAtUtc,
      CancellationToken cancellationToken) {
    var assignmentEvent = await FindOrAddAsync(
        StableGuid(seed.Key, "assignment-event", assignmentId.ToString(), sequence.ToString(CultureInfo.InvariantCulture)),
        () => new AssignmentEvent(),
        cancellationToken);

    assignmentEvent.TenantId = tenantId;
    assignmentEvent.AssignmentId = assignmentId;
    assignmentEvent.EventType = eventType;
    assignmentEvent.PreviousAssignedUserId = null;
    assignmentEvent.AssignedUserId = assignedUserId;
    assignmentEvent.PreviousScheduledStartUtc = null;
    assignmentEvent.PreviousScheduledEndUtc = null;
    assignmentEvent.ScheduledStartUtc = scheduledStartUtc;
    assignmentEvent.ScheduledEndUtc = scheduledEndUtc;
    assignmentEvent.AssignmentStatus = assignmentStatus;
    assignmentEvent.Remarks = eventType == "Completed" ? "Work completed with seed evidence." : "Production playthrough dispatch event.";
    assignmentEvent.ChangedByUserId = changedByUserId;
    assignmentEvent.CreatedAtUtc = createdAtUtc;
  }

  private async Task EnsureAssignmentEvidenceAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Guid assignmentId,
      Guid submittedByUserId,
      DateTime createdAtUtc,
      CancellationToken cancellationToken) {
    var evidence = await FindOrAddAsync(
        StableGuid(seed.Key, "assignment-evidence", assignmentId.ToString()),
        () => new AssignmentEvidence(),
        cancellationToken);

    evidence.TenantId = tenantId;
    evidence.AssignmentId = assignmentId;
    evidence.SubmittedByUserId = submittedByUserId;
    evidence.Note = "Initial diagnostic photo and service bench notes captured during seeded work.";
    evidence.OriginalFileName = "technician-evidence.jpg";
    evidence.StoredFileName = $"seed-{seed.Key}-evidence.jpg";
    evidence.ContentType = "image/jpeg";
    evidence.RelativeUrl = $"https://i.ibb.co/seed/{seed.Key}-evidence.jpg";
    evidence.CreatedAtUtc = createdAtUtc;
  }

  private async Task EnsureCostSheetAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      ServiceRequest request,
      RequestPlaythroughSeed requestSeed,
      int index,
      string status,
      DateTime createdAt,
      CancellationToken cancellationToken) {
    var sheet = await FindOrAddAsync(
        StableGuid(seed.Key, "cost-sheet", request.Id.ToString()),
        () => new ServiceCostSheet(),
        cancellationToken);
    sheet.TenantId = tenantId;
    sheet.ServiceRequestId = request.Id;
    sheet.Status = status == "Completed" ? "Finalized" : "Draft";
    sheet.IsTaxEnabled = true;
    sheet.TaxLabel = "VAT";
    sheet.TaxRate = 12m;
    sheet.Notes = "Seeded transparent cost sheet for production playthrough testing.";
    sheet.CreatedAtUtc = createdAt.AddDays(2);
    sheet.UpdatedAtUtc = DateTime.UtcNow;
    sheet.FinalizedAtUtc = status == "Completed" ? createdAt.AddDays(3).AddHours(1) : null;

    var lines = new[] {
      new CostLineSeed("base", "Labor", "Base Labor", "Diagnostic and repair labor", 1m, 500m),
      new CostLineSeed("service", "Service", requestSeed.ItemType.Contains("Oven", StringComparison.OrdinalIgnoreCase) ? "Deep Cleaning" : "Testing And Assembly", "Service execution and post-repair validation", 1m, 250m + (index % 3) * 100m),
      new CostLineSeed("part", "Part", requestSeed.ItemType.Contains("Laptop", StringComparison.OrdinalIgnoreCase) ? "Battery Pack" : "Replacement Component", requestSeed.ItemDescription, 1m, requestSeed.BasePartsAmount)
    };

    for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++) {
      var lineSeed = lines[lineIndex];
      var line = await FindOrAddAsync(
          StableGuid(seed.Key, "cost-line", sheet.Id.ToString(), lineSeed.Key),
          () => new ServiceCostLine(),
          cancellationToken);
      line.TenantId = tenantId;
      line.ServiceCostSheetId = sheet.Id;
      line.ServiceCostPresetId = null;
      line.Category = lineSeed.Category;
      line.Name = lineSeed.Name;
      line.Specification = lineSeed.Specification;
      line.Quantity = lineSeed.Quantity;
      line.UnitPrice = lineSeed.UnitPrice;
      line.SortOrder = (lineIndex + 1) * 10;
      line.CreatedAtUtc = sheet.CreatedAtUtc;
      line.UpdatedAtUtc = DateTime.UtcNow;
    }
  }

  private async Task<Invoice> EnsureInvoiceAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      PlaythroughUsers users,
      Customer customer,
      ServiceRequest request,
      RequestPlaythroughSeed requestSeed,
      int index,
      DateTime createdAt,
      bool canUseMls,
      CancellationToken cancellationToken) {
    var invoice = await FindOrAddAsync(
        StableGuid(seed.Key, "invoice", request.Id.ToString()),
        () => new Invoice(),
        cancellationToken);
    var subtotal = 500m + 250m + requestSeed.BasePartsAmount;
    var tax = Math.Round(subtotal * 0.12m, 2, MidpointRounding.AwayFromZero);
    var total = subtotal + tax;
    var shouldQueueForLoan = canUseMls && index % 4 == 0;
    var shouldSubmitProof = !shouldQueueForLoan && index % 5 == 0;
    var shouldPartial = !shouldQueueForLoan && !shouldSubmitProof && index % 6 == 0;

    invoice.TenantId = tenantId;
    invoice.CustomerId = customer.Id;
    invoice.ServiceRequestId = request.Id;
    invoice.InvoiceNumber = $"INV-{seed.TenantCode}-{index + 1:000}";
    invoice.InvoiceDateUtc = createdAt.AddDays(3).AddHours(4);
    invoice.SubtotalAmount = subtotal;
    invoice.TaxAmount = tax;
    invoice.InterestableAmount = total;
    invoice.DiscountAmount = 0m;
    invoice.TotalAmount = total;
    invoice.OutstandingAmount = shouldQueueForLoan ? total : shouldPartial ? Math.Round(total / 2m, 2, MidpointRounding.AwayFromZero) : shouldSubmitProof ? total : 0m;
    invoice.InvoiceStatus = shouldQueueForLoan
        ? ServiceInvoiceFinancePolicy.FinalizedStatus
        : shouldSubmitProof
            ? ServiceInvoiceFinancePolicy.PaymentSubmittedStatus
            : shouldPartial
                ? ServiceInvoiceFinancePolicy.PartiallyPaidStatus
                : ServiceInvoiceFinancePolicy.PaidStatus;
    invoice.LoanApprovalStatus = shouldQueueForLoan && seed.Key.Contains("medium", StringComparison.OrdinalIgnoreCase)
        ? "Pending Review"
        : "Not Requested";
    invoice.LoanApprovalRequestedByUserId = invoice.LoanApprovalStatus == "Pending Review" ? users.MlsStaff?.Id ?? users.Admin.Id : null;
    invoice.LoanApprovalRequestedAtUtc = invoice.LoanApprovalStatus == "Pending Review" ? invoice.InvoiceDateUtc.AddHours(2) : null;
    invoice.LoanApprovalReviewedByUserId = null;
    invoice.LoanApprovalReviewedAtUtc = null;
    invoice.LoanApprovalRemarks = invoice.LoanApprovalStatus == "Pending Review" ? "Seeded maker-checker review pending." : null;

    await EnsureInvoiceLinesAsync(seed, tenantId, invoice, requestSeed, index, cancellationToken);
    if (!shouldQueueForLoan) {
      await EnsureInvoicePaymentSubmissionAsync(seed, tenantId, users, customer, request, invoice, shouldSubmitProof, shouldPartial, cancellationToken);
    }

    return invoice;
  }

  private async Task EnsureInvoiceLinesAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Invoice invoice,
      RequestPlaythroughSeed requestSeed,
      int index,
      CancellationToken cancellationToken) {
    var lines = new[] {
      new InvoiceLineSeed("labor", "Labor", "Base Labor", "Diagnostic and repair labor", 1m, 500m),
      new InvoiceLineSeed("service", "Service", requestSeed.ItemType.Contains("Oven", StringComparison.OrdinalIgnoreCase) ? "Deep Cleaning" : "Testing And Assembly", "Service execution and validation", 1m, 250m + (index % 3) * 100m),
      new InvoiceLineSeed("part", "Part", requestSeed.ItemType.Contains("Laptop", StringComparison.OrdinalIgnoreCase) ? "Battery Pack" : "Replacement Component", requestSeed.ItemDescription, 1m, requestSeed.BasePartsAmount)
    };

    for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++) {
      var lineSeed = lines[lineIndex];
      var invoiceLine = await FindOrAddAsync(
          StableGuid(seed.Key, "invoice-line", invoice.Id.ToString(), lineSeed.Key),
          () => new InvoiceLine(),
          cancellationToken);
      invoiceLine.TenantId = tenantId;
      invoiceLine.InvoiceId = invoice.Id;
      invoiceLine.Category = lineSeed.Category;
      invoiceLine.Name = lineSeed.Name;
      invoiceLine.Specification = lineSeed.Specification;
      invoiceLine.Description = lineSeed.Description;
      invoiceLine.Quantity = lineSeed.Quantity;
      invoiceLine.UnitPrice = lineSeed.UnitPrice;
      invoiceLine.LineTotal = lineSeed.Quantity * lineSeed.UnitPrice;
      invoiceLine.SortOrder = (lineIndex + 1) * 10;
    }
  }

  private async Task EnsureInvoicePaymentSubmissionAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      PlaythroughUsers users,
      Customer customer,
      ServiceRequest request,
      Invoice invoice,
      bool isPending,
      bool isPartial,
      CancellationToken cancellationToken) {
    var submission = await FindOrAddAsync(
        StableGuid(seed.Key, "invoice-payment", invoice.Id.ToString()),
        () => new InvoicePaymentSubmission(),
        cancellationToken);
    var amount = isPartial
        ? invoice.TotalAmount - invoice.OutstandingAmount
        : invoice.TotalAmount;

    submission.TenantId = tenantId;
    submission.InvoiceId = invoice.Id;
    submission.CustomerId = customer.Id;
    submission.ServiceRequestId = request.Id;
    submission.AmountSubmitted = amount;
    submission.ApprovedAmount = isPending ? null : amount;
    submission.PaymentMethod = isPending ? "GCash" : "Stripe Checkout";
    submission.ReferenceNumber = isPending ? $"GCASH-{seed.TenantCode}-{invoice.InvoiceNumber}" : $"STRIPE-{seed.TenantCode}-{invoice.InvoiceNumber}";
    submission.Note = isPending ? "Customer uploaded proof for tenant review." : "Seeded successful checkout settlement.";
    submission.Status = isPending ? ServiceInvoiceFinancePolicy.PaymentSubmittedStatus : "Approved";
    submission.ReviewRemarks = isPending ? null : "Approved by production playthrough.";
    submission.ProofOriginalFileName = isPending ? "gcash-proof.jpg" : null;
    submission.ProofStoredFileName = isPending ? $"seed-{seed.Key}-{invoice.InvoiceNumber}.jpg" : null;
    submission.ProofContentType = isPending ? "image/jpeg" : null;
    submission.ProofRelativeUrl = isPending ? $"https://i.ibb.co/seed/{seed.Key}-{invoice.InvoiceNumber}.jpg" : null;
    submission.SubmittedAtUtc = invoice.InvoiceDateUtc.AddHours(2);
    submission.ReviewedByUserId = isPending ? null : users.SmsStaff.Id;
    submission.ReviewedAtUtc = isPending ? null : invoice.InvoiceDateUtc.AddHours(4);
  }

  private async Task EnsureBillingPlaythroughAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      SubscriptionTier tier,
      AppUser admin,
      DateTime yearStart,
      DateTime today,
      CancellationToken cancellationToken) {
    var cycleStart = yearStart;
    var cycle = 1;
    while (cycleStart <= today) {
      var coverageEnd = cycleStart.AddMonths(1).AddDays(-1);
      var billingRecord = await FindOrAddAsync(
          StableGuid(seed.Key, "billing", cycle.ToString(CultureInfo.InvariantCulture)),
          () => new TenantBillingRecord(),
          cancellationToken);
      var isLatestCycle = coverageEnd >= today.AddDays(-7);
      var failedCycle = seed.Key == "mediumstandard" && isLatestCycle;

      billingRecord.TenantId = tenantId;
      billingRecord.SubmittedByUserId = admin.Id;
      billingRecord.BillingPeriodLabel = cycleStart.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
      billingRecord.CoverageStartUtc = cycleStart;
      billingRecord.CoverageEndUtc = coverageEnd;
      billingRecord.DueDateUtc = cycleStart.AddDays(7);
      billingRecord.AmountDue = tier.MonthlyPriceAmount;
      billingRecord.AmountSubmitted = failedCycle ? 0m : tier.MonthlyPriceAmount;
      billingRecord.PaymentMethod = "Seeded Stripe auto-renewal";
      billingRecord.ReferenceNumber = $"AUTO-{seed.TenantCode}-{cycleStart:yyyyMM}";
      billingRecord.Status = failedCycle ? "Payment failed" : "Confirmed";
      billingRecord.Note = failedCycle
          ? "Seeded retry scenario for billing recovery testing."
          : "Seeded automatic renewal cycle.";
      billingRecord.ReviewRemarks = failedCycle
          ? "Provider retry is pending."
          : "Auto-confirmed by production playthrough.";
      billingRecord.ProofOriginalFileName = null;
      billingRecord.ProofStoredFileName = null;
      billingRecord.ProofContentType = null;
      billingRecord.ProofRelativeUrl = null;
      billingRecord.SubmittedAtUtc = cycleStart.AddDays(7).AddHours(9);
      billingRecord.ReviewedAtUtc = failedCycle ? null : cycleStart.AddDays(7).AddHours(10);

      cycle++;
      cycleStart = cycleStart.AddMonths(1);
    }
  }

  private async Task EnsureMlsPlaythroughAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      SubscriptionTier tier,
      PlaythroughUsers users,
      IReadOnlyList<Customer> customers,
      ServicePlaythroughContext serviceContext,
      DateTime yearStart,
      DateTime today,
      CancellationToken cancellationToken) {
    if (!HasModuleAccess(tier, "D1_SERVICE_LINKED_LOANS")) {
      return;
    }

    var mlsUser = users.MlsStaff ?? users.Admin;
    var financeQueueInvoice = serviceContext.FinanceQueueInvoices.FirstOrDefault();
    if (financeQueueInvoice is not null) {
      await EnsureMicroLoanAsync(
          seed,
          tenantId,
          mlsUser,
          financeQueueInvoice.CustomerId,
          financeQueueInvoice.Id,
          financeQueueInvoice.TotalAmount,
          18m,
          4,
          "service-linked",
          "Active",
          "Approved",
          yearStart.AddMonths(1),
          today,
          cancellationToken);
    }

    if (HasModuleAccess(tier, "D2_STANDALONE_LOANS")) {
      await EnsureMicroLoanAsync(
          seed,
          tenantId,
          mlsUser,
          customers[1 % customers.Count].Id,
          null,
          seed.Key.Contains("medium", StringComparison.OrdinalIgnoreCase) ? 12000m : 6500m,
          22m,
          6,
          "standalone",
          "Active",
          "Approved",
          yearStart.AddMonths(2),
          today,
          cancellationToken);
    }

    if (HasModuleAccess(tier, "D9_LOAN_APPROVAL_WORKFLOW")) {
      await EnsureMicroLoanAsync(
          seed,
          tenantId,
          mlsUser,
          customers[2 % customers.Count].Id,
          null,
          18500m,
          28m,
          8,
          "approval-pending",
          "Pending Approval",
          "Pending Review",
          today.AddDays(-14),
          today,
          cancellationToken);
    }
  }

  private async Task EnsureMicroLoanAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      AppUser createdByUser,
      Guid customerId,
      Guid? invoiceId,
      decimal principal,
      decimal annualRate,
      int termMonths,
      string loanKey,
      string loanStatus,
      string approvalStatus,
      DateTime startDate,
      DateTime today,
      CancellationToken cancellationToken) {
    var loan = await FindOrAddAsync(
        StableGuid(seed.Key, "loan", loanKey),
        () => new MicroLoan(),
        cancellationToken);
    var totalInterest = Math.Round(principal * annualRate / 100m / 12m * termMonths, 2, MidpointRounding.AwayFromZero);
    var totalRepayable = principal + totalInterest;
    var monthlyInstallment = Math.Round(totalRepayable / termMonths, 2, MidpointRounding.AwayFromZero);

    loan.TenantId = tenantId;
    loan.InvoiceId = invoiceId;
    loan.CustomerId = customerId;
    loan.PrincipalAmount = principal;
    loan.AnnualInterestRate = annualRate;
    loan.TermMonths = termMonths;
    loan.MonthlyInstallment = monthlyInstallment;
    loan.TotalInterestAmount = totalInterest;
    loan.TotalRepayableAmount = totalRepayable;
    loan.LoanStartDate = startDate.Date;
    loan.MaturityDate = startDate.Date.AddMonths(termMonths);
    loan.ReferenceNumber = $"MLS-{seed.TenantCode}-{loanKey.ToUpperInvariant()}";
    loan.Remarks = invoiceId is null ? "Seeded standalone MLS loan." : "Seeded service-linked loan conversion.";
    loan.LoanStatus = loanStatus;
    loan.ApprovalStatus = approvalStatus;
    loan.ApprovalRequestedByUserId = createdByUser.Id;
    loan.ApprovalRequestedAtUtc = startDate.AddHours(9);
    loan.ApprovalReviewedByUserId = approvalStatus == "Approved" ? createdByUser.Id : null;
    loan.ApprovalReviewedAtUtc = approvalStatus == "Approved" ? startDate.AddHours(12) : null;
    loan.ApprovalRemarks = approvalStatus == "Approved" ? "Approved by production playthrough." : "Awaiting maker-checker approval.";
    loan.CreatedByUserId = createdByUser.Id;
    loan.CreatedAtUtc = startDate.AddHours(8);

    var runningBalance = 0m;
    await EnsureLedgerTransactionAsync(seed, tenantId, customerId, invoiceId, loan.Id, null, 1, startDate, "LoanCreation", loan.ReferenceNumber!, principal, 0m, runningBalance + principal, "Seeded loan creation.", createdByUser.Id, cancellationToken);
    runningBalance += principal;

    var beginningBalance = principal;
    for (var installment = 1; installment <= termMonths; installment++) {
      var dueDate = startDate.Date.AddMonths(installment);
      var principalPortion = Math.Round(principal / termMonths, 2, MidpointRounding.AwayFromZero);
      var interestPortion = Math.Round(totalInterest / termMonths, 2, MidpointRounding.AwayFromZero);
      var paidAmount = 0m;
      var lateFee = 0m;
      DateTime? lateFeeAppliedAt = null;
      var status = "Pending";

      if (approvalStatus == "Approved" && dueDate < today.AddDays(-10) && installment <= 2) {
        status = installment == 2 && seed.Key.Contains("smallpremium", StringComparison.OrdinalIgnoreCase) ? "Partially Paid" : "Paid";
        paidAmount = status == "Paid" ? monthlyInstallment : Math.Round(monthlyInstallment / 2m, 2, MidpointRounding.AwayFromZero);
      } else if (approvalStatus == "Approved" && dueDate < today) {
        status = "Overdue";
        lateFee = seed.Key.Contains("premium", StringComparison.OrdinalIgnoreCase) ? 125m : 75m;
        lateFeeAppliedAt = dueDate.AddDays(4);
      }

      var schedule = await FindOrAddAsync(
          StableGuid(seed.Key, "schedule", loanKey, installment.ToString(CultureInfo.InvariantCulture)),
          () => new AmortizationSchedule(),
          cancellationToken);
      schedule.TenantId = tenantId;
      schedule.MicroLoanId = loan.Id;
      schedule.InstallmentNumber = installment;
      schedule.DueDate = dueDate;
      schedule.BeginningBalance = beginningBalance;
      schedule.PrincipalPortion = principalPortion;
      schedule.InterestPortion = interestPortion;
      schedule.InstallmentAmount = monthlyInstallment;
      schedule.EndingBalance = Math.Max(0m, beginningBalance - principalPortion);
      schedule.PaidAmount = paidAmount;
      schedule.LateFeeAmount = lateFee;
      schedule.LateFeeAppliedAtUtc = lateFeeAppliedAt;
      schedule.InstallmentStatus = status;

      if (paidAmount > 0m) {
        runningBalance = Math.Max(0m, runningBalance - paidAmount);
        await EnsureLedgerTransactionAsync(seed, tenantId, customerId, invoiceId, loan.Id, schedule.Id, installment + 1, dueDate.AddDays(1), "Payment", $"PAY-{seed.TenantCode}-{loanKey}-{installment}", 0m, paidAmount, runningBalance, "Seeded loan payment.", createdByUser.Id, cancellationToken);
      }

      beginningBalance = schedule.EndingBalance;
    }
  }

  private async Task EnsureLedgerTransactionAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      Guid customerId,
      Guid? invoiceId,
      Guid? loanId,
      Guid? scheduleId,
      int sequence,
      DateTime transactionDate,
      string transactionType,
      string referenceNumber,
      decimal debit,
      decimal credit,
      decimal runningBalance,
      string remarks,
      Guid createdByUserId,
      CancellationToken cancellationToken) {
    var transaction = await FindOrAddAsync(
        StableGuid(seed.Key, "ledger", loanId?.ToString() ?? invoiceId?.ToString() ?? customerId.ToString(), sequence.ToString(CultureInfo.InvariantCulture)),
        () => new LedgerTransaction(),
        cancellationToken);

    transaction.TenantId = tenantId;
    transaction.CustomerId = customerId;
    transaction.InvoiceId = invoiceId;
    transaction.MicroLoanId = loanId;
    transaction.AmortizationScheduleId = scheduleId;
    transaction.ReversalOfTransactionId = null;
    transaction.TransactionDateUtc = transactionDate;
    transaction.TransactionType = transactionType;
    transaction.ReferenceNumber = referenceNumber;
    transaction.DebitAmount = debit;
    transaction.CreditAmount = credit;
    transaction.RunningBalance = runningBalance;
    transaction.Remarks = remarks;
    transaction.CreatedByUserId = createdByUserId;
  }

  private async Task EnsureAuditPlaythroughAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      PlaythroughUsers users,
      IReadOnlyList<Customer> customers,
      DateTime yearStart,
      DateTime today,
      bool includesMls,
      CancellationToken cancellationToken) {
    var audits = new[] {
      new AuditSeed("sms-login", "SMS", "Security", "Login", "Success", users.Admin.Id, users.Admin.FullName, users.Admin.Email, "User", users.Admin.Id, users.Admin.Email, "Seeded administrator login.", yearStart.AddDays(1)),
      new AuditSeed("customer-created", "SMS", "System", "CustomerCreated", "Success", users.SmsStaff.Id, users.SmsStaff.FullName, users.SmsStaff.Email, "Customer", customers[0].Id, customers[0].FullName, "Seeded customer record created.", yearStart.AddDays(3)),
      new AuditSeed("service-scheduled", "SMS", "System", "AssignmentScheduled", "Success", users.Dispatcher.Id, users.Dispatcher.FullName, users.Dispatcher.Email, "Assignment", null, "Seeded assignment", "Dispatcher scheduled seeded service work.", yearStart.AddMonths(1)),
      new AuditSeed("billing-renewal", "SMS", "System", "BillingRenewal", "Success", users.Admin.Id, users.Admin.FullName, users.Admin.Email, "Billing", null, seed.TenantCode, "Seeded auto-renewal cycle confirmed.", today.AddDays(-7))
    };

    foreach (var audit in audits) {
      await EnsureAuditEventAsync(seed, tenantId, audit, cancellationToken);
    }

    if (includesMls && users.MlsStaff is not null) {
      await EnsureAuditEventAsync(
          seed,
          tenantId,
          new AuditSeed("mls-loan-created", "MLS", "System", "LoanCreated", "Success", users.MlsStaff.Id, users.MlsStaff.FullName, users.MlsStaff.Email, "MicroLoan", null, "Seeded loan", "MLS staff created or reviewed seeded loan activity.", yearStart.AddMonths(2)),
          cancellationToken);
    }
  }

  private async Task EnsureAuditEventAsync(
      TenantPlaythroughSeed seed,
      Guid tenantId,
      AuditSeed audit,
      CancellationToken cancellationToken) {
    var auditEvent = await FindOrAddAsync(
        StableGuid(seed.Key, "audit", audit.Key),
        () => new AuditEvent(),
        cancellationToken);

    auditEvent.TenantId = tenantId;
    auditEvent.Scope = audit.Scope;
    auditEvent.Category = audit.Category;
    auditEvent.ActionType = audit.ActionType;
    auditEvent.Outcome = audit.Outcome;
    auditEvent.ActorUserId = audit.ActorUserId;
    auditEvent.ActorName = audit.ActorName;
    auditEvent.ActorEmail = audit.ActorEmail;
    auditEvent.SubjectType = audit.SubjectType;
    auditEvent.SubjectId = audit.SubjectId;
    auditEvent.SubjectLabel = audit.SubjectLabel;
    auditEvent.Detail = audit.Detail;
    auditEvent.IpAddress = "127.0.0.1";
    auditEvent.UserAgent = "ServiFinance Production Playthrough Seeder";
    auditEvent.OccurredAtUtc = audit.OccurredAtUtc;
  }

  private async Task<T> FindOrAddAsync<T>(
      Guid id,
      Func<T> createEntity,
      CancellationToken cancellationToken)
      where T : Entity {
    var entity = await dbContext.Set<T>()
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
    if (entity is not null) {
      return entity;
    }

    entity = createEntity();
    entity.Id = id;
    dbContext.Set<T>().Add(entity);
    return entity;
  }

  private static bool HasModuleAccess(SubscriptionTier tier, string moduleCode) =>
    tier.Modules.Any(entity =>
      entity.PlatformModule is not null &&
      entity.PlatformModule.IsActive &&
      string.Equals(entity.PlatformModule.Code, moduleCode, StringComparison.OrdinalIgnoreCase) &&
      IsGrantedAccessLevel(entity.AccessLevel));

  private static bool IsGrantedAccessLevel(string? accessLevel) =>
    !string.IsNullOrWhiteSpace(accessLevel) &&
    !string.Equals(accessLevel, "Excluded", StringComparison.OrdinalIgnoreCase) &&
    !string.Equals(accessLevel, "None", StringComparison.OrdinalIgnoreCase) &&
    !string.Equals(accessLevel, "Not Included", StringComparison.OrdinalIgnoreCase);

  private static string ResolveServiceStatus(int index, int requestCount) {
    var ratio = (double)(index + 1) / requestCount;
    if (ratio <= 0.45d) {
      return "Completed";
    }

    if (ratio <= 0.58d) {
      return "Cancelled";
    }

    if (ratio <= 0.72d) {
      return "In Service";
    }

    if (ratio <= 0.84d) {
      return "Scheduled";
    }

    if (ratio <= 0.94d) {
      return "On Hold";
    }

    return "New";
  }

  private static int ResolveServiceRequestCount(TenantPlaythroughSeed seed, SubscriptionTier tier) {
    var baseline = seed.Key.Contains("micro", StringComparison.OrdinalIgnoreCase)
        ? 7
        : seed.Key.Contains("small", StringComparison.OrdinalIgnoreCase)
            ? 10
            : 14;
    return tier.IncludesMicroLendingDesktop ? baseline + 2 : baseline;
  }

  private static bool CanSeedAssignment(string status) =>
    status is "Scheduled" or "In Service" or "On Hold" or "Completed";

  private static bool CanSeedCostSheet(string status) =>
    status is "In Service" or "On Hold" or "Completed";

  private static Guid StableGuid(params string[] parts) {
    var hash = SHA256.HashData(Encoding.UTF8.GetBytes(string.Join(':', [SeedPrefix, .. parts])));
    return new Guid(hash[..16]);
  }

  private static string ToTitle(string value) =>
    CultureInfo.InvariantCulture.TextInfo.ToTitleCase(
        string.Concat(value.Select(character => char.IsUpper(character) ? $" {character}" : character.ToString()))
            .Replace("standard", " standard", StringComparison.OrdinalIgnoreCase)
            .Replace("premium", " premium", StringComparison.OrdinalIgnoreCase)
            .Trim());

  private sealed record TenantPlaythroughSeed(
      string Key,
      string DomainSlug,
      string BusinessName,
      string TenantCode,
      string TierCode,
      string AdminEmail,
      string PrimaryColor,
      string SecondaryColor);

  private sealed record CustomerPlaythroughSeed(
      string Key,
      string FullName,
      string MobileNumber,
      string Email,
      string Address,
      string AddressDetails);

  private sealed record RequestPlaythroughSeed(
      string Key,
      string ItemType,
      string ItemDescription,
      string IssueDescription,
      string ServiceMode,
      string Priority,
      decimal BasePartsAmount);

  private sealed record PresetSeed(
      string Key,
      string Category,
      string Name,
      string Specification,
      decimal Quantity,
      decimal UnitPrice);

  private sealed record CostLineSeed(
      string Key,
      string Category,
      string Name,
      string Specification,
      decimal Quantity,
      decimal UnitPrice);

  private sealed record InvoiceLineSeed(
      string Key,
      string Category,
      string Name,
      string Specification,
      decimal Quantity,
      decimal UnitPrice) {
    public string Description => Specification;
  }

  private sealed record PlaythroughUsers(
      AppUser Admin,
      AppUser SmsStaff,
      AppUser Dispatcher,
      AppUser Technician,
      AppUser? MlsStaff,
      AppUser? Cashier);

  private sealed record ServicePlaythroughContext(
      IReadOnlyList<ServiceRequest> ServiceRequests,
      IReadOnlyList<Invoice> CompletedInvoices,
      IReadOnlyList<Invoice> FinanceQueueInvoices);

  private sealed record AuditSeed(
      string Key,
      string Scope,
      string Category,
      string ActionType,
      string Outcome,
      Guid? ActorUserId,
      string ActorName,
      string ActorEmail,
      string SubjectType,
      Guid? SubjectId,
      string SubjectLabel,
      string Detail,
      DateTime OccurredAtUtc);
}
