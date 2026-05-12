namespace ServiFinance.Application.Auth;

public sealed record CaptchaChallengeResponse(
    string ChallengeId,
    string Prompt,
    DateTime ExpiresAtUtc,
    string Provider = "local",
    string? SiteKey = null);

public sealed record CaptchaProof(
    string? ChallengeId,
    string? Answer,
    string? Token = null,
    string? Provider = null);

public sealed record PasswordPolicyContext(
    string? Email = null,
    string? FullName = null,
    string? TenantDomainSlug = null,
    string? BusinessName = null);

public sealed record PasswordPolicyResult(
    bool IsValid,
    IReadOnlyList<string> Errors);

public sealed record AuthProtectionResult(
    bool IsAllowed,
    string? ErrorMessage = null,
    DateTime? RetryAfterUtc = null);

public sealed record MfaChallengeResponse(
    bool MfaRequired,
    string ChallengeId,
    string Message,
    DateTime ExpiresAtUtc,
    string? DevelopmentCode = null);

public sealed record PasswordResetStartRequest(
    string Surface,
    string? TenantDomainSlug,
    string Email,
    CaptchaProof? Captcha);

public sealed record PasswordResetStartResponse(
    string ResetId,
    string Message,
    DateTime ExpiresAtUtc,
    bool EmailDeliveryConfigured = false,
    string? DevelopmentCode = null);

public sealed record PasswordResetCompleteRequest(
    string ResetId,
    string Code,
    string NewPassword);

public sealed record PasswordResetCompleteResponse(string Message);

public interface IPasswordPolicyService {
  PasswordPolicyResult Validate(string password, PasswordPolicyContext context);
}

public interface IAuthProtectionService {
  CaptchaChallengeResponse CreateCaptchaChallenge(bool useLocalChallenge = false);
  Task<AuthProtectionResult> ValidateCaptchaAsync(CaptchaProof? proof, string? ipAddress, CancellationToken cancellationToken);
  AuthProtectionResult CheckLoginAllowed(string scope, string? tenantDomainSlug, string email, string? ipAddress);
  Task RecordFailedLoginAsync(string scope, string? tenantDomainSlug, string email, string? ipAddress, CancellationToken cancellationToken = default);
  Task RecordSuccessfulLoginAsync(string scope, string? tenantDomainSlug, string email, string? ipAddress, CancellationToken cancellationToken = default);
}
