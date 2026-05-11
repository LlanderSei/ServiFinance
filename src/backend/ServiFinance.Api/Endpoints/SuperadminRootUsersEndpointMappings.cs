namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

internal static class SuperadminRootUsersEndpointMappings {
  private const int EmailMaxLength = 50;

  public static RouteGroupBuilder MapSuperadminRootUsersEndpoints(this RouteGroupBuilder superadminApi) {
    superadminApi.MapGet("/root/users", GetRootUsersAsync)
        .RequireRootPermission("root.users.manage");
    superadminApi.MapGet("/root/roles", GetRootRolesAsync)
        .RequireRootPermission("root.users.manage");
    superadminApi.MapPost("/root/users", CreateRootUserAsync)
        .RequireRootPermission("root.users.manage");
    superadminApi.MapPut("/root/users/{userId:guid}", UpdateRootUserAsync)
        .RequireRootPermission("root.users.manage");
    superadminApi.MapPost("/root/users/{userId:guid}/toggle", ToggleRootUserAsync)
        .RequireRootPermission("root.users.manage");

    return superadminApi;
  }

  private static async Task<IResult> GetRootUsersAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var users = await dbContext.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId)
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .OrderBy(entity => entity.FullName)
        .ToListAsync(cancellationToken);

    return Results.Ok(users.Select(ToUserListItem).ToArray());
  }

  private static async Task<IResult> GetRootRolesAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var role = await EnsureRootRoleAsync(dbContext, cancellationToken);
    return Results.Ok(new[] {
        new AvailableRole(role.Id, role.Name, PlatformRolePolicy.RootScope)
    });
  }

  private static async Task<IResult> CreateRootUserAsync(
      [FromBody] CreateUserRequest request,
      ServiFinanceDbContext dbContext,
      IPasswordHasher<AppUser> passwordHasher,
      IPasswordPolicyService passwordPolicyService,
      CancellationToken cancellationToken) {
    string fullName;
    string email;
    try {
      fullName = NormalizeRequiredText(request.FullName, "Full name");
      email = NormalizeRequiredText(request.Email, "Email");
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }

    if (email.Length > EmailMaxLength) {
      return Results.BadRequest(new { error = $"Email must be {EmailMaxLength} characters or fewer." });
    }

    if (string.IsNullOrWhiteSpace(request.Password)) {
      return Results.BadRequest(new { error = "Temporary password is required." });
    }

    var passwordPolicy = passwordPolicyService.Validate(
        request.Password,
        new PasswordPolicyContext(email, fullName));
    if (!passwordPolicy.IsValid) {
      return Results.BadRequest(new { error = string.Join(" ", passwordPolicy.Errors) });
    }

    var normalizedEmailUpper = email.ToUpperInvariant();
    var emailExists = await dbContext.Users
        .IgnoreQueryFilters()
        .AnyAsync(entity => entity.Email.ToUpper() == normalizedEmailUpper, cancellationToken);
    if (emailExists) {
      return Results.BadRequest(new { error = "A user with that email already exists." });
    }

    var role = await EnsureRootRoleAsync(dbContext, cancellationToken);
    var user = new AppUser {
      TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
      FullName = fullName,
      Email = email,
      IsActive = true,
      CreatedAtUtc = DateTime.UtcNow
    };
    user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

    dbContext.Users.Add(user);
    dbContext.UserRoles.Add(new UserRole {
      TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
      UserId = user.Id,
      RoleId = role.Id,
      AssignedAtUtc = DateTime.UtcNow
    });

    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(ToUserListItem(user, [role]));
  }

  private static async Task<IResult> UpdateRootUserAsync(
      Guid userId,
      [FromBody] UpdateUserRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var user = await dbContext.Users
        .IgnoreQueryFilters()
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .SingleOrDefaultAsync(
            entity => entity.Id == userId && entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId,
            cancellationToken);
    if (user is null) {
      return Results.NotFound();
    }

    var role = await EnsureRootRoleAsync(dbContext, cancellationToken);
    try {
      user.FullName = NormalizeRequiredText(request.FullName, "Full name");
    }
    catch (InvalidOperationException exception) {
      return Results.BadRequest(new { error = exception.Message });
    }

    var linksToRemove = user.UserRoles
        .Where(entity => entity.RoleId != role.Id)
        .ToArray();
    dbContext.UserRoles.RemoveRange(linksToRemove);

    if (!user.UserRoles.Any(entity => entity.RoleId == role.Id)) {
      dbContext.UserRoles.Add(new UserRole {
        TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
        UserId = user.Id,
        RoleId = role.Id,
        AssignedAtUtc = DateTime.UtcNow
      });
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(ToUserListItem(user, [role]));
  }

  private static async Task<IResult> ToggleRootUserAsync(
      Guid userId,
      [FromBody] ToggleUserStateRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var user = await dbContext.Users
        .IgnoreQueryFilters()
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .SingleOrDefaultAsync(
            entity => entity.Id == userId && entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId,
            cancellationToken);
    if (user is null) {
      return Results.NotFound();
    }

    if (!request.IsActive && user.IsActive) {
      var activeRootUserCount = await CountActiveRootUsersAsync(dbContext, cancellationToken);
      if (activeRootUserCount <= 1) {
        return Results.BadRequest(new { error = "At least one active root user must remain." });
      }
    }

    user.IsActive = request.IsActive;
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
  }

  private static async Task<int> CountActiveRootUsersAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) =>
    await dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity =>
            entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId &&
            entity.IsActive &&
            entity.UserRoles.Any(roleLink =>
                roleLink.Role != null &&
                roleLink.Role.Name == PlatformRolePolicy.SuperAdminRole))
        .CountAsync(cancellationToken);

  private static async Task<Role> EnsureRootRoleAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var role = await dbContext.Roles
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(
            entity =>
                entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId &&
                entity.Name == PlatformRolePolicy.SuperAdminRole,
            cancellationToken);

    if (role is not null) {
      if (ApplyRoleMetadata(role)) {
        await dbContext.SaveChangesAsync(cancellationToken);
      }

      return role;
    }

    role = new Role {
      TenantId = ServiFinanceDatabaseDefaults.PlatformTenantId,
      Name = PlatformRolePolicy.SuperAdminRole,
      Description = "Root-domain platform super administrator."
    };
    _ = ApplyRoleMetadata(role);
    dbContext.Roles.Add(role);
    await dbContext.SaveChangesAsync(cancellationToken);
    return role;
  }

  private static bool ApplyRoleMetadata(Role role) {
    var definition = RolePermissionCatalog.FindDefaultRole(PlatformRolePolicy.SuperAdminRole);
    if (definition is null) {
      return false;
    }

    var changed =
        role.PlatformScope != definition.PlatformScope ||
        role.Rank != definition.Rank ||
        role.IsSystemRole != definition.IsSystemRole ||
        role.IsPermissionSetLocked != definition.IsPermissionSetLocked;
    role.PlatformScope = definition.PlatformScope;
    role.Rank = definition.Rank;
    role.IsSystemRole = definition.IsSystemRole;
    role.IsPermissionSetLocked = definition.IsPermissionSetLocked;
    return changed;
  }

  private static UserListItem ToUserListItem(AppUser user) =>
    ToUserListItem(
        user,
        user.UserRoles
            .Select(entity => entity.Role)
            .Where(entity => entity is not null)
            .Cast<Role>());

  private static UserListItem ToUserListItem(AppUser user, IEnumerable<Role> roles) {
    var roleNames = roles
        .Select(entity => entity.Name)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(entity => entity)
        .ToArray();
    var platformScopes = roleNames
        .Select(PlatformRolePolicy.ResolveTenantRoleScope)
        .Where(entity => entity == PlatformRolePolicy.RootScope)
        .Distinct(StringComparer.OrdinalIgnoreCase)
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
