using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Auth;

public sealed class UserAuthenticationService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher) : IUserAuthenticationService {
  public async Task<AuthenticatedUser?> AuthenticateAsync(
      AuthenticationRequest request,
      CancellationToken cancellationToken = default) {
    var normalizedEmail = request.Email.Trim().ToUpperInvariant();
    var normalizedTenantSlug = request.TenantDomainSlug?.Trim().ToLowerInvariant();

    var query = dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.Email.ToUpper() == normalizedEmail && entity.IsActive);

    query = request.Surface switch {
        AuthenticationSurface.Root =>
            query.Where(entity => entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId),
        AuthenticationSurface.TenantWeb
            when !string.IsNullOrWhiteSpace(normalizedTenantSlug) =>
            query.Where(entity =>
                entity.TenantId != ServiFinanceDatabaseDefaults.PlatformTenantId &&
                entity.Tenant != null &&
                entity.Tenant.DomainSlug == normalizedTenantSlug),
        AuthenticationSurface.TenantDesktop =>
            query.Where(entity => entity.TenantId != ServiFinanceDatabaseDefaults.PlatformTenantId),
        _ => query.Where(_ => false)
    };

    var user = await query
        .Include(entity => entity.Tenant)
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .ThenInclude(entity => entity!.Permissions)
        .SingleOrDefaultAsync(cancellationToken);

    if (user is null) {
      return null;
    }

    var verificationResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
    if (verificationResult == PasswordVerificationResult.Failed) {
      return null;
    }

    if (verificationResult == PasswordVerificationResult.SuccessRehashNeeded) {
      user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
      await dbContext.SaveChangesAsync(cancellationToken);
    }

    var roles = user.UserRoles
        .Select(entity => entity.Role?.Name)
        .Where(entity => !string.IsNullOrWhiteSpace(entity))
        .Cast<string>()
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(entity => entity)
        .ToArray();
    var roleRows = user.UserRoles
        .Select(entity => entity.Role)
        .Where(entity => entity is not null)
        .Cast<Role>()
        .ToArray();
    var platformScopes = ResolvePlatformScopes(roleRows);
    var permissionKeys = ResolvePermissionKeys(roleRows);

    var tenantDomainSlug = user.Tenant?.DomainSlug ?? string.Empty;
    if (!IsAllowedForSurface(
            user.TenantId,
            tenantDomainSlug,
            roles,
            platformScopes,
            request with { TenantDomainSlug = normalizedTenantSlug })) {
      return null;
    }

    var moduleAccess = await TenantModuleAccessResolver.ResolveAsync(dbContext, user.Tenant, cancellationToken);

    return new AuthenticatedUser(
        user.Id,
        user.TenantId,
        tenantDomainSlug,
        user.Email,
        user.FullName,
        roles,
        platformScopes,
        permissionKeys,
        moduleAccess);
  }

  private static bool IsAllowedForSurface(
      Guid tenantId,
      string tenantDomainSlug,
      IReadOnlyCollection<string> roles,
      IReadOnlyCollection<string> platformScopes,
      AuthenticationRequest request) {
    return request.Surface switch {
      AuthenticationSurface.Root =>
          tenantId == ServiFinanceDatabaseDefaults.PlatformTenantId &&
          (roles.Contains("SuperAdmin", StringComparer.OrdinalIgnoreCase) ||
            platformScopes.Contains(PlatformRolePolicy.RootScope, StringComparer.OrdinalIgnoreCase)),
      AuthenticationSurface.TenantWeb =>
          tenantId != ServiFinanceDatabaseDefaults.PlatformTenantId &&
          !string.IsNullOrWhiteSpace(request.TenantDomainSlug) &&
          string.Equals(tenantDomainSlug, request.TenantDomainSlug, StringComparison.OrdinalIgnoreCase) &&
          (PlatformRolePolicy.HasTenantWebAccess(roles) ||
            platformScopes.Contains(PlatformRolePolicy.SmsScope, StringComparer.OrdinalIgnoreCase) ||
            platformScopes.Contains(PlatformRolePolicy.OwnerAdminScope, StringComparer.OrdinalIgnoreCase)),
      AuthenticationSurface.TenantDesktop =>
          tenantId != ServiFinanceDatabaseDefaults.PlatformTenantId &&
          !string.IsNullOrWhiteSpace(tenantDomainSlug) &&
          (PlatformRolePolicy.HasTenantDesktopAccess(roles) ||
            platformScopes.Contains(PlatformRolePolicy.MlsScope, StringComparer.OrdinalIgnoreCase) ||
            platformScopes.Contains(PlatformRolePolicy.OwnerAdminScope, StringComparer.OrdinalIgnoreCase)),
      _ => false
    };
  }

  private static string[] ResolvePlatformScopes(IEnumerable<Role> roles) =>
    roles
      .Select(role => PlatformRolePolicy.ResolveRoleScope(role.Name, role.PlatformScope))
      .Where(scope => scope != PlatformRolePolicy.UnknownScope)
      .Distinct(StringComparer.OrdinalIgnoreCase)
      .OrderBy(scope => scope)
      .ToArray();

  private static string[] ResolvePermissionKeys(IEnumerable<Role> roles) =>
    roles
      .SelectMany(role => ResolveRolePermissionKeys(role))
      .Distinct(StringComparer.OrdinalIgnoreCase)
      .OrderBy(permissionKey => permissionKey)
      .ToArray();

  private static IEnumerable<string> ResolveRolePermissionKeys(Role role) {
    if (role.Permissions.Count > 0 && !role.IsPermissionSetLocked) {
      return role.Permissions.Select(permission => permission.PermissionKey);
    }

    var definition = RolePermissionCatalog.FindDefaultRole(role.Name)
      ?? RolePermissionCatalog.FindLegacyDefaultRole(role.Name);
    return definition?.PermissionKeys ?? role.Permissions.Select(permission => permission.PermissionKey).ToArray();
  }
}

