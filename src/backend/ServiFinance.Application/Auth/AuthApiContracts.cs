namespace ServiFinance.Application.Auth;

public sealed record RootApiLoginRequest(
    string Email,
    string Password,
    bool RememberMe,
    bool UseCookieSession = false,
    string? ReturnUrl = null,
    CaptchaProof? Captcha = null,
    string? MfaChallengeId = null,
    string? MfaCode = null);

public sealed record TenantApiLoginRequest(
    string Email,
    string Password,
    string? TenantDomainSlug,
    string TargetSystem,
    bool UseCookieSession = false,
    string? ReturnUrl = null,
    CaptchaProof? Captcha = null,
    string? MfaChallengeId = null,
    string? MfaCode = null);

public sealed record RefreshSessionRequest(string RefreshToken);

public sealed record CustomerApiLoginRequest(
    string TenantDomainSlug,
    string Email,
    string Password,
    bool UseCookieSession = true,
    CaptchaProof? Captcha = null,
    string? MfaChallengeId = null,
    string? MfaCode = null);

public sealed record CustomerRegisterRequest(
    string TenantDomainSlug,
    string FullName,
    string Email,
    string MobileNumber,
    string Address,
    string? AddressDetails,
    string Password,
    bool UseCookieSession = true,
    CaptchaProof? Captcha = null);

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
    IReadOnlyList<string> PlatformScopes,
    IReadOnlyList<string> PermissionKeys,
    IReadOnlyList<SessionModuleAccess> ModuleAccess,
    AuthenticationSurface Surface);
