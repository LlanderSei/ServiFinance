namespace ServiFinance.Infrastructure.Auth;

public interface IUserManagementService {
  Task<IReadOnlyList<UserListItem>> GetUsersAsync(CancellationToken cancellationToken = default);
  Task<IReadOnlyList<AvailableRole>> GetRolesAsync(CancellationToken cancellationToken = default);
  Task<UserListItem> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
  Task SetUserActiveStateAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default);
  Task ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default);
}
