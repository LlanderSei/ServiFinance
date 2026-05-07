using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Auth;

public sealed class RolePermissionAuthorizationService(
  ServiFinanceDbContext dbContext) : IRolePermissionAuthorizationService {
  public async Task<bool> HasPermissionAsync(
    Guid userId,
    string workspaceScope,
    string permissionKey,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    if (!RolePermissionCatalog.IsPermissionInWorkspace(permissionKey, normalizedScope)) {
      return false;
    }

    IQueryable<UserRole> query = dbContext.UserRoles
      .Include(roleLink => roleLink.Role)
      .ThenInclude(role => role!.Permissions);

    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
        .IgnoreQueryFilters()
        .Where(roleLink => roleLink.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var roles = await query
      .Where(roleLink => roleLink.UserId == userId)
      .Select(roleLink => roleLink.Role)
      .Where(role => role != null)
      .ToListAsync(cancellationToken);

    foreach (var role in roles.Cast<Role>().Where(role => IsRoleVisibleInWorkspace(role, normalizedScope))) {
      if (role.Permissions.Any(permission =>
        string.Equals(permission.PermissionKey, permissionKey, StringComparison.OrdinalIgnoreCase))) {
        return true;
      }

      if ((role.IsPermissionSetLocked || role.Permissions.Count == 0) &&
          DefaultRoleGrantsPermission(role, permissionKey)) {
        return true;
      }
    }

    return false;
  }

  private static bool DefaultRoleGrantsPermission(Role role, string permissionKey) {
    var definition = RolePermissionCatalog.FindDefaultRole(role.Name)
      ?? RolePermissionCatalog.FindLegacyDefaultRole(role.Name);
    return definition is not null && definition.PermissionKeys.Contains(permissionKey, StringComparer.OrdinalIgnoreCase);
  }

  private static bool IsRoleVisibleInWorkspace(Role role, string normalizedScope) {
    var roleScope = PlatformRolePolicy.ResolveRoleScope(role.Name, role.PlatformScope);
    return normalizedScope switch {
      PlatformRolePolicy.RootScope => roleScope == PlatformRolePolicy.RootScope,
      PlatformRolePolicy.SmsScope => roleScope is PlatformRolePolicy.OwnerAdminScope or PlatformRolePolicy.SmsScope,
      PlatformRolePolicy.MlsScope => roleScope is PlatformRolePolicy.OwnerAdminScope or PlatformRolePolicy.MlsScope,
      _ => false
    };
  }
}
