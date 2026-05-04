using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Auth;

public sealed class RolePermissionManagementService(
  ServiFinanceDbContext dbContext) : IRolePermissionManagementService {
  private const string RankPolicyText = "Lower rank numbers have higher authority. A role can edit only roles with a higher numeric rank and unlocked permission sets.";

  public async Task EnsureDefaultRoleCatalogAsync(CancellationToken cancellationToken = default) {
    await EnsureTenantRoleCatalogAsync(cancellationToken);
  }

  public async Task<RolePermissionWorkspaceResponse> GetWorkspaceAsync(
    string workspaceScope,
    Guid actorUserId,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    await EnsureRoleCatalogForWorkspaceAsync(normalizedScope, cancellationToken);

    var roles = await LoadWorkspaceRolesAsync(normalizedScope, cancellationToken);
    var actorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    return CreateWorkspaceResponse(normalizedScope, roles, actorRank);
  }

  public async Task<RolePermissionWorkspaceResponse> UpdateRolePermissionsAsync(
    string workspaceScope,
    Guid actorUserId,
    Guid roleId,
    UpdateRolePermissionSetRequest request,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    await EnsureRoleCatalogForWorkspaceAsync(normalizedScope, cancellationToken);

    var role = await LoadRoleForUpdateAsync(normalizedScope, roleId, cancellationToken)
        ?? throw new InvalidOperationException("Role not found for this workspace.");
    if (!IsRoleVisibleInWorkspace(role, normalizedScope)) {
      throw new InvalidOperationException("Role not found for this workspace.");
    }

    if (role.IsPermissionSetLocked) {
      throw new InvalidOperationException("This role has a locked permission set and cannot be changed.");
    }

    var actorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    if (actorRank >= ResolveRoleRank(role)) {
      throw new InvalidOperationException("You can update only roles below your current role rank.");
    }

    var workspacePermissionKeys = RolePermissionCatalog
        .GetPermissionsForWorkspace(normalizedScope)
        .Select(permission => permission.Key)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    var requestedKeys = (request.PermissionKeys ?? [])
        .Select(permission => permission.Trim())
        .Where(permission => !string.IsNullOrWhiteSpace(permission))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
    var invalidKeys = requestedKeys
        .Where(permission => !workspacePermissionKeys.Contains(permission))
        .ToArray();
    if (invalidKeys.Length > 0) {
      throw new InvalidOperationException("One or more permissions do not belong to this workspace scope.");
    }

    var currentWorkspacePermissions = role.Permissions
        .Where(permission => workspacePermissionKeys.Contains(permission.PermissionKey))
        .ToArray();
    var currentKeys = currentWorkspacePermissions
        .Select(permission => permission.PermissionKey)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    dbContext.RolePermissions.RemoveRange(currentWorkspacePermissions
        .Where(permission => !requestedKeys.Contains(permission.PermissionKey, StringComparer.OrdinalIgnoreCase)));

    foreach (var permissionKey in requestedKeys.Where(permission => !currentKeys.Contains(permission))) {
      dbContext.RolePermissions.Add(new RolePermission {
        TenantId = role.TenantId,
        RoleId = role.Id,
        PermissionKey = permissionKey,
        GrantedAtUtc = DateTime.UtcNow
      });
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    var roles = await LoadWorkspaceRolesAsync(normalizedScope, cancellationToken);
    var refreshedActorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    return CreateWorkspaceResponse(normalizedScope, roles, refreshedActorRank);
  }

  public async Task<RolePermissionWorkspaceResponse> CreateRoleAsync(
    string workspaceScope,
    Guid actorUserId,
    CreateRoleRequest request,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    await EnsureRoleCatalogForWorkspaceAsync(normalizedScope, cancellationToken);

    var name = NormalizeRequiredText(request.Name, "Role name");
    var description = NormalizeRequiredText(request.Description, "Description");
    var platformScope = NormalizeMutableRoleScope(normalizedScope, request.PlatformScope);
    var actorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    ValidateEditableRank(actorRank, request.Rank);
    await EnsureRoleNameAvailableAsync(normalizedScope, name, currentRoleId: null, cancellationToken);
    await EnsureRoleRankAvailableAsync(normalizedScope, request.Rank, currentRoleId: null, cancellationToken);

    dbContext.Roles.Add(new Role {
      Name = name,
      Description = description,
      PlatformScope = platformScope,
      Rank = request.Rank,
      IsSystemRole = false,
      IsPermissionSetLocked = false
    });

    await dbContext.SaveChangesAsync(cancellationToken);
    var roles = await LoadWorkspaceRolesAsync(normalizedScope, cancellationToken);
    var refreshedActorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    return CreateWorkspaceResponse(normalizedScope, roles, refreshedActorRank);
  }

  public async Task<RolePermissionWorkspaceResponse> UpdateRoleAsync(
    string workspaceScope,
    Guid actorUserId,
    Guid roleId,
    UpdateRoleRequest request,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    await EnsureRoleCatalogForWorkspaceAsync(normalizedScope, cancellationToken);

    var role = await LoadRoleForUpdateAsync(normalizedScope, roleId, cancellationToken)
        ?? throw new InvalidOperationException("Role not found for this workspace.");
    if (!IsRoleVisibleInWorkspace(role, normalizedScope)) {
      throw new InvalidOperationException("Role not found for this workspace.");
    }

    if (role.IsPermissionSetLocked) {
      throw new InvalidOperationException("This role is locked and cannot be edited.");
    }

    var actorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    if (actorRank >= ResolveRoleRank(role)) {
      throw new InvalidOperationException("You can update only roles below your current role rank.");
    }

    ValidateEditableRank(actorRank, request.Rank);
    var name = NormalizeRequiredText(request.Name, "Role name");
    var description = NormalizeRequiredText(request.Description, "Description");
    var platformScope = NormalizeMutableRoleScope(normalizedScope, request.PlatformScope);
    await EnsureRoleNameAvailableAsync(normalizedScope, name, role.Id, cancellationToken);
    await EnsureRoleRankAvailableAsync(normalizedScope, request.Rank, role.Id, cancellationToken);

    role.Name = name;
    role.Description = description;
    role.PlatformScope = platformScope;
    role.Rank = request.Rank;
    role.IsPermissionSetLocked = false;
    RemovePermissionsOutsideScope(role, platformScope);

    await dbContext.SaveChangesAsync(cancellationToken);
    var roles = await LoadWorkspaceRolesAsync(normalizedScope, cancellationToken);
    var refreshedActorRank = await ResolveActorRankAsync(normalizedScope, actorUserId, cancellationToken);
    return CreateWorkspaceResponse(normalizedScope, roles, refreshedActorRank);
  }

  public async Task<RoleUsersResponse> GetRoleUsersAsync(
    string workspaceScope,
    Guid roleId,
    CancellationToken cancellationToken = default) {
    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    await EnsureRoleCatalogForWorkspaceAsync(normalizedScope, cancellationToken);
    var role = await LoadRoleWithUsersAsync(normalizedScope, roleId, cancellationToken)
        ?? throw new InvalidOperationException("Role not found for this workspace.");
    if (!IsRoleVisibleInWorkspace(role, normalizedScope)) {
      throw new InvalidOperationException("Role not found for this workspace.");
    }

    return new RoleUsersResponse(
      role.Id,
      role.Name,
      role.UserRoles
          .Where(roleLink => roleLink.User is not null)
          .Select(roleLink => roleLink.User!)
          .OrderBy(user => user.FullName)
          .ThenBy(user => user.Email)
          .Select(user => new RoleUserListItem(
            user.Id,
            user.FullName,
            user.Email,
            user.IsActive,
            user.CreatedAtUtc))
          .ToArray());
  }

  private async Task EnsureRoleCatalogForWorkspaceAsync(
    string normalizedScope,
    CancellationToken cancellationToken) {
    if (normalizedScope == PlatformRolePolicy.RootScope) {
      await EnsureRootRoleCatalogAsync(cancellationToken);
      return;
    }

    await EnsureTenantRoleCatalogAsync(cancellationToken);
  }

  private async Task EnsureRootRoleCatalogAsync(CancellationToken cancellationToken) {
    var roles = await dbContext.Roles
        .IgnoreQueryFilters()
        .Include(role => role.Permissions)
        .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId)
        .ToListAsync(cancellationToken);

    EnsureDefaultRoles(
      roles,
      RolePermissionCatalog.GetRootRoles(),
      ServiFinanceDatabaseDefaults.PlatformTenantId);

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task EnsureTenantRoleCatalogAsync(CancellationToken cancellationToken) {
    var roles = await dbContext.Roles
        .Include(role => role.Permissions)
        .Include(role => role.UserRoles)
        .ToListAsync(cancellationToken);

    NormalizeLegacyStaffRoles(roles);
    EnsureDefaultRoles(roles, RolePermissionCatalog.GetTenantRoles(), tenantId: null);

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private void NormalizeLegacyStaffRoles(List<Role> roles) {
    foreach (var legacyRole in roles
        .Where(role => string.Equals(role.Name, PlatformRolePolicy.LegacyStaffRole, StringComparison.OrdinalIgnoreCase))
        .ToArray()) {
      var smsStaffRole = roles.FirstOrDefault(role =>
        role.Id != legacyRole.Id &&
        role.TenantId == legacyRole.TenantId &&
        string.Equals(role.Name, PlatformRolePolicy.SmsStaffRole, StringComparison.OrdinalIgnoreCase));
      if (smsStaffRole is null) {
        legacyRole.Name = PlatformRolePolicy.SmsStaffRole;
        continue;
      }

      foreach (var roleLink in legacyRole.UserRoles.ToArray()) {
        if (smsStaffRole.UserRoles.Any(existing => existing.UserId == roleLink.UserId)) {
          dbContext.UserRoles.Remove(roleLink);
          continue;
        }

        legacyRole.UserRoles.Remove(roleLink);
        roleLink.RoleId = smsStaffRole.Id;
        roleLink.Role = smsStaffRole;
        smsStaffRole.UserRoles.Add(roleLink);
      }

      dbContext.RolePermissions.RemoveRange(legacyRole.Permissions.ToArray());
      dbContext.Roles.Remove(legacyRole);
      roles.Remove(legacyRole);
    }
  }

  private void EnsureDefaultRoles(
    List<Role> roles,
    IReadOnlyList<DefaultRoleDefinition> definitions,
    Guid? tenantId) {
    foreach (var definition in definitions) {
      var role = roles.FirstOrDefault(existing =>
        string.Equals(existing.Name, definition.Name, StringComparison.OrdinalIgnoreCase));
      if (role is null) {
        role = new Role {
          TenantId = tenantId ?? Guid.Empty,
          Name = definition.Name
        };
        dbContext.Roles.Add(role);
        roles.Add(role);
      }

      ApplyRoleDefinition(role, definition);
      EnsureDefaultPermissions(
        role,
        definition.PermissionKeys,
        exact: definition.IsPermissionSetLocked,
        tenantId ?? role.TenantId);
    }
  }

  private static void ApplyRoleDefinition(Role role, DefaultRoleDefinition definition) {
    role.Name = definition.Name;
    role.Description = definition.Description;
    role.PlatformScope = definition.PlatformScope;
    role.Rank = definition.Rank;
    role.IsSystemRole = definition.IsSystemRole;
    role.IsPermissionSetLocked = definition.IsPermissionSetLocked;
  }

  private void EnsureDefaultPermissions(
    Role role,
    IReadOnlyList<string> permissionKeys,
    bool exact,
    Guid tenantId) {
    var defaultKeys = permissionKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);
    var currentPermissions = role.Permissions.ToArray();
    if (exact) {
      dbContext.RolePermissions.RemoveRange(currentPermissions
          .Where(permission => !defaultKeys.Contains(permission.PermissionKey)));
    }

    if (!exact && currentPermissions.Length > 0) {
      return;
    }

    var currentKeys = currentPermissions
        .Select(permission => permission.PermissionKey)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    foreach (var permissionKey in permissionKeys.Where(permission => !currentKeys.Contains(permission))) {
      dbContext.RolePermissions.Add(new RolePermission {
        TenantId = tenantId,
        RoleId = role.Id,
        PermissionKey = permissionKey,
        GrantedAtUtc = DateTime.UtcNow
      });
    }
  }

  private async Task<IReadOnlyList<Role>> LoadWorkspaceRolesAsync(
    string normalizedScope,
    CancellationToken cancellationToken) {
    IQueryable<Role> query = dbContext.Roles
        .Include(role => role.UserRoles)
        .Include(role => role.Permissions);

    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var roles = await query.ToListAsync(cancellationToken);
    return roles
        .Where(role => IsRoleVisibleInWorkspace(role, normalizedScope))
        .OrderBy(ResolveRoleRank)
        .ThenBy(role => role.Name)
        .ToArray();
  }

  private async Task<Role?> LoadRoleForUpdateAsync(
    string normalizedScope,
    Guid roleId,
    CancellationToken cancellationToken) {
    IQueryable<Role> query = dbContext.Roles
        .Include(role => role.Permissions);

    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    return await query.SingleOrDefaultAsync(role => role.Id == roleId, cancellationToken);
  }

  private async Task<Role?> LoadRoleWithUsersAsync(
    string normalizedScope,
    Guid roleId,
    CancellationToken cancellationToken) {
    IQueryable<Role> query = dbContext.Roles
        .Include(role => role.UserRoles)
        .ThenInclude(roleLink => roleLink.User);

    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    return await query.SingleOrDefaultAsync(role => role.Id == roleId, cancellationToken);
  }

  private async Task EnsureRoleNameAvailableAsync(
    string normalizedScope,
    string name,
    Guid? currentRoleId,
    CancellationToken cancellationToken) {
    IQueryable<Role> query = dbContext.Roles;
    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var nameTaken = await query.AnyAsync(
      role =>
        (currentRoleId == null || role.Id != currentRoleId.Value) &&
        role.Name.ToUpper() == name.ToUpperInvariant(),
      cancellationToken);
    if (nameTaken) {
      throw new InvalidOperationException("A role with that name already exists in this scope.");
    }
  }

  private async Task EnsureRoleRankAvailableAsync(
    string normalizedScope,
    int rank,
    Guid? currentRoleId,
    CancellationToken cancellationToken) {
    IQueryable<Role> query = dbContext.Roles;
    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(role => role.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var roles = await query.ToListAsync(cancellationToken);
    var rankTaken = roles.Any(role =>
      (currentRoleId == null || role.Id != currentRoleId.Value) &&
      ResolveRoleRank(role) == rank);
    if (rankTaken) {
      throw new InvalidOperationException("Another role already uses that rank in this role catalog.");
    }
  }

  private void RemovePermissionsOutsideScope(Role role, string platformScope) {
    var allowedKeys = platformScope == PlatformRolePolicy.OwnerAdminScope
      ? RolePermissionCatalog.GetPermissionsForWorkspace(PlatformRolePolicy.SmsScope)
          .Concat(RolePermissionCatalog.GetPermissionsForWorkspace(PlatformRolePolicy.MlsScope))
          .Select(permission => permission.Key)
          .ToHashSet(StringComparer.OrdinalIgnoreCase)
      : RolePermissionCatalog.GetPermissionsForWorkspace(platformScope)
          .Select(permission => permission.Key)
          .ToHashSet(StringComparer.OrdinalIgnoreCase);

    dbContext.RolePermissions.RemoveRange(role.Permissions
        .Where(permission => !allowedKeys.Contains(permission.PermissionKey)));
  }

  private async Task<int> ResolveActorRankAsync(
    string normalizedScope,
    Guid actorUserId,
    CancellationToken cancellationToken) {
    IQueryable<UserRole> query = dbContext.UserRoles
        .Include(roleLink => roleLink.Role);

    if (normalizedScope == PlatformRolePolicy.RootScope) {
      query = query
          .IgnoreQueryFilters()
          .Where(roleLink => roleLink.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var actorRoles = await query
        .Where(roleLink => roleLink.UserId == actorUserId)
        .Select(roleLink => roleLink.Role)
        .Where(role => role != null)
        .ToListAsync(cancellationToken);

    var ranks = actorRoles
        .Cast<Role>()
        .Where(role => IsRoleVisibleInWorkspace(role, normalizedScope))
        .Select(ResolveRoleRank)
        .ToArray();

    return ranks.Length == 0 ? int.MaxValue : ranks.Min();
  }

  private static bool IsRoleVisibleInWorkspace(Role role, string normalizedScope) {
    var roleScope = ResolveRoleScope(role);
    return normalizedScope switch {
      PlatformRolePolicy.RootScope => roleScope == PlatformRolePolicy.RootScope,
      PlatformRolePolicy.SmsScope => roleScope is PlatformRolePolicy.OwnerAdminScope or PlatformRolePolicy.SmsScope,
      PlatformRolePolicy.MlsScope => roleScope is PlatformRolePolicy.OwnerAdminScope or PlatformRolePolicy.MlsScope,
      _ => false
    };
  }

  private static string NormalizeMutableRoleScope(string workspaceScope, string? requestedScope) {
    var normalizedScope = PlatformRolePolicy.NormalizeRoleScope(requestedScope);
    if (workspaceScope == PlatformRolePolicy.RootScope) {
      return normalizedScope == PlatformRolePolicy.RootScope
        ? normalizedScope
        : throw new InvalidOperationException("Root roles must stay in the Root scope.");
    }

    if (normalizedScope is PlatformRolePolicy.SmsScope or PlatformRolePolicy.MlsScope) {
      return normalizedScope;
    }

    throw new InvalidOperationException("Tenant custom roles must use the SMS or MLS scope.");
  }

  private static void ValidateEditableRank(int actorRank, int requestedRank) {
    if (requestedRank <= 0) {
      throw new InvalidOperationException("Role rank must be greater than zero.");
    }

    if (actorRank >= requestedRank) {
      throw new InvalidOperationException("Role rank must stay below the current user's role rank.");
    }
  }

  private static string NormalizeRequiredText(string value, string label) {
    var normalized = value.Trim();
    if (string.IsNullOrWhiteSpace(normalized)) {
      throw new InvalidOperationException($"{label} is required.");
    }

    return normalized;
  }

  private static RolePermissionWorkspaceResponse CreateWorkspaceResponse(
    string normalizedScope,
    IReadOnlyList<Role> roles,
    int actorRank) {
    var permissions = RolePermissionCatalog.GetPermissionsForWorkspace(normalizedScope);
    return new RolePermissionWorkspaceResponse(
      normalizedScope,
      RolePermissionCatalog.ResolveScopeLabel(normalizedScope),
      roles.Select(role => new RolePermissionRoleRow(
        role.Id,
        role.Name,
        role.Description,
        ResolveRoleScope(role),
        ResolveRoleRank(role),
        role.IsSystemRole,
        role.IsPermissionSetLocked,
        role.UserRoles.Count,
        role.Permissions
            .Select(permission => permission.PermissionKey)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(permission => permission)
            .ToArray(),
        !role.IsPermissionSetLocked && actorRank < ResolveRoleRank(role))).ToArray(),
      permissions,
      RankPolicyText);
  }

  private static string ResolveRoleScope(Role role) =>
    PlatformRolePolicy.ResolveRoleScope(role.Name, role.PlatformScope);

  private static int ResolveRoleRank(Role role) =>
    role.Rank <= 0 && !PlatformRolePolicy.IsRootRole(role.Name)
      ? RolePermissionCatalog.FindDefaultRole(role.Name)?.Rank ??
        RolePermissionCatalog.FindLegacyDefaultRole(role.Name)?.Rank ??
        role.Rank
      : role.Rank;
}
