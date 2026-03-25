using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Infrastructure.Domain;

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
            query.Where(entity => entity.TenantId == Configuration.ServiFinanceDatabaseDefaults.PlatformTenantId),
        AuthenticationSurface.TenantWeb or AuthenticationSurface.TenantDesktop
            when !string.IsNullOrWhiteSpace(normalizedTenantSlug) =>
            query.Where(entity =>
                entity.TenantId != Configuration.ServiFinanceDatabaseDefaults.PlatformTenantId &&
                entity.Tenant != null &&
                entity.Tenant.DomainSlug == normalizedTenantSlug),
        _ => query.Where(_ => false)
    };

    var user = await query
        .Include(entity => entity.Tenant)
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
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

    var tenantDomainSlug = user.Tenant?.DomainSlug ?? string.Empty;
    if (!IsAllowedForSurface(
            user.TenantId,
            tenantDomainSlug,
            roles,
            request with { TenantDomainSlug = normalizedTenantSlug })) {
      return null;
    }

    return new AuthenticatedUser(
        user.Id,
        user.TenantId,
        tenantDomainSlug,
        user.Email,
        user.FullName,
        roles);
  }

  private static bool IsAllowedForSurface(
      Guid tenantId,
      string tenantDomainSlug,
      IReadOnlyCollection<string> roles,
      AuthenticationRequest request) {
    return request.Surface switch {
      AuthenticationSurface.Root =>
          tenantId == Configuration.ServiFinanceDatabaseDefaults.PlatformTenantId &&
          roles.Contains("SuperAdmin", StringComparer.OrdinalIgnoreCase),
      AuthenticationSurface.TenantWeb or AuthenticationSurface.TenantDesktop =>
          tenantId != Configuration.ServiFinanceDatabaseDefaults.PlatformTenantId &&
          !string.IsNullOrWhiteSpace(request.TenantDomainSlug) &&
          string.Equals(tenantDomainSlug, request.TenantDomainSlug, StringComparison.OrdinalIgnoreCase),
      _ => false
    };
  }
}
