namespace ServiFinance.Application.Auth;

public static class RolePermissionCatalog {
  public const int RootRank = 0;
  public const int OwnerRank = 5;
  public const int AdministratorRank = 10;
  public const int DispatcherRank = 40;
  public const int SmsStaffRank = 50;
  public const int SmsTechnicianRank = 60;
  public const int MlsStaffRank = 70;
  public const int MlsCashierRank = 80;

  private static readonly RolePermissionDefinition[] RootPermissions = [
    Permission("root.dashboard.view", "View platform dashboard", "Control Center", "Review platform-wide tenant and subscription overview.", PlatformRolePolicy.RootScope),
    Permission("root.tenants.view", "View tenants", "Tenant Operations", "Review registered tenant domains and tenant standing.", PlatformRolePolicy.RootScope),
    Permission("root.tenants.manage", "Manage tenants", "Tenant Operations", "Update tenant lifecycle state and platform tenant records.", PlatformRolePolicy.RootScope),
    Permission("root.system-health.view", "View system health", "Control Center", "Inspect API, database, migration, and catalog health.", PlatformRolePolicy.RootScope),
    Permission("root.users.manage", "Manage root users", "Administration", "Create and maintain root-side superadmin accounts.", PlatformRolePolicy.RootScope),
    Permission("root.roles-permissions.manage", "Manage root roles and permissions", "Administration", "Review and update mutable root role permission sets.", PlatformRolePolicy.RootScope),
    Permission("root.audits.view", "View root audits", "Administration", "Review platform system and security audit events.", PlatformRolePolicy.RootScope),
    Permission("root.subscriptions.manage", "Manage subscription tiers", "Commercial Catalog", "Maintain platform subscription tiers and commercial packaging.", PlatformRolePolicy.RootScope),
    Permission("root.modules.manage", "Manage modules", "Commercial Catalog", "Maintain platform module catalog entries and availability.", PlatformRolePolicy.RootScope)
  ];

  private static readonly RolePermissionDefinition[] SmsPermissions = [
    Permission("sms.dashboard.view", "View SMS dashboard", "Service Management", "Review the tenant service-operations overview.", PlatformRolePolicy.SmsScope),
    Permission("sms.customers.view", "View customers", "Customer Records", "Review tenant-scoped customer records.", PlatformRolePolicy.SmsScope),
    Permission("sms.customers.manage", "Manage customers", "Customer Records", "Create and update tenant customer records.", PlatformRolePolicy.SmsScope),
    Permission("sms.service-requests.view", "View service requests", "Service Requests", "Review service request intake and status records.", PlatformRolePolicy.SmsScope),
    Permission("sms.service-requests.manage", "Manage service requests", "Service Requests", "Create, update, and progress service requests.", PlatformRolePolicy.SmsScope),
    Permission("sms.invoices.finalize", "Finalize service invoices", "Service Requests", "Finalize finance-ready invoices from completed service work.", PlatformRolePolicy.SmsScope),
    Permission("sms.dispatch.view", "View dispatch", "Dispatch", "Review assignment workspace, pending tasks, register, timeline, and archive.", PlatformRolePolicy.SmsScope),
    Permission("sms.dispatch.schedule", "Schedule assignments", "Dispatch", "Create and reschedule technician or staff assignments.", PlatformRolePolicy.SmsScope),
    Permission("sms.dispatch.update-status", "Update dispatch status", "Dispatch", "Start work, put assignments on hold, and mark assignments completed.", PlatformRolePolicy.SmsScope),
    Permission("sms.dispatch.evidence.manage", "Manage dispatch evidence", "Dispatch", "Add or update technician evidence attached to assignments.", PlatformRolePolicy.SmsScope),
    Permission("sms.reports.view", "View operational reports", "Reports", "Review SMS operational windows, turnaround, and comparison metrics.", PlatformRolePolicy.SmsScope),
    Permission("sms.reports.export", "Export operational reports", "Reports", "Download or print SMS operational reporting outputs.", PlatformRolePolicy.SmsScope),
    Permission("sms.users.manage", "Manage platform users", "Administration", "Maintain tenant users and assign SMS or MLS platform roles.", PlatformRolePolicy.SmsScope),
    Permission("sms.roles-permissions.manage", "Manage SMS roles and permissions", "Administration", "Review and update mutable SMS role permission sets.", PlatformRolePolicy.SmsScope),
    Permission("sms.audits.view", "View SMS audits", "Administration", "Review SMS system and security audit events.", PlatformRolePolicy.SmsScope),
    Permission("sms.billing.view", "View tenant billing", "Commercial", "Review subscription standing and billing history.", PlatformRolePolicy.SmsScope),
    Permission("sms.billing.manage", "Manage tenant billing", "Commercial", "Open hosted billing portal sessions and review online renewal posture.", PlatformRolePolicy.SmsScope)
  ];

  private static readonly RolePermissionDefinition[] MlsPermissions = [
    Permission("mls.dashboard.view", "View MLS dashboard", "Micro-Lending", "Review the finance desktop dashboard and queues.", PlatformRolePolicy.MlsScope),
    Permission("mls.customer-finance.view", "View customer finance", "Customer Finance", "Review borrower records, balances, and finance history.", PlatformRolePolicy.MlsScope),
    Permission("mls.loan-conversion.manage", "Manage loan conversion", "Loan Processing", "Convert finance-ready service invoices into micro-loans.", PlatformRolePolicy.MlsScope),
    Permission("mls.standalone-loans.manage", "Manage standalone loans", "Loan Processing", "Create and manage loans outside the service invoice flow.", PlatformRolePolicy.MlsScope),
    Permission("mls.loan-accounts.view", "View loan accounts", "Loan Accounts", "Review active loans, amortization, and ledger detail.", PlatformRolePolicy.MlsScope),
    Permission("mls.loan-accounts.manage", "Manage loan accounts", "Loan Accounts", "Post payments, reverse payments, and update loan state.", PlatformRolePolicy.MlsScope),
    Permission("mls.collections.manage", "Manage collections", "Collections", "Review and act on due, overdue, and partially paid accounts.", PlatformRolePolicy.MlsScope),
    Permission("mls.reports.view", "View MLS reports", "Reports", "Review lending, collection, aging, and borrower reporting.", PlatformRolePolicy.MlsScope),
    Permission("mls.reports.export", "Export MLS reports", "Reports", "Download or print MLS reporting outputs.", PlatformRolePolicy.MlsScope),
    Permission("mls.ledger.view", "View ledger", "Ledger", "Review tenant finance ledger entries and running balance.", PlatformRolePolicy.MlsScope),
    Permission("mls.users.manage", "Manage platform users", "Administration", "Maintain tenant users and assign SMS or MLS platform roles.", PlatformRolePolicy.MlsScope),
    Permission("mls.roles-permissions.manage", "Manage MLS roles and permissions", "Administration", "Review and update mutable MLS role permission sets.", PlatformRolePolicy.MlsScope),
    Permission("mls.audits.view", "View MLS audits", "Administration", "Review MLS system and security audit events.", PlatformRolePolicy.MlsScope)
  ];

  private static readonly DefaultRoleDefinition[] RootRoles = [
    Role(
      PlatformRolePolicy.SuperAdminRole,
      "Root-domain platform super administrator.",
      PlatformRolePolicy.RootScope,
      RootRank,
      isLocked: true,
      RootPermissions.Select(permission => permission.Key).ToArray())
  ];

  private static readonly DefaultRoleDefinition[] TenantRoles = [
    Role(
      PlatformRolePolicy.OwnerRole,
      "Tenant owner with locked full SMS and MLS authority.",
      PlatformRolePolicy.OwnerAdminScope,
      OwnerRank,
      isLocked: true,
      TenantPermissionKeys),
    Role(
      PlatformRolePolicy.AdministratorRole,
      "Full-access tenant administrator role.",
      PlatformRolePolicy.OwnerAdminScope,
      AdministratorRank,
      isLocked: true,
      TenantPermissionKeys),
    Role(
      PlatformRolePolicy.SmsDispatcherRole,
      "SMS dispatch coordinator with scheduling and assignment control.",
      PlatformRolePolicy.SmsScope,
      DispatcherRank,
      isLocked: false,
      [
        "sms.dashboard.view",
        "sms.customers.view",
        "sms.service-requests.view",
        "sms.dispatch.view",
        "sms.dispatch.schedule",
        "sms.dispatch.update-status",
        "sms.dispatch.evidence.manage",
        "sms.reports.view",
        "sms.audits.view"
      ]),
    Role(
      PlatformRolePolicy.SmsStaffRole,
      "SMS workspace staff role for service management users.",
      PlatformRolePolicy.SmsScope,
      SmsStaffRank,
      isLocked: false,
      [
        "sms.dashboard.view",
        "sms.customers.view",
        "sms.customers.manage",
        "sms.service-requests.view",
        "sms.service-requests.manage",
        "sms.invoices.finalize",
        "sms.dispatch.view",
        "sms.reports.view"
      ]),
    Role(
      PlatformRolePolicy.SmsTechnicianRole,
      "SMS technician role for assigned work execution and evidence submission.",
      PlatformRolePolicy.SmsScope,
      SmsTechnicianRank,
      isLocked: false,
      [
        "sms.dashboard.view",
        "sms.service-requests.view",
        "sms.dispatch.view",
        "sms.dispatch.update-status",
        "sms.dispatch.evidence.manage"
      ]),
    Role(
      PlatformRolePolicy.MlsStaffRole,
      "MLS desktop staff role for micro-lending users.",
      PlatformRolePolicy.MlsScope,
      MlsStaffRank,
      isLocked: false,
      [
        "mls.dashboard.view",
        "mls.customer-finance.view",
        "mls.loan-conversion.manage",
        "mls.standalone-loans.manage",
        "mls.loan-accounts.view",
        "mls.loan-accounts.manage",
        "mls.collections.manage",
        "mls.reports.view",
        "mls.ledger.view"
      ]),
    Role(
      PlatformRolePolicy.MlsCashierRole,
      "MLS cashier role for payment posting, collections, and ledger review.",
      PlatformRolePolicy.MlsScope,
      MlsCashierRank,
      isLocked: false,
      [
        "mls.dashboard.view",
        "mls.customer-finance.view",
        "mls.loan-accounts.view",
        "mls.loan-accounts.manage",
        "mls.collections.manage",
        "mls.ledger.view"
      ])
  ];

  public static IReadOnlyList<RolePermissionDefinition> Permissions =>
    RootPermissions.Concat(SmsPermissions).Concat(MlsPermissions).ToArray();

  public static IReadOnlyList<DefaultRoleDefinition> DefaultRoles =>
    RootRoles.Concat(TenantRoles).ToArray();

  public static IReadOnlyList<DefaultRoleDefinition> GetRootRoles() => RootRoles;

  public static IReadOnlyList<DefaultRoleDefinition> GetTenantRoles() => TenantRoles;

  public static IReadOnlyList<RolePermissionDefinition> GetPermissionsForWorkspace(string workspaceScope) =>
    NormalizeWorkspaceScope(workspaceScope) switch {
      PlatformRolePolicy.RootScope => RootPermissions,
      PlatformRolePolicy.SmsScope => SmsPermissions,
      PlatformRolePolicy.MlsScope => MlsPermissions,
      _ => []
    };

  public static DefaultRoleDefinition? FindDefaultRole(string roleName) =>
    DefaultRoles.FirstOrDefault(role =>
      string.Equals(role.Name, roleName, StringComparison.OrdinalIgnoreCase));

  public static DefaultRoleDefinition? FindLegacyDefaultRole(string roleName) {
    if (!string.Equals(roleName, PlatformRolePolicy.LegacyStaffRole, StringComparison.OrdinalIgnoreCase)) {
      return null;
    }

    var smsStaff = FindDefaultRole(PlatformRolePolicy.SmsStaffRole);
    return smsStaff is null
      ? null
      : smsStaff with { Name = PlatformRolePolicy.LegacyStaffRole };
  }

  public static string NormalizeWorkspaceScope(string? workspaceScope) {
    if (string.Equals(workspaceScope, PlatformRolePolicy.RootScope, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(workspaceScope, "superadmin", StringComparison.OrdinalIgnoreCase)) {
      return PlatformRolePolicy.RootScope;
    }

    if (string.Equals(workspaceScope, PlatformRolePolicy.SmsScope, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(workspaceScope, "sms", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(workspaceScope, "tenant-sms", StringComparison.OrdinalIgnoreCase)) {
      return PlatformRolePolicy.SmsScope;
    }

    if (string.Equals(workspaceScope, PlatformRolePolicy.MlsScope, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(workspaceScope, "mls", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(workspaceScope, "tenant-mls", StringComparison.OrdinalIgnoreCase)) {
      return PlatformRolePolicy.MlsScope;
    }

    throw new InvalidOperationException("The requested roles and permissions scope is not supported.");
  }

  public static bool IsPermissionInWorkspace(string permissionKey, string workspaceScope) {
    var permissions = GetPermissionsForWorkspace(workspaceScope);
    return permissions.Any(permission =>
      string.Equals(permission.Key, permissionKey, StringComparison.OrdinalIgnoreCase));
  }

  public static string ResolveScopeLabel(string workspaceScope) =>
    NormalizeWorkspaceScope(workspaceScope) switch {
      PlatformRolePolicy.RootScope => "Superadmin",
      PlatformRolePolicy.SmsScope => "Tenant SMS",
      PlatformRolePolicy.MlsScope => "Tenant MLS",
      _ => "Unknown"
    };

  private static string[] TenantPermissionKeys =>
    SmsPermissions.Concat(MlsPermissions).Select(permission => permission.Key).ToArray();

  private static RolePermissionDefinition Permission(
    string key,
    string name,
    string category,
    string description,
    string scope) =>
    new(key, name, category, description, scope);

  private static DefaultRoleDefinition Role(
    string name,
    string description,
    string platformScope,
    int rank,
    bool isLocked,
    IReadOnlyList<string> permissionKeys) =>
    new(name, description, platformScope, rank, true, isLocked, permissionKeys);
}
