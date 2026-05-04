namespace ServiFinance.Application.Auth;

public static class PlatformRolePolicy {
  public const string SuperAdminRole = "SuperAdmin";
  public const string AdministratorRole = "Administrator";
  public const string OwnerRole = "Owner";
  public const string LegacyStaffRole = "Staff";
  public const string SmsStaffRole = "SMS Staff";
  public const string SmsDispatcherRole = "SMS Dispatcher";
  public const string SmsTechnicianRole = "SMS Technician";
  public const string MlsStaffRole = "MLS Staff";
  public const string MlsCashierRole = "MLS Cashier";
  public const string RootScope = "Root";
  public const string OwnerAdminScope = "OwnerAdmin";
  public const string SmsScope = "SMS";
  public const string MlsScope = "MLS";
  public const string UnknownScope = "Unknown";

  public static string ResolveTenantRoleScope(string roleName) {
    if (IsRootRole(roleName)) {
      return RootScope;
    }

    if (IsTenantAdministratorRole(roleName)) {
      return OwnerAdminScope;
    }

    if (IsSmsRole(roleName)) {
      return SmsScope;
    }

    return IsMlsRole(roleName)
        ? MlsScope
        : UnknownScope;
  }

  public static string ResolveRoleScope(string roleName, string? storedScope) {
    var normalizedScope = NormalizeRoleScope(storedScope);
    return normalizedScope == UnknownScope
        ? ResolveTenantRoleScope(roleName)
        : normalizedScope;
  }

  public static string NormalizeRoleScope(string? scope) {
    if (string.Equals(scope, RootScope, StringComparison.OrdinalIgnoreCase)) {
      return RootScope;
    }

    if (string.Equals(scope, OwnerAdminScope, StringComparison.OrdinalIgnoreCase)) {
      return OwnerAdminScope;
    }

    if (string.Equals(scope, SmsScope, StringComparison.OrdinalIgnoreCase)) {
      return SmsScope;
    }

    if (string.Equals(scope, MlsScope, StringComparison.OrdinalIgnoreCase)) {
      return MlsScope;
    }

    return UnknownScope;
  }

  public static bool IsTenantAdministratorRole(string roleName) =>
      string.Equals(roleName, AdministratorRole, StringComparison.OrdinalIgnoreCase) ||
      string.Equals(roleName, OwnerRole, StringComparison.OrdinalIgnoreCase);

  public static bool IsRootRole(string roleName) =>
      string.Equals(roleName, SuperAdminRole, StringComparison.OrdinalIgnoreCase);

  public static bool HasTenantWebAccess(IEnumerable<string> roles) =>
      roles.Any(role => IsTenantAdministratorRole(role) || IsSmsRole(role));

  public static bool HasTenantDesktopAccess(IEnumerable<string> roles) =>
      roles.Any(role => IsTenantAdministratorRole(role) || IsMlsRole(role));

  public static bool IsSmsRole(string roleName) =>
      string.Equals(roleName, LegacyStaffRole, StringComparison.OrdinalIgnoreCase) ||
      roleName.StartsWith("SMS ", StringComparison.OrdinalIgnoreCase);

  public static bool IsMlsRole(string roleName) =>
      roleName.StartsWith("MLS ", StringComparison.OrdinalIgnoreCase);
}
