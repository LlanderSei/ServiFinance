using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ServiFinance.Application.Auth;
using ServiFinance.Infrastructure.Configuration;

namespace ServiFinance.Infrastructure.Auth;

public sealed class JwtSessionTokenService(
    IOptions<SessionTokenOptions> options,
    TimeProvider timeProvider) : ISessionTokenService {
  private static readonly ConcurrentDictionary<string, RefreshSessionEntry> Sessions = new(StringComparer.Ordinal);
  private readonly SessionTokenOptions _options = options.Value;

  public Task<AuthSessionTokens> CreateSessionAsync(
      AuthenticatedUser user,
      AuthenticationSurface surface,
      bool rememberMe = false,
      CancellationToken cancellationToken = default) {
    var refreshTokenDays = rememberMe
        ? Math.Max(_options.PersistentRefreshTokenDays, 1)
        : Math.Max(_options.RefreshTokenDays, 1);

    var session = new RefreshSessionEntry(
        User: user,
        Surface: surface,
        RememberMe: rememberMe,
        ExpiresAtUtc: timeProvider.GetUtcNow().UtcDateTime.AddDays(refreshTokenDays));

    var refreshToken = GenerateRefreshToken();
    Sessions[Hash(refreshToken)] = session;

    return Task.FromResult(CreateTokens(session, refreshToken));
  }

  public Task<AuthSessionTokens?> RefreshSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default) {
    var tokenHash = Hash(refreshToken);
    if (!Sessions.TryRemove(tokenHash, out var session)) {
      return Task.FromResult<AuthSessionTokens?>(null);
    }

    if (session.ExpiresAtUtc <= timeProvider.GetUtcNow().UtcDateTime) {
      return Task.FromResult<AuthSessionTokens?>(null);
    }

    var rotatedRefreshToken = GenerateRefreshToken();
    Sessions[Hash(rotatedRefreshToken)] = session with {
        ExpiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddDays(
            session.RememberMe
                ? Math.Max(_options.PersistentRefreshTokenDays, 1)
                : Math.Max(_options.RefreshTokenDays, 1))
    };

    return Task.FromResult<AuthSessionTokens?>(CreateTokens(session, rotatedRefreshToken));
  }

  public Task RevokeSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default) {
    Sessions.TryRemove(Hash(refreshToken), out _);
    return Task.CompletedTask;
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

  private AuthSessionTokens CreateTokens(RefreshSessionEntry session, string refreshToken) {
    var expiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddMinutes(Math.Max(_options.AccessTokenMinutes, 1));
    var accessToken = CreateAccessToken(session, expiresAtUtc);

    return new AuthSessionTokens(accessToken, refreshToken, expiresAtUtc);
  }

  private string CreateAccessToken(RefreshSessionEntry session, DateTime expiresAtUtc) {
    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

    var claims = new List<Claim> {
        new(JwtRegisteredClaimNames.Sub, session.User.UserId.ToString()),
        new(JwtRegisteredClaimNames.Email, session.User.Email),
        new(ClaimTypes.NameIdentifier, session.User.UserId.ToString()),
        new(ClaimTypes.Name, session.User.FullName),
        new(ClaimTypes.Email, session.User.Email),
        new("tenant_id", session.User.TenantId.ToString()),
        new("tenant_domain_slug", session.User.TenantDomainSlug),
        new("surface", session.Surface.ToString())
    };

    claims.AddRange(session.User.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

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

  private sealed record RefreshSessionEntry(
      AuthenticatedUser User,
      AuthenticationSurface Surface,
      bool RememberMe,
      DateTime ExpiresAtUtc);
}
