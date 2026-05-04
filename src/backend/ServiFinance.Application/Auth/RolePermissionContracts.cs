namespace ServiFinance.Application.Auth;

public sealed record RolePermissionDefinition(
  string Key,
  string Name,
  string Category,
  string Description,
  string Scope);

public sealed record DefaultRoleDefinition(
  string Name,
  string Description,
  string PlatformScope,
  int Rank,
  bool IsSystemRole,
  bool IsPermissionSetLocked,
  IReadOnlyList<string> PermissionKeys);

public sealed record RolePermissionRoleRow(
  Guid Id,
  string Name,
  string Description,
  string PlatformScope,
  int Rank,
  bool IsSystemRole,
  bool IsPermissionSetLocked,
  int AssignedUserCount,
  IReadOnlyList<string> PermissionKeys,
  bool CanEditPermissions);

public sealed record RolePermissionWorkspaceResponse(
  string Scope,
  string ScopeLabel,
  IReadOnlyList<RolePermissionRoleRow> Roles,
  IReadOnlyList<RolePermissionDefinition> Permissions,
  string RankPolicy);

public sealed record UpdateRolePermissionSetRequest(IReadOnlyList<string> PermissionKeys);

public sealed record CreateRoleRequest(
  string Name,
  string Description,
  string PlatformScope,
  int Rank);

public sealed record UpdateRoleRequest(
  string Name,
  string Description,
  string PlatformScope,
  int Rank);

public sealed record RoleUserListItem(
  Guid Id,
  string FullName,
  string Email,
  bool IsActive,
  DateTime CreatedAtUtc);

public sealed record RoleUsersResponse(
  Guid RoleId,
  string RoleName,
  IReadOnlyList<RoleUserListItem> Users);

public interface IRolePermissionManagementService {
  Task EnsureDefaultRoleCatalogAsync(CancellationToken cancellationToken = default);
  Task<RolePermissionWorkspaceResponse> GetWorkspaceAsync(
    string workspaceScope,
    Guid actorUserId,
    CancellationToken cancellationToken = default);
  Task<RolePermissionWorkspaceResponse> UpdateRolePermissionsAsync(
    string workspaceScope,
    Guid actorUserId,
    Guid roleId,
    UpdateRolePermissionSetRequest request,
    CancellationToken cancellationToken = default);
  Task<RolePermissionWorkspaceResponse> CreateRoleAsync(
    string workspaceScope,
    Guid actorUserId,
    CreateRoleRequest request,
    CancellationToken cancellationToken = default);
  Task<RolePermissionWorkspaceResponse> UpdateRoleAsync(
    string workspaceScope,
    Guid actorUserId,
    Guid roleId,
    UpdateRoleRequest request,
    CancellationToken cancellationToken = default);
  Task<RoleUsersResponse> GetRoleUsersAsync(
    string workspaceScope,
    Guid roleId,
    CancellationToken cancellationToken = default);
}
