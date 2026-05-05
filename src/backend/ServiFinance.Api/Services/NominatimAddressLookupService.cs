namespace ServiFinance.Api.Services;

using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

internal interface IAddressLookupService {
  Task<IReadOnlyList<AddressLookupResult>> SearchAsync(string query, int limit, CancellationToken cancellationToken);
}

internal sealed class AddressLookupValidationException(string message) : Exception(message);

internal sealed class AddressLookupUnavailableException : Exception {
  public AddressLookupUnavailableException(string message, TimeSpan? backoff = null)
      : base(message) {
    Backoff = backoff ?? TimeSpan.Zero;
  }

  public TimeSpan Backoff { get; }
}

internal sealed record AddressLookupResult(
  string DisplayName,
  double Latitude,
  double Longitude,
  string OpenStreetMapUrl);

internal sealed class NominatimAddressLookupService : IAddressLookupService {
  internal const string HttpClientName = "NominatimAddressLookup";

  private const string ProviderName = "Nominatim";
  private const string ThrottleStateKey = "__throttle__";
  private const string DistributedLockResource = "external-service:nominatim-address-search";
  private const int DistributedLockTimeoutMilliseconds = 15000;
  private const int MinimumQueryLength = 5;
  private const int MaximumQueryLength = 160;
  private const int MaximumResultLimit = 5;
  private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(6);
  private static readonly TimeSpan MinimumSpacing = TimeSpan.FromSeconds(1);
  private static readonly TimeSpan FailureBackoff = TimeSpan.FromSeconds(5);
  private static readonly TimeSpan RateLimitBackoff = TimeSpan.FromSeconds(15);
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

  private readonly IHttpClientFactory _httpClientFactory;
  private readonly IMemoryCache _memoryCache;
  private readonly ServiFinanceDbContext _dbContext;
  private readonly ILogger<NominatimAddressLookupService> _logger;

  public NominatimAddressLookupService(
    IHttpClientFactory httpClientFactory,
    IMemoryCache memoryCache,
    ServiFinanceDbContext dbContext,
    ILogger<NominatimAddressLookupService> logger) {
      _httpClientFactory = httpClientFactory;
      _memoryCache = memoryCache;
      _dbContext = dbContext;
      _logger = logger;
    }

  public async Task<IReadOnlyList<AddressLookupResult>> SearchAsync(string query, int limit, CancellationToken cancellationToken) {
    var normalizedQuery = NormalizeQuery(query);
    var normalizedLimit = Math.Clamp(limit, 1, MaximumResultLimit);
    var cacheKey = $"search:{normalizedLimit}:{normalizedQuery.ToLowerInvariant()}";

    if (_memoryCache.TryGetValue<IReadOnlyList<AddressLookupResult>>(cacheKey, out var cachedResults) &&
        cachedResults is not null) {
      return cachedResults;
    }

    var persistedCache = await TryGetPersistedCacheAsync(cacheKey, cancellationToken);
    if (persistedCache is not null) {
      SetProcessCache(cacheKey, persistedCache.Results, persistedCache.ExpiresAtUtc);
      return persistedCache.Results;
    }

    var connection = _dbContext.Database.GetDbConnection();
    var shouldCloseConnection = connection.State != ConnectionState.Open;
    if (shouldCloseConnection) {
      await _dbContext.Database.OpenConnectionAsync(cancellationToken);
    }

    try {
      await AcquireDistributedLockAsync(connection, cancellationToken);

      persistedCache = await TryGetPersistedCacheAsync(cacheKey, cancellationToken);
      if (persistedCache is not null) {
        SetProcessCache(cacheKey, persistedCache.Results, persistedCache.ExpiresAtUtc);
        return persistedCache.Results;
      }

      var throttleState = await GetOrCreateStateAsync(ThrottleStateKey, cancellationToken);
      var waitDuration = (throttleState.NextAllowedRequestUtc ?? DateTime.UtcNow) - DateTime.UtcNow;
      if (waitDuration > TimeSpan.Zero) {
        await Task.Delay(waitDuration, cancellationToken);
      }

      try {
        var results = await ExecuteRemoteLookupAsync(normalizedQuery, normalizedLimit, cancellationToken);
        var expiresAtUtc = DateTime.UtcNow.Add(CacheDuration);
        await UpsertCacheStateAsync(cacheKey, results, expiresAtUtc, cancellationToken);
        throttleState.NextAllowedRequestUtc = DateTime.UtcNow.Add(MinimumSpacing);
        throttleState.UpdatedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        SetProcessCache(cacheKey, results, expiresAtUtc);
        return results;
      } catch (AddressLookupUnavailableException ex) {
        throttleState.NextAllowedRequestUtc = DateTime.UtcNow.Add(ex.Backoff > TimeSpan.Zero ? ex.Backoff : FailureBackoff);
        throttleState.UpdatedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        throw;
      }
    } finally {
      await ReleaseDistributedLockAsync(connection);
      if (shouldCloseConnection) {
        await _dbContext.Database.CloseConnectionAsync();
      }
    }
  }

  private async Task<CachedLookupResults?> TryGetPersistedCacheAsync(string cacheKey, CancellationToken cancellationToken) {
    var utcNow = DateTime.UtcNow;
    var cacheState = await _dbContext.ExternalServiceStates
      .AsNoTracking()
      .SingleOrDefaultAsync(
        entity => entity.Provider == ProviderName &&
          entity.StateKey == cacheKey &&
          entity.PayloadJson != null &&
          entity.ExpiresAtUtc != null &&
          entity.ExpiresAtUtc > utcNow,
        cancellationToken);

    if (cacheState is null || string.IsNullOrWhiteSpace(cacheState.PayloadJson) || cacheState.ExpiresAtUtc is null) {
      return null;
    }

    try {
      var results = JsonSerializer.Deserialize<IReadOnlyList<AddressLookupResult>>(cacheState.PayloadJson, JsonOptions) ?? [];
      return new CachedLookupResults(results, cacheState.ExpiresAtUtc.Value);
    } catch (JsonException ex) {
      _logger.LogWarning(ex, "Persisted address lookup cache could not be deserialized for key {CacheKey}.", cacheKey);
      return null;
    }
  }

  private async Task<ExternalServiceState> GetOrCreateStateAsync(string stateKey, CancellationToken cancellationToken) {
    var state = await _dbContext.ExternalServiceStates
      .SingleOrDefaultAsync(
        entity => entity.Provider == ProviderName && entity.StateKey == stateKey,
        cancellationToken);

    if (state is not null) {
      return state;
    }

    state = new ExternalServiceState {
      Provider = ProviderName,
      StateKey = stateKey,
      UpdatedAtUtc = DateTime.UtcNow
    };

    _dbContext.ExternalServiceStates.Add(state);
    return state;
  }

  private async Task UpsertCacheStateAsync(
    string cacheKey,
    IReadOnlyList<AddressLookupResult> results,
    DateTime expiresAtUtc,
    CancellationToken cancellationToken) {
      var cacheState = await GetOrCreateStateAsync(cacheKey, cancellationToken);
      cacheState.PayloadJson = JsonSerializer.Serialize(results, JsonOptions);
      cacheState.ExpiresAtUtc = expiresAtUtc;
      cacheState.UpdatedAtUtc = DateTime.UtcNow;
    }

  private static string NormalizeQuery(string query) {
    var normalizedQuery = string.Join(
      " ",
      (query ?? string.Empty)
        .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    if (normalizedQuery.Length < MinimumQueryLength) {
      throw new AddressLookupValidationException($"Enter at least {MinimumQueryLength} characters before searching.");
    }

    if (normalizedQuery.Length > MaximumQueryLength) {
      throw new AddressLookupValidationException($"Address searches must stay within {MaximumQueryLength} characters.");
    }

    if (!normalizedQuery.Any(char.IsLetterOrDigit)) {
      throw new AddressLookupValidationException("Enter a more specific address before searching.");
    }

    return normalizedQuery;
  }

  private async Task<IReadOnlyList<AddressLookupResult>> ExecuteRemoteLookupAsync(
    string normalizedQuery,
    int normalizedLimit,
    CancellationToken cancellationToken) {
      using var client = _httpClientFactory.CreateClient(HttpClientName);
      using var request = new HttpRequestMessage(
        HttpMethod.Get,
        $"search?format=jsonv2&addressdetails=0&limit={normalizedLimit}&dedupe=1&q={Uri.EscapeDataString(normalizedQuery)}");
      using var response = await client.SendAsync(request, cancellationToken);

      if ((int)response.StatusCode == StatusCodes.Status429TooManyRequests) {
        throw new AddressLookupUnavailableException(
          "Address lookup is temporarily rate-limited. Wait a moment, then try again.",
          RateLimitBackoff);
      }

      if (!response.IsSuccessStatusCode) {
        _logger.LogWarning(
          "Nominatim address lookup failed with status code {StatusCode} for query '{Query}'.",
          (int)response.StatusCode,
          normalizedQuery);
        throw new AddressLookupUnavailableException(
          "Address lookup is temporarily unavailable. Try again in a moment.",
          FailureBackoff);
      }

      try {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var payload = await JsonSerializer.DeserializeAsync<List<NominatimSearchItem>>(
          stream,
          cancellationToken: cancellationToken);

        return payload?
          .Select(ToAddressLookupResult)
          .Where(result => result is not null)
          .Cast<AddressLookupResult>()
          .DistinctBy(result => result.DisplayName)
          .Take(normalizedLimit)
          .ToArray() ?? [];
      } catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested) {
        _logger.LogWarning(ex, "Address lookup timed out while calling Nominatim.");
        throw new AddressLookupUnavailableException(
          "Address lookup timed out. Try again in a moment.",
          FailureBackoff);
      } catch (Exception ex) when (ex is HttpRequestException or JsonException) {
        _logger.LogWarning(ex, "Address lookup failed while calling Nominatim.");
        throw new AddressLookupUnavailableException(
          "Address lookup is temporarily unavailable. Try again in a moment.",
          FailureBackoff);
      }
    }

  private async Task AcquireDistributedLockAsync(DbConnection connection, CancellationToken cancellationToken) {
    await using var command = connection.CreateCommand();
    command.CommandText = """
      DECLARE @result int;
      EXEC @result = sp_getapplock
        @Resource = @resource,
        @LockMode = 'Exclusive',
        @LockOwner = 'Session',
        @LockTimeout = @timeout;
      SELECT @result;
      """;

    command.Parameters.Add(CreateParameter(command, "@resource", DistributedLockResource));
    command.Parameters.Add(CreateParameter(command, "@timeout", DistributedLockTimeoutMilliseconds));

    var result = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken), CultureInfo.InvariantCulture);
    if (result < 0) {
      throw new AddressLookupUnavailableException("Address lookup is busy. Try again in a moment.", FailureBackoff);
    }
  }

  private static async Task ReleaseDistributedLockAsync(DbConnection connection) {
    if (connection.State != ConnectionState.Open) {
      return;
    }

    await using var command = connection.CreateCommand();
    command.CommandText = """
      EXEC sp_releaseapplock
        @Resource = @resource,
        @LockOwner = 'Session';
      """;

    command.Parameters.Add(CreateParameter(command, "@resource", DistributedLockResource));
    try {
      await command.ExecuteNonQueryAsync();
    } catch {
      // Best-effort release on shutdown/connection disposal.
    }
  }

  private static DbParameter CreateParameter(DbCommand command, string name, object value) {
    var parameter = command.CreateParameter();
    parameter.ParameterName = name;
    parameter.Value = value;
    return parameter;
  }

  private void SetProcessCache(string cacheKey, IReadOnlyList<AddressLookupResult> results, DateTime expiresAtUtc) {
    var cacheLifetime = expiresAtUtc - DateTime.UtcNow;
    if (cacheLifetime <= TimeSpan.Zero) {
      return;
    }

    _memoryCache.Set(cacheKey, results, cacheLifetime);
  }

  private static AddressLookupResult? ToAddressLookupResult(NominatimSearchItem item) {
    if (string.IsNullOrWhiteSpace(item.DisplayName) ||
        !double.TryParse(item.Latitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude) ||
        !double.TryParse(item.Longitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude)) {
      return null;
    }

    return new AddressLookupResult(
      item.DisplayName,
      latitude,
      longitude,
      $"https://www.openstreetmap.org/?mlat={latitude.ToString(CultureInfo.InvariantCulture)}&mlon={longitude.ToString(CultureInfo.InvariantCulture)}#map=17/{latitude.ToString(CultureInfo.InvariantCulture)}/{longitude.ToString(CultureInfo.InvariantCulture)}");
  }

  private sealed record CachedLookupResults(
    IReadOnlyList<AddressLookupResult> Results,
    DateTime ExpiresAtUtc);

  private sealed record NominatimSearchItem {
    [JsonPropertyName("display_name")]
    public string? DisplayName { get; init; }

    [JsonPropertyName("lat")]
    public string? Latitude { get; init; }

    [JsonPropertyName("lon")]
    public string? Longitude { get; init; }
  }
}
