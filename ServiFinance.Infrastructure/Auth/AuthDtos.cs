namespace ServiFinance.Infrastructure.Auth;

public sealed record AuthenticatedUser(
    Guid UserId,
    Guid TenantId,
    string TenantDomainSlug,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles);

public sealed record AvailableRole(Guid Id, string Name);

public sealed record UserListItem(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    DateTime CreatedAtUtc,
    IReadOnlyList<string> Roles);

public sealed record CreateUserRequest(
    string FullName,
    string Email,
    string Password,
    Guid RoleId);
