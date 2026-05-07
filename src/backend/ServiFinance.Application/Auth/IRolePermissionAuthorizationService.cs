namespace ServiFinance.Application.Auth;

public interface IRolePermissionAuthorizationService {
  Task<bool> HasPermissionAsync(
    Guid userId,
    string workspaceScope,
    string permissionKey,
    CancellationToken cancellationToken = default);
}
