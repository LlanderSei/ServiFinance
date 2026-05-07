using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Auth;

public sealed class UserManagementService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    IRolePermissionManagementService rolePermissionManagementService) : IUserManagementService {
  private const int EmailMaxLength = 50;

  public async Task<IReadOnlyList<UserListItem>> GetUsersAsync(CancellationToken cancellationToken = default) {
    var users = await dbContext.Users
        .AsNoTracking()
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .OrderBy(entity => entity.FullName)
        .ToListAsync(cancellationToken);

    return users
        .Select(entity => ToUserListItem(
            entity,
            entity.UserRoles
                .Select(link => link.Role)
                .Where(role => role is not null)
                .Cast<Role>()))
        .ToArray();
  }

  public async Task<IReadOnlyList<AvailableRole>> GetRolesAsync(CancellationToken cancellationToken = default) {
    await rolePermissionManagementService.EnsureDefaultRoleCatalogAsync(cancellationToken);

    var roles = await dbContext.Roles
        .AsNoTracking()
        .OrderBy(entity => entity.Rank)
        .ThenBy(entity => entity.Name)
        .ToListAsync(cancellationToken);

    return roles
        .Select(entity => new AvailableRole(
            entity.Id,
            entity.Name,
            PlatformRolePolicy.ResolveRoleScope(entity.Name, entity.PlatformScope)))
        .ToArray();
  }

  public async Task<UserListItem> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default) {
    var normalizedFullName = NormalizeRequiredText(request.FullName, "Full name");
    var normalizedEmail = NormalizeRequiredText(request.Email, "Email");
    if (normalizedEmail.Length > EmailMaxLength) {
      throw new InvalidOperationException($"Email must be {EmailMaxLength} characters or fewer.");
    }

    if (string.IsNullOrWhiteSpace(request.Password)) {
      throw new InvalidOperationException("Temporary password is required.");
    }

    var normalizedEmailUpper = normalizedEmail.ToUpperInvariant();
    var existingUser = await dbContext.Users
        .IgnoreQueryFilters()
        .AnyAsync(
            entity => entity.Email.ToUpper() == normalizedEmailUpper,
            cancellationToken);

    if (existingUser) {
      throw new InvalidOperationException("A user with that email already exists.");
    }

    var roles = await ResolveSelectedRolesAsync(request.RoleIds, request.RoleId, cancellationToken);
    var user = new AppUser {
      Id = Guid.NewGuid(),
      FullName = normalizedFullName,
      Email = normalizedEmail,
      IsActive = true,
      CreatedAtUtc = DateTime.UtcNow
    };

    user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
    dbContext.Users.Add(user);
    AddRoleLinks(user.Id, roles);

    await dbContext.SaveChangesAsync(cancellationToken);
    return ToUserListItem(user, roles);
  }

  public async Task<UserListItem> UpdateUserAsync(
      Guid userId,
      UpdateUserRequest request,
      CancellationToken cancellationToken = default) {
    var user = await dbContext.Users
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .SingleOrDefaultAsync(entity => entity.Id == userId, cancellationToken)
        ?? throw new InvalidOperationException("User not found.");

    var roles = await ResolveSelectedRolesAsync(request.RoleIds, request.RoleId, cancellationToken);
    user.FullName = NormalizeRequiredText(request.FullName, "Full name");

    var targetRoleIds = roles.Select(entity => entity.Id).ToHashSet();
    var roleLinksToRemove = user.UserRoles
        .Where(entity => !targetRoleIds.Contains(entity.RoleId))
        .ToArray();

    dbContext.UserRoles.RemoveRange(roleLinksToRemove);

    var existingRoleIds = user.UserRoles
        .Where(entity => targetRoleIds.Contains(entity.RoleId))
        .Select(entity => entity.RoleId)
        .ToHashSet();

    foreach (var role in roles.Where(entity => !existingRoleIds.Contains(entity.Id))) {
      dbContext.UserRoles.Add(new UserRole {
        UserId = user.Id,
        RoleId = role.Id,
        AssignedAtUtc = DateTime.UtcNow
      });
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    return ToUserListItem(user, roles);
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

  private async Task<IReadOnlyList<Role>> ResolveSelectedRolesAsync(
      IReadOnlyList<Guid>? roleIds,
      Guid? legacyRoleId,
      CancellationToken cancellationToken) {
    var requestedRoleIds = NormalizeRequestedRoleIds(roleIds, legacyRoleId);
    if (requestedRoleIds.Count == 0) {
      throw new InvalidOperationException("Select at least one platform role.");
    }

    var roles = await dbContext.Roles
        .Where(entity => requestedRoleIds.Contains(entity.Id))
        .ToListAsync(cancellationToken);

    if (roles.Count != requestedRoleIds.Count) {
      throw new InvalidOperationException("One or more selected roles were not found for the current tenant.");
    }

    ValidateRoleSelection(roles);
    return roles
        .OrderBy(entity => PlatformRolePolicy.ResolveRoleScope(entity.Name, entity.PlatformScope))
        .ThenBy(entity => entity.Rank)
        .ThenBy(entity => entity.Name)
        .ToArray();
  }

  private static IReadOnlyList<Guid> NormalizeRequestedRoleIds(IReadOnlyList<Guid>? roleIds, Guid? legacyRoleId) {
    var requestedRoleIds = (roleIds ?? [])
        .Where(entity => entity != Guid.Empty)
        .ToList();

    if (requestedRoleIds.Count == 0 && legacyRoleId is { } roleId && roleId != Guid.Empty) {
      requestedRoleIds.Add(roleId);
    }

    return requestedRoleIds.Distinct().ToArray();
  }

  private static void ValidateRoleSelection(IReadOnlyList<Role> roles) {
    var scopes = roles
        .Select(role => new {
          Role = role,
          Scope = PlatformRolePolicy.ResolveRoleScope(role.Name, role.PlatformScope)
        })
        .ToArray();

    var allowedScopes = new[] {
        PlatformRolePolicy.OwnerAdminScope,
        PlatformRolePolicy.SmsScope,
        PlatformRolePolicy.MlsScope
    };

    if (scopes.Any(entity => !allowedScopes.Contains(entity.Scope))) {
      throw new InvalidOperationException("Only Owner/Admin, SMS, or MLS roles can be assigned from Platform Users.");
    }

    if (scopes.Any(entity => entity.Scope == PlatformRolePolicy.OwnerAdminScope)) {
      if (scopes.Length > 1) {
        throw new InvalidOperationException("Owner/Admin access cannot be combined with SMS or MLS staff roles.");
      }

      return;
    }

    var duplicatePlatformScope = scopes
        .GroupBy(entity => entity.Scope)
        .FirstOrDefault(group => group.Count() > 1);
    if (duplicatePlatformScope is not null) {
      throw new InvalidOperationException($"Only one {duplicatePlatformScope.Key} role can be assigned to a platform user.");
    }
  }

  private void AddRoleLinks(Guid userId, IReadOnlyList<Role> roles) {
    foreach (var role in roles) {
      dbContext.UserRoles.Add(new UserRole {
        UserId = userId,
        RoleId = role.Id,
        AssignedAtUtc = DateTime.UtcNow
      });
    }
  }

  private static UserListItem ToUserListItem(AppUser user, IEnumerable<Role> roles) {
    var roleNames = roles
        .Select(entity => entity.Name)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(name => name)
        .ToArray();

    var platformScopes = roles
        .Select(role => PlatformRolePolicy.ResolveRoleScope(role.Name, role.PlatformScope))
        .Where(scope => scope != PlatformRolePolicy.UnknownScope)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(scope => scope)
        .ToArray();

    return new UserListItem(
        user.Id,
        user.FullName,
        user.Email,
        user.IsActive,
        user.CreatedAtUtc,
        roleNames,
        platformScopes);
  }

  private static string NormalizeRequiredText(string value, string label) {
    var normalized = value.Trim();
    if (string.IsNullOrWhiteSpace(normalized)) {
      throw new InvalidOperationException($"{label} is required.");
    }

    return normalized;
  }
}
