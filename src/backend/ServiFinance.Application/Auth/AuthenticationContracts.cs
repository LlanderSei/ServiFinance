namespace ServiFinance.Application.Auth;

public enum AuthenticationSurface {
  Root,
  TenantWeb,
  TenantDesktop,
  CustomerWeb
}

public sealed record AuthenticationRequest(
    string Email,
    string Password,
    AuthenticationSurface Surface,
    string? TenantDomainSlug = null);

public sealed record AuthenticatedUser(
    Guid UserId,
    Guid TenantId,
    string TenantDomainSlug,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> PlatformScopes,
    IReadOnlyList<string> PermissionKeys);

public sealed record AvailableRole(Guid Id, string Name, string PlatformScope);

public sealed record UserListItem(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    DateTime CreatedAtUtc,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> PlatformScopes);

public sealed record CreateUserRequest(
    string FullName,
    string Email,
    string Password,
    IReadOnlyList<Guid>? RoleIds = null,
    Guid? RoleId = null);

public sealed record UpdateUserRequest(
    string FullName,
    IReadOnlyList<Guid>? RoleIds = null,
    Guid? RoleId = null);
