using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Auth;

public sealed class JwtSessionTokenService(
    ServiFinanceDbContext dbContext,
    IOptions<SessionTokenOptions> options,
    TimeProvider timeProvider) : ISessionTokenService {
  private readonly SessionTokenOptions _options = options.Value;

  public async Task<AuthSessionTokens> CreateSessionAsync(
      AuthenticatedUser user,
      AuthenticationSurface surface,
      bool rememberMe = false,
      CancellationToken cancellationToken = default) {
    var refreshTokenDays = rememberMe
        ? Math.Max(_options.PersistentRefreshTokenDays, 1)
        : Math.Max(_options.RefreshTokenDays, 1);

    var refreshToken = GenerateRefreshToken();
    var session = new RefreshSession {
        UserId = user.UserId,
        Surface = surface.ToString(),
        RememberMe = rememberMe,
        RefreshTokenHash = Hash(refreshToken),
        ExpiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddDays(refreshTokenDays),
        CreatedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
        LastRotatedAtUtc = timeProvider.GetUtcNow().UtcDateTime
    };

    dbContext.RefreshSessions.Add(session);
    await dbContext.SaveChangesAsync(cancellationToken);

    return CreateTokens(user, surface, session.RememberMe, refreshToken);
  }

  public async Task<AuthSessionTokens?> RefreshSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default) {
    var tokenHash = Hash(refreshToken);
    var session = await dbContext.RefreshSessions
        .Include(entity => entity.User)
        .SingleOrDefaultAsync(entity => entity.RefreshTokenHash == tokenHash, cancellationToken);
    if (session is null) {
      return null;
    }

    if (session.ExpiresAtUtc <= timeProvider.GetUtcNow().UtcDateTime) {
      dbContext.RefreshSessions.Remove(session);
      await dbContext.SaveChangesAsync(cancellationToken);
      return null;
    }

    var user = await GetAuthenticatedUserAsync(session.UserId, cancellationToken);
    if (user is null || !Enum.TryParse<AuthenticationSurface>(session.Surface, true, out var surface)) {
      dbContext.RefreshSessions.Remove(session);
      await dbContext.SaveChangesAsync(cancellationToken);
      return null;
    }

    if (!IsAllowedForSurface(user, surface)) {
      dbContext.RefreshSessions.Remove(session);
      await dbContext.SaveChangesAsync(cancellationToken);
      return null;
    }

    var rotatedRefreshToken = GenerateRefreshToken();
    session.RefreshTokenHash = Hash(rotatedRefreshToken);
    session.LastRotatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
    session.ExpiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddDays(
        session.RememberMe
            ? Math.Max(_options.PersistentRefreshTokenDays, 1)
            : Math.Max(_options.RefreshTokenDays, 1));
    await dbContext.SaveChangesAsync(cancellationToken);

    return CreateTokens(user, surface, session.RememberMe, rotatedRefreshToken);
  }

  public async Task RevokeSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default) {
    var session = await dbContext.RefreshSessions
        .SingleOrDefaultAsync(entity => entity.RefreshTokenHash == Hash(refreshToken), cancellationToken);
    if (session is null) {
      return;
    }

    dbContext.RefreshSessions.Remove(session);
    await dbContext.SaveChangesAsync(cancellationToken);
  }

  public CurrentSessionUser? ReadAccessToken(string accessToken) {
    var tokenHandler = new JwtSecurityTokenHandler();
    var validationParameters = CreateValidationParameters();

    try {
      var principal = tokenHandler.ValidateToken(accessToken, validationParameters, out _);
      return BuildCurrentSessionUser(principal);
    } catch {
      return null;
    }
  }

  private AuthSessionTokens CreateTokens(
      AuthenticatedUser user,
      AuthenticationSurface surface,
      bool rememberMe,
      string refreshToken) {
    var expiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddMinutes(Math.Max(_options.AccessTokenMinutes, 1));
    var accessToken = CreateAccessToken(user, surface, expiresAtUtc);

    return new AuthSessionTokens(accessToken, refreshToken, expiresAtUtc);
  }

  private string CreateAccessToken(AuthenticatedUser user, AuthenticationSurface surface, DateTime expiresAtUtc) {
    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

    var claims = new List<Claim> {
        new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
        new(JwtRegisteredClaimNames.Email, user.Email),
        new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
        new(ClaimTypes.Name, user.FullName),
        new(ClaimTypes.Email, user.Email),
        new("tenant_id", user.TenantId.ToString()),
        new("tenant_domain_slug", user.TenantDomainSlug),
        new("surface", surface.ToString())
    };

    claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

    var token = new JwtSecurityToken(
        issuer: _options.Issuer,
        audience: _options.Audience,
        claims: claims,
        notBefore: timeProvider.GetUtcNow().UtcDateTime,
        expires: expiresAtUtc,
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
  }

  private TokenValidationParameters CreateValidationParameters() => new() {
      ValidateIssuer = true,
      ValidIssuer = _options.Issuer,
      ValidateAudience = true,
      ValidAudience = _options.Audience,
      ValidateIssuerSigningKey = true,
      IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
      ValidateLifetime = true,
      ClockSkew = TimeSpan.FromMinutes(1)
  };

  private static CurrentSessionUser BuildCurrentSessionUser(ClaimsPrincipal principal) {
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var tenantId = Guid.Parse(principal.FindFirstValue("tenant_id")!);
    var tenantDomainSlug = principal.FindFirstValue("tenant_domain_slug") ?? string.Empty;
    var fullName = principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    var email = principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
    var surfaceText = principal.FindFirstValue("surface");
    _ = Enum.TryParse<AuthenticationSurface>(surfaceText, ignoreCase: true, out var surface);
    var roles = principal.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    return new CurrentSessionUser(userId, tenantId, tenantDomainSlug, email, fullName, roles, surface);
  }

  private static string GenerateRefreshToken() {
    Span<byte> buffer = stackalloc byte[32];
    RandomNumberGenerator.Fill(buffer);
    return Convert.ToBase64String(buffer)
        .Replace("+", "-", StringComparison.Ordinal)
        .Replace("/", "_", StringComparison.Ordinal)
        .TrimEnd('=');
  }

  private static string Hash(string value) {
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
    return Convert.ToHexString(bytes);
  }

  private async Task<AuthenticatedUser?> GetAuthenticatedUserAsync(Guid userId, CancellationToken cancellationToken) {
    var user = await dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.Id == userId && entity.IsActive)
        .Include(entity => entity.Tenant)
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .SingleOrDefaultAsync(cancellationToken);

    if (user is null || user.Tenant is null || !user.Tenant.IsActive) {
      return null;
    }

    var roles = user.UserRoles
        .Select(entity => entity.Role?.Name)
        .Where(entity => !string.IsNullOrWhiteSpace(entity))
        .Cast<string>()
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(entity => entity)
        .ToArray();

    return new AuthenticatedUser(
        user.Id,
        user.TenantId,
        user.Tenant.DomainSlug,
        user.Email,
        user.FullName,
        roles);
  }

  private static bool IsAllowedForSurface(AuthenticatedUser user, AuthenticationSurface surface) {
    return surface switch {
      AuthenticationSurface.Root =>
          user.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId &&
          user.Roles.Contains("SuperAdmin", StringComparer.OrdinalIgnoreCase),
      AuthenticationSurface.TenantWeb or AuthenticationSurface.TenantDesktop =>
          user.TenantId != ServiFinanceDatabaseDefaults.PlatformTenantId &&
          !string.IsNullOrWhiteSpace(user.TenantDomainSlug),
      _ => false
    };
  }
}
