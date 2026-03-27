namespace ServiFinance.Application.Auth;

public sealed record RootApiLoginRequest(
    string Email,
    string Password,
    bool RememberMe,
    bool UseCookieSession = false,
    string? ReturnUrl = null);

public sealed record TenantApiLoginRequest(
    string Email,
    string Password,
    string TenantDomainSlug,
    string TargetSystem,
    bool UseCookieSession = false,
    string? ReturnUrl = null);

public sealed record RefreshSessionRequest(string RefreshToken);

public sealed record AuthSessionTokens(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc);

public sealed record AuthSessionResponse(
    AuthSessionTokens Tokens,
    CurrentSessionUser User);

public sealed record CurrentSessionUser(
    Guid UserId,
    Guid TenantId,
    string TenantDomainSlug,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles,
    AuthenticationSurface Surface);
