namespace ServiFinance.Infrastructure.Auth;

using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Notifications;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

public sealed class AuthProtectionService(
    IMemoryCache cache,
    ServiFinanceDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IEmailSender emailSender,
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
  private const string GoogleLinkProvider = "google-auth";

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

  public async Task RecordFailedLoginAsync(
      string scope,
      string? tenantDomainSlug,
      string email,
      string? ipAddress,
      CancellationToken cancellationToken = default) {
    var now = timeProvider.GetUtcNow().UtcDateTime;
    var accountLockout = await IncrementFailureCounterAsync(
        AccountKind,
        scope,
        tenantDomainSlug,
        email,
        AccountFailureThreshold,
        TimeSpan.FromMinutes(AccountWindowMinutes),
        TimeSpan.FromMinutes(AccountLockoutMinutes),
        now,
        scope,
        tenantDomainSlug,
        cancellationToken);

    var networkLockout = await IncrementFailureCounterAsync(
        SiteKind,
        "all",
        null,
        ipAddress ?? "unknown",
        SiteFailureThreshold,
        TimeSpan.FromMinutes(SiteWindowMinutes),
        TimeSpan.FromMinutes(SiteLockoutMinutes),
        now,
        scope,
        tenantDomainSlug,
        cancellationToken);

    await SendLockoutNotificationsAsync(accountLockout, email, ipAddress, cancellationToken);
    await SendLockoutNotificationsAsync(networkLockout, email, ipAddress, cancellationToken);
  }

  public async Task RecordSuccessfulLoginAsync(
      string scope,
      string? tenantDomainSlug,
      string email,
      string? ipAddress,
      CancellationToken cancellationToken = default) {
    var accountRecord = FindRecord(AccountKind, scope, tenantDomainSlug, email);
    if (accountRecord is null) {
      return;
    }

    dbContext.AuthProtectionRecords.Remove(accountRecord);
    await dbContext.SaveChangesAsync(cancellationToken);
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

  private async Task<LockoutCreated?> IncrementFailureCounterAsync(
      string kind,
      string scope,
      string? tenantDomainSlug,
      string identity,
      int threshold,
      TimeSpan window,
      TimeSpan lockout,
      DateTime now,
      string notificationScope,
      string? notificationTenantDomainSlug,
      CancellationToken cancellationToken) {
    var normalizedScope = Normalize(scope);
    var normalizedTenant = Normalize(tenantDomainSlug ?? "none");
    var identityHash = HashIdentity(identity);
    var recordKey = BuildRecordKey(kind, normalizedScope, normalizedTenant, identityHash);
    var record = await dbContext.AuthProtectionRecords.SingleOrDefaultAsync(entity => entity.RecordKey == recordKey, cancellationToken);
    if (record?.LockedUntilUtc is DateTime retryAt && retryAt > now) {
      return null;
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
      AddLockoutAudit(kind, notificationScope, Normalize(notificationTenantDomainSlug ?? "none"), record.LockedUntilUtc.Value, now);
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    return record.LockedUntilUtc is DateTime lockedUntilUtc && lockedUntilUtc > now
        ? new LockoutCreated(kind, notificationScope, Normalize(notificationTenantDomainSlug ?? "none"), lockedUntilUtc)
        : null;
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
      Scope = ResolveAuditScope(scope),
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

  private async Task SendLockoutNotificationsAsync(
      LockoutCreated? lockout,
      string attemptedEmail,
      string? ipAddress,
      CancellationToken cancellationToken) {
    if (lockout is null || !emailSender.IsConfigured) {
      return;
    }

    var recipients = lockout.Kind == AccountKind
        ? await ResolveAccountLockoutRecipientsAsync(lockout, attemptedEmail, cancellationToken)
        : await ResolveNetworkLockoutRecipientsAsync(lockout, cancellationToken);
    if (recipients.Count == 0) {
      logger.LogInformation(
          "Skipping {Kind} lockout notification for scope {Scope} because no linked Google recipients were found.",
          lockout.Kind,
          lockout.Scope);
      return;
    }

    foreach (var recipient in recipients.DistinctBy(value => value.Email, StringComparer.OrdinalIgnoreCase)) {
      var result = await emailSender.SendAsync(
          CreateLockoutEmail(lockout, recipient, attemptedEmail, ipAddress),
          cancellationToken);
      if (!result.Sent) {
        logger.LogWarning(
            "Unable to send {Kind} lockout notification to {Email}: {Error}",
            lockout.Kind,
            recipient.Email,
            result.ErrorMessage ?? "unknown SMTP error");
      }
    }
  }

  private async Task<IReadOnlyList<LockoutEmailRecipient>> ResolveAccountLockoutRecipientsAsync(
      LockoutCreated lockout,
      string attemptedEmail,
      CancellationToken cancellationToken) {
    if (IsCustomerScope(lockout.Scope)) {
      var customer = await dbContext.Customers
          .IgnoreQueryFilters()
          .AsNoTracking()
          .Include(entity => entity.Tenant)
          .Where(entity => entity.Email == attemptedEmail)
          .Where(entity => entity.Tenant != null && entity.Tenant.DomainSlug == lockout.TenantDomainSlug)
          .Select(entity => new {
            entity.Id,
            entity.FullName,
            entity.Email
          })
          .SingleOrDefaultAsync(cancellationToken);
      if (customer is null) {
        return [];
      }

      var googleEmail = await LoadCustomerGoogleEmailAsync(customer.Id, cancellationToken);
      return string.IsNullOrWhiteSpace(googleEmail)
          ? []
          : [new LockoutEmailRecipient(customer.FullName, googleEmail, customer.Email)];
    }

    var user = await QueryUsersForScope(lockout.Scope, lockout.TenantDomainSlug)
        .Where(entity => entity.Email == attemptedEmail)
        .Select(entity => new {
          entity.Id,
          entity.FullName,
          entity.Email
        })
        .SingleOrDefaultAsync(cancellationToken);
    if (user is null) {
      return [];
    }

    var linkedEmail = await LoadStaffGoogleEmailAsync(user.Id, cancellationToken);
    return string.IsNullOrWhiteSpace(linkedEmail)
        ? []
        : [new LockoutEmailRecipient(user.FullName, linkedEmail, user.Email)];
  }

  private async Task<IReadOnlyList<LockoutEmailRecipient>> ResolveNetworkLockoutRecipientsAsync(
      LockoutCreated lockout,
      CancellationToken cancellationToken) {
    var users = await QueryUsersForScope(lockout.Scope, lockout.TenantDomainSlug)
        .Include(entity => entity.UserRoles)
        .ThenInclude(entity => entity.Role)
        .Where(entity => entity.IsActive)
        .Where(entity => IsRootScope(lockout.Scope)
            ? entity.UserRoles.Any(roleLink => roleLink.Role != null &&
                roleLink.Role.Name == PlatformRolePolicy.SuperAdminRole)
            : entity.UserRoles.Any(roleLink => roleLink.Role != null &&
                (roleLink.Role.Name == PlatformRolePolicy.OwnerRole ||
                    roleLink.Role.Name == PlatformRolePolicy.AdministratorRole ||
                    roleLink.Role.PlatformScope == PlatformRolePolicy.OwnerAdminScope)))
        .Select(entity => new {
          entity.Id,
          entity.FullName,
          entity.Email
        })
        .ToListAsync(cancellationToken);

    var recipients = new List<LockoutEmailRecipient>();
    foreach (var user in users) {
      var linkedEmail = await LoadStaffGoogleEmailAsync(user.Id, cancellationToken);
      if (!string.IsNullOrWhiteSpace(linkedEmail)) {
        recipients.Add(new LockoutEmailRecipient(user.FullName, linkedEmail, user.Email));
      }
    }

    return recipients;
  }

  private IQueryable<AppUser> QueryUsersForScope(string scope, string tenantDomainSlug) {
    var normalizedScope = Normalize(scope);
    if (IsRootScope(normalizedScope)) {
      return dbContext.Users
          .IgnoreQueryFilters()
          .Where(entity => entity.TenantId == ServiFinanceDatabaseDefaults.PlatformTenantId);
    }

    var normalizedTenant = Normalize(tenantDomainSlug);
    return dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.Tenant != null && entity.Tenant.DomainSlug == normalizedTenant);
  }

  private async Task<string?> LoadStaffGoogleEmailAsync(Guid userId, CancellationToken cancellationToken) {
    var payloadJson = await dbContext.ExternalServiceStates
        .AsNoTracking()
        .Where(entity => entity.Provider == GoogleLinkProvider && entity.StateKey == BuildGoogleUserStateKey(userId))
        .Select(entity => entity.PayloadJson)
        .SingleOrDefaultAsync(cancellationToken);
    return DeserializeGoogleLink(payloadJson)?.Email;
  }

  private async Task<string?> LoadCustomerGoogleEmailAsync(Guid customerId, CancellationToken cancellationToken) {
    var payloadJson = await dbContext.ExternalServiceStates
        .AsNoTracking()
        .Where(entity => entity.Provider == GoogleLinkProvider && entity.StateKey == BuildCustomerGoogleStateKey(customerId))
        .Select(entity => entity.PayloadJson)
        .SingleOrDefaultAsync(cancellationToken);
    return DeserializeCustomerGoogleLink(payloadJson)?.Email;
  }

  private EmailMessage CreateLockoutEmail(
      LockoutCreated lockout,
      LockoutEmailRecipient recipient,
      string attemptedEmail,
      string? ipAddress) {
    var isNetworkLockout = lockout.Kind == SiteKind;
    var scopeLabel = FormatScopeLabel(lockout.Scope, lockout.TenantDomainSlug);
    var subject = isNetworkLockout
        ? $"ServiFinance network lockout alert - {scopeLabel}"
        : "ServiFinance account lockout alert";
    var body = isNetworkLockout
        ? $"""
          A network-wide login cooldown was created for {scopeLabel}.

          Triggering login email: {attemptedEmail}
          Source IP/network: {ipAddress ?? "Unknown"}
          Locked until UTC: {lockout.LockedUntilUtc:yyyy-MM-dd HH:mm:ss}

          This alert is sent only to linked Google email addresses for root or tenant administrator accounts.
          """
        : $"""
          Your ServiFinance account was temporarily locked after repeated failed sign-in attempts.

          Account email: {recipient.AccountEmail}
          Sign-in surface: {scopeLabel}
          Source IP/network: {ipAddress ?? "Unknown"}
          Locked until UTC: {lockout.LockedUntilUtc:yyyy-MM-dd HH:mm:ss}

          If this was not you, keep MFA enabled and contact an administrator.
          """;

    return new EmailMessage(recipient.Email, subject, body);
  }

  private static string FormatScopeLabel(string scope, string tenantDomainSlug) {
    if (IsRootScope(scope)) {
      return "Root";
    }

    return IsCustomerScope(scope)
        ? $"Customer portal for {tenantDomainSlug}"
        : $"{scope} for {tenantDomainSlug}";
  }

  private static string ResolveAuditScope(string scope) {
    if (IsRootScope(scope)) {
      return "Superadmin";
    }

    if (IsCustomerScope(scope)) {
      return "Customer";
    }

    if (string.Equals(scope, "TenantMls", StringComparison.OrdinalIgnoreCase)) {
      return "TenantMls";
    }

    if (string.Equals(scope, "TenantSms", StringComparison.OrdinalIgnoreCase)) {
      return "TenantSms";
    }

    return string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase) ? "All" : scope;
  }

  private static StaffGoogleAccountLinkPayload? DeserializeGoogleLink(string? payloadJson) {
    if (string.IsNullOrWhiteSpace(payloadJson)) {
      return null;
    }

    try {
      return JsonSerializer.Deserialize<StaffGoogleAccountLinkPayload>(payloadJson);
    } catch (JsonException) {
      return null;
    }
  }

  private static CustomerGoogleAccountLinkPayload? DeserializeCustomerGoogleLink(string? payloadJson) {
    if (string.IsNullOrWhiteSpace(payloadJson)) {
      return null;
    }

    try {
      return JsonSerializer.Deserialize<CustomerGoogleAccountLinkPayload>(payloadJson);
    } catch (JsonException) {
      return null;
    }
  }

  private static bool IsRootScope(string scope) =>
    string.Equals(scope, "root", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(scope, "superadmin", StringComparison.OrdinalIgnoreCase);

  private static bool IsCustomerScope(string scope) =>
    string.Equals(scope, "customer", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(scope, "customerweb", StringComparison.OrdinalIgnoreCase);

  private static string BuildGoogleUserStateKey(Guid userId) =>
    $"google-link:user:{userId:N}";

  private static string BuildCustomerGoogleStateKey(Guid customerId) =>
    $"google-link:customer:{customerId:N}";

  private static string BuildRecordKey(string kind, string scope, string tenantDomainSlug, string identityHash) =>
    HashIdentity($"{Normalize(kind)}|{scope}|{tenantDomainSlug}|{identityHash}");

  private static string HashIdentity(string value) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(value)))).ToLowerInvariant();

  private static string Normalize(string value) =>
    value.Trim().ToLowerInvariant();

  private sealed record TurnstileValidationResponse(
      [property: JsonPropertyName("success")] bool Success,
      [property: JsonPropertyName("error-codes")] string[]? ErrorCodes);

  private sealed record LockoutCreated(
      string Kind,
      string Scope,
      string TenantDomainSlug,
      DateTime LockedUntilUtc);

  private sealed record LockoutEmailRecipient(
      string Name,
      string Email,
      string AccountEmail);

  private sealed record StaffGoogleAccountLinkPayload(
      Guid UserId,
      string Subject,
      string Email,
      string? Name,
      DateTime LinkedAtUtc);

  private sealed record CustomerGoogleAccountLinkPayload(
      Guid CustomerId,
      string Subject,
      string Email,
      string? Name,
      DateTime LinkedAtUtc);
}
