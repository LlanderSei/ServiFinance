namespace ServiFinance.Infrastructure.Auth;

using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

public sealed class AuthProtectionService(
    IMemoryCache cache,
    ServiFinanceDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IOptions<TurnstileOptions> turnstileOptions,
    TimeProvider timeProvider,
    ILogger<AuthProtectionService> logger) : IAuthProtectionService {
  public const string TurnstileHttpClientName = "CloudflareTurnstile";
  private const int CaptchaLifetimeMinutes = 10;
  private const int AccountFailureThreshold = 5;
  private const int AccountWindowMinutes = 10;
  private const int AccountLockoutMinutes = 15;
  private const int SiteFailureThreshold = 25;
  private const int SiteWindowMinutes = 10;
  private const int SiteLockoutMinutes = 10;
  private const string AccountKind = "Account";
  private const string SiteKind = "Network";

  public CaptchaChallengeResponse CreateCaptchaChallenge(bool useLocalChallenge = false) {
    var options = turnstileOptions.Value;
    if (!useLocalChallenge && options.IsConfigured) {
      return new CaptchaChallengeResponse(
          Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant(),
          "Complete the human verification challenge.",
          timeProvider.GetUtcNow().UtcDateTime.AddMinutes(5),
          "turnstile",
          options.SiteKey);
    }

    var left = RandomNumberGenerator.GetInt32(3, 17);
    var right = RandomNumberGenerator.GetInt32(2, 14);
    var challengeId = Convert.ToHexString(RandomNumberGenerator.GetBytes(18)).ToLowerInvariant();
    var expiresAtUtc = timeProvider.GetUtcNow().UtcDateTime.AddMinutes(CaptchaLifetimeMinutes);

    cache.Set(
        CaptchaKey(challengeId),
        (left + right).ToString(),
        new DateTimeOffset(expiresAtUtc, TimeSpan.Zero));

    return new CaptchaChallengeResponse(
        challengeId,
        $"What is {left} + {right}?",
        expiresAtUtc);
  }

  public async Task<AuthProtectionResult> ValidateCaptchaAsync(
      CaptchaProof? proof,
      string? ipAddress,
      CancellationToken cancellationToken) {
    if (string.Equals(proof?.Provider, "local", StringComparison.OrdinalIgnoreCase)) {
      return ValidateLocalCaptcha(proof);
    }

    if (turnstileOptions.Value.IsConfigured) {
      return await ValidateTurnstileAsync(proof, ipAddress, cancellationToken);
    }

    return ValidateLocalCaptcha(proof);
  }

  public AuthProtectionResult CheckLoginAllowed(string scope, string? tenantDomainSlug, string email, string? ipAddress) {
    var now = timeProvider.GetUtcNow().UtcDateTime;
    CleanupExpiredRecords(now);

    var accountRecord = FindRecord(AccountKind, scope, tenantDomainSlug, email);
    if (accountRecord?.LockedUntilUtc is DateTime accountRetryAt && accountRetryAt > now) {
      return new AuthProtectionResult(false, "Too many failed attempts for this account. Try again later.", accountRetryAt);
    }

    var siteRecord = FindRecord(SiteKind, "all", null, ipAddress ?? "unknown");
    if (siteRecord?.LockedUntilUtc is DateTime siteRetryAt && siteRetryAt > now) {
      return new AuthProtectionResult(false, "This site is temporarily locked for your network after repeated failed attempts.", siteRetryAt);
    }

    return new AuthProtectionResult(true);
  }

  public void RecordFailedLogin(string scope, string? tenantDomainSlug, string email, string? ipAddress) {
    var now = timeProvider.GetUtcNow().UtcDateTime;
    IncrementFailureCounter(
        AccountKind,
        scope,
        tenantDomainSlug,
        email,
        AccountFailureThreshold,
        TimeSpan.FromMinutes(AccountWindowMinutes),
        TimeSpan.FromMinutes(AccountLockoutMinutes),
        now);

    IncrementFailureCounter(
        SiteKind,
        "all",
        null,
        ipAddress ?? "unknown",
        SiteFailureThreshold,
        TimeSpan.FromMinutes(SiteWindowMinutes),
        TimeSpan.FromMinutes(SiteLockoutMinutes),
        now);
  }

  public void RecordSuccessfulLogin(string scope, string? tenantDomainSlug, string email, string? ipAddress) {
    var accountRecord = FindRecord(AccountKind, scope, tenantDomainSlug, email);
    if (accountRecord is null) {
      return;
    }

    dbContext.AuthProtectionRecords.Remove(accountRecord);
    dbContext.SaveChanges();
  }

  private AuthProtectionResult ValidateLocalCaptcha(CaptchaProof? proof) {
    var challengeId = proof?.ChallengeId?.Trim();
    var answer = proof?.Answer?.Trim();
    if (string.IsNullOrWhiteSpace(challengeId) || string.IsNullOrWhiteSpace(answer)) {
      return new AuthProtectionResult(false, "Complete the CAPTCHA challenge.");
    }

    var key = CaptchaKey(challengeId);
    if (!cache.TryGetValue<string>(key, out var expectedAnswer)) {
      return new AuthProtectionResult(false, "CAPTCHA expired. Request a new challenge.");
    }

    cache.Remove(key);
    return string.Equals(expectedAnswer, answer, StringComparison.Ordinal)
        ? new AuthProtectionResult(true)
        : new AuthProtectionResult(false, "CAPTCHA answer is incorrect.");
  }

  private async Task<AuthProtectionResult> ValidateTurnstileAsync(
      CaptchaProof? proof,
      string? ipAddress,
      CancellationToken cancellationToken) {
    var token = proof?.Token?.Trim();
    if (string.IsNullOrWhiteSpace(token)) {
      return new AuthProtectionResult(false, "Complete the human verification challenge.");
    }

    if (token.Length > 2048) {
      return new AuthProtectionResult(false, "Human verification token is invalid.");
    }

    try {
      using var form = new FormUrlEncodedContent(new Dictionary<string, string> {
        ["secret"] = turnstileOptions.Value.SecretKey,
        ["response"] = token,
        ["remoteip"] = ipAddress ?? string.Empty,
        ["idempotency_key"] = Guid.NewGuid().ToString("N")
      });
      var client = httpClientFactory.CreateClient(TurnstileHttpClientName);
      using var response = await client.PostAsync("turnstile/v0/siteverify", form, cancellationToken);
      var result = await response.Content.ReadFromJsonAsync<TurnstileValidationResponse>(cancellationToken);
      if (response.IsSuccessStatusCode && result?.Success == true) {
        return new AuthProtectionResult(true);
      }

      logger.LogWarning(
          "Turnstile verification failed with status {StatusCode} and errors {Errors}.",
          response.StatusCode,
          string.Join(",", result?.ErrorCodes ?? []));
      return new AuthProtectionResult(false, "Human verification failed. Refresh the challenge and try again.");
    } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
      throw;
    } catch (Exception ex) {
      logger.LogWarning(ex, "Turnstile verification request failed.");
      return new AuthProtectionResult(false, "Human verification could not be completed. Try again.");
    }
  }

  private void IncrementFailureCounter(
      string kind,
      string scope,
      string? tenantDomainSlug,
      string identity,
      int threshold,
      TimeSpan window,
      TimeSpan lockout,
      DateTime now) {
    var normalizedScope = Normalize(scope);
    var normalizedTenant = Normalize(tenantDomainSlug ?? "none");
    var identityHash = HashIdentity(identity);
    var recordKey = BuildRecordKey(kind, normalizedScope, normalizedTenant, identityHash);
    var record = dbContext.AuthProtectionRecords.SingleOrDefault(entity => entity.RecordKey == recordKey);
    if (record?.LockedUntilUtc is DateTime retryAt && retryAt > now) {
      return;
    }

    if (record is null) {
      record = new AuthProtectionRecord {
        RecordKey = recordKey,
        Kind = kind,
        Scope = normalizedScope,
        TenantDomainSlug = normalizedTenant,
        IdentityHash = identityHash,
        FailureCount = 0,
        WindowStartedAtUtc = now,
        WindowExpiresAtUtc = now.Add(window)
      };
      dbContext.AuthProtectionRecords.Add(record);
    } else if (record.WindowExpiresAtUtc <= now) {
      record.FailureCount = 0;
      record.LockedUntilUtc = null;
      record.WindowStartedAtUtc = now;
      record.WindowExpiresAtUtc = now.Add(window);
    }

    record.FailureCount++;
    record.LastFailedAtUtc = now;
    record.UpdatedAtUtc = now;

    if (record.FailureCount >= threshold) {
      record.LockedUntilUtc = now.Add(lockout);
      record.WindowExpiresAtUtc = record.LockedUntilUtc.Value;
      record.FailureCount = 0;
      AddLockoutAudit(kind, scope, normalizedTenant, record.LockedUntilUtc.Value, now);
    }

    dbContext.SaveChanges();
  }

  private AuthProtectionRecord? FindRecord(string kind, string scope, string? tenantDomainSlug, string identity) {
    var recordKey = BuildRecordKey(
        kind,
        Normalize(scope),
        Normalize(tenantDomainSlug ?? "none"),
        HashIdentity(identity));
    return dbContext.AuthProtectionRecords.SingleOrDefault(entity => entity.RecordKey == recordKey);
  }

  private void CleanupExpiredRecords(DateTime now) {
    var expiredRecords = dbContext.AuthProtectionRecords
        .Where(entity => entity.WindowExpiresAtUtc <= now && (entity.LockedUntilUtc == null || entity.LockedUntilUtc <= now))
        .Take(100)
        .ToArray();
    if (expiredRecords.Length == 0) {
      return;
    }

    dbContext.AuthProtectionRecords.RemoveRange(expiredRecords);
    dbContext.SaveChanges();
  }

  private void AddLockoutAudit(string kind, string scope, string tenantDomainSlug, DateTime lockedUntilUtc, DateTime now) {
    dbContext.AuditEvents.Add(new AuditEvent {
      TenantId = ResolveTenantId(tenantDomainSlug),
      Scope = string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase) ? "All" : scope,
      Category = "Security",
      ActionType = kind == AccountKind ? "AccountLockoutCreated" : "NetworkLockoutCreated",
      Outcome = "Locked",
      SubjectType = "AuthProtection",
      SubjectLabel = kind,
      Detail = $"{kind} login lockout created until {lockedUntilUtc:yyyy-MM-dd HH:mm:ss} UTC.",
      OccurredAtUtc = now
    });
  }

  private Guid ResolveTenantId(string tenantDomainSlug) {
    if (string.IsNullOrWhiteSpace(tenantDomainSlug) ||
        string.Equals(tenantDomainSlug, "none", StringComparison.OrdinalIgnoreCase)) {
      return ServiFinanceDatabaseDefaults.PlatformTenantId;
    }

    return dbContext.Tenants
        .Where(tenant => tenant.DomainSlug == tenantDomainSlug)
        .Select(tenant => tenant.Id)
        .FirstOrDefault() is Guid tenantId && tenantId != Guid.Empty
        ? tenantId
        : ServiFinanceDatabaseDefaults.PlatformTenantId;
  }

  private static string CaptchaKey(string challengeId) =>
    $"auth:captcha:{challengeId}";

  private static string BuildRecordKey(string kind, string scope, string tenantDomainSlug, string identityHash) =>
    HashIdentity($"{Normalize(kind)}|{scope}|{tenantDomainSlug}|{identityHash}");

  private static string HashIdentity(string value) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(value)))).ToLowerInvariant();

  private static string Normalize(string value) =>
    value.Trim().ToLowerInvariant();

  private sealed record TurnstileValidationResponse(
      [property: JsonPropertyName("success")] bool Success,
      [property: JsonPropertyName("error-codes")] string[]? ErrorCodes);
}
