using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Infrastructure.Domain;

namespace ServiFinance.Infrastructure.Auth;

public sealed class UserManagementService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher) : IUserManagementService {
  public async Task<IReadOnlyList<UserListItem>> GetUsersAsync(CancellationToken cancellationToken = default) {
    return await dbContext.Users
        .AsNoTracking()
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .OrderBy(entity => entity.FullName)
        .Select(entity => new UserListItem(
            entity.Id,
            entity.FullName,
            entity.Email,
            entity.IsActive,
            entity.CreatedAtUtc,
            entity.UserRoles
                .Select(link => link.Role!.Name)
                .Distinct()
                .OrderBy(name => name)
                .ToArray()))
        .ToListAsync(cancellationToken);
  }

  public async Task<IReadOnlyList<AvailableRole>> GetRolesAsync(CancellationToken cancellationToken = default) {
    return await dbContext.Roles
        .AsNoTracking()
        .OrderBy(entity => entity.Name)
        .Select(entity => new AvailableRole(entity.Id, entity.Name))
        .ToListAsync(cancellationToken);
  }

  public async Task<UserListItem> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default) {
    var normalizedEmail = request.Email.Trim();
    var existingUser = await dbContext.Users.AnyAsync(
        entity => entity.Email == normalizedEmail,
        cancellationToken);

    if (existingUser) {
      throw new InvalidOperationException("A user with that email already exists.");
    }

    var role = await dbContext.Roles.SingleOrDefaultAsync(entity => entity.Id == request.RoleId, cancellationToken);
    if (role is null) {
      throw new InvalidOperationException("The selected role was not found for the current tenant.");
    }

    var user = new AppUser {
      FullName = request.FullName.Trim(),
      Email = normalizedEmail,
      IsActive = true,
      CreatedAtUtc = DateTime.UtcNow
    };

    user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync(cancellationToken);

    dbContext.UserRoles.Add(new UserRole {
      UserId = user.Id,
      RoleId = role.Id,
      AssignedAtUtc = DateTime.UtcNow
    });

    await dbContext.SaveChangesAsync(cancellationToken);

    return new UserListItem(
        user.Id,
        user.FullName,
        user.Email,
        user.IsActive,
        user.CreatedAtUtc,
        [role.Name]);
  }

  public async Task SetUserActiveStateAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default) {
    var user = await dbContext.Users.SingleOrDefaultAsync(entity => entity.Id == userId, cancellationToken)
        ?? throw new InvalidOperationException("User not found.");

    user.IsActive = isActive;
    await dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default) {
    var user = await dbContext.Users.SingleOrDefaultAsync(entity => entity.Id == userId, cancellationToken)
        ?? throw new InvalidOperationException("User not found.");

    user.PasswordHash = passwordHasher.HashPassword(user, newPassword);
    await dbContext.SaveChangesAsync(cancellationToken);
  }
}
