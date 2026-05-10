namespace ServiFinance.Api.Services;

using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

internal sealed class ImgBbUploadOptions {
  public const string SectionName = "ServiFinance:ExternalServices:ImgBB";

  public string ApiKey { get; set; } = string.Empty;
}

internal enum ImageUploadPurpose {
  CustomerRequestAttachment,
  DispatchEvidence,
  BrandingLogo
}

internal sealed record ImageUploadContext(
    ImageUploadPurpose Purpose,
    string TenantDomainSlug,
    string ActorKey,
    string NamePrefix);

internal sealed record ImageUploadPolicy(
    long MaxBytes,
    int MaxFilesPerBatch,
    int MaxUploadsPerHour,
    string FriendlySize);

internal sealed record ImageUploadResult(
    string OriginalFileName,
    string StoredFileName,
    string ContentType,
    string PublicUrl,
    string? HostImageId,
    string? DeleteUrl,
    long SizeBytes);

internal sealed class ImageUploadException(string message, int statusCode = StatusCodes.Status400BadRequest)
    : InvalidOperationException(message) {
  public int StatusCode { get; } = statusCode;
}

internal interface IImageUploadService {
  bool IsConfigured { get; }

  ImageUploadPolicy GetPolicy(ImageUploadPurpose purpose);

  Task<IReadOnlyList<ImageUploadResult>> UploadBatchAsync(
      IReadOnlyList<IFormFile> files,
      ImageUploadContext context,
      CancellationToken cancellationToken);
}

internal sealed class ImgBbImageUploadService(
    IHttpClientFactory httpClientFactory,
    IOptions<ImgBbUploadOptions> optionsAccessor,
    IImageUploadRateLimiter rateLimiter) : IImageUploadService {
  internal const string HttpClientName = "ImgBbImageUpload";

  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
  private readonly ImgBbUploadOptions _options = optionsAccessor.Value;

  public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

  public ImageUploadPolicy GetPolicy(ImageUploadPurpose purpose) =>
    purpose switch {
      ImageUploadPurpose.BrandingLogo => new ImageUploadPolicy(2 * 1024 * 1024, 1, 8, "2 MB"),
      ImageUploadPurpose.DispatchEvidence => new ImageUploadPolicy(5 * 1024 * 1024, 5, 40, "5 MB"),
      _ => new ImageUploadPolicy(5 * 1024 * 1024, 5, 24, "5 MB")
    };

  public async Task<IReadOnlyList<ImageUploadResult>> UploadBatchAsync(
      IReadOnlyList<IFormFile> files,
      ImageUploadContext context,
      CancellationToken cancellationToken) {
    if (!IsConfigured) {
      throw new ImageUploadException(
          "ImgBB image hosting is not configured. Set ServiFinance__ExternalServices__ImgBB__ApiKey.",
          StatusCodes.Status503ServiceUnavailable);
    }

    var activeFiles = files.Where(file => file.Length > 0).ToList();
    if (activeFiles.Count == 0) {
      throw new ImageUploadException("Select at least one image to upload.");
    }

    var policy = GetPolicy(context.Purpose);
    if (activeFiles.Count > policy.MaxFilesPerBatch) {
      throw new ImageUploadException($"Upload at most {policy.MaxFilesPerBatch} image(s) at a time.");
    }

    foreach (var file in activeFiles) {
      ValidateFileShell(file, policy);
    }

    var rateKey = BuildRateKey(context);
    if (!rateLimiter.TryAcquire(rateKey, activeFiles.Count, policy.MaxUploadsPerHour, TimeSpan.FromHours(1), out var resetAtUtc)) {
      var remainingMinutes = Math.Max(1, (int)Math.Ceiling((resetAtUtc - DateTimeOffset.UtcNow).TotalMinutes));
      throw new ImageUploadException(
          $"Image uploads are temporarily rate limited. Try again in about {remainingMinutes} minute(s).",
          StatusCodes.Status429TooManyRequests);
    }

    var results = new List<ImageUploadResult>();
    foreach (var file in activeFiles) {
      results.Add(await UploadSingleAsync(file, context, policy, cancellationToken));
    }

    return results;
  }

  private async Task<ImageUploadResult> UploadSingleAsync(
      IFormFile file,
      ImageUploadContext context,
      ImageUploadPolicy policy,
      CancellationToken cancellationToken) {
    await using var stream = file.OpenReadStream();
    using var memoryStream = new MemoryStream();
    await stream.CopyToAsync(memoryStream, cancellationToken);
    var bytes = memoryStream.ToArray();

    var format = DetectImageFormat(bytes);
    if (format is null) {
      throw new ImageUploadException($"File '{file.FileName}' must be a JPG, PNG, or WebP image.");
    }

    if (bytes.LongLength > policy.MaxBytes) {
      throw new ImageUploadException($"File '{file.FileName}' exceeds the {policy.FriendlySize} upload limit.");
    }

    var storedFileName = BuildStoredFileName(context, format.Extension);
    using var content = new MultipartFormDataContent();
    var imageContent = new ByteArrayContent(bytes);
    imageContent.Headers.ContentType = new MediaTypeHeaderValue(format.ContentType);
    content.Add(imageContent, "image", storedFileName);
    content.Add(new StringContent(Path.GetFileNameWithoutExtension(storedFileName)), "name");

    using var client = httpClientFactory.CreateClient(HttpClientName);
    using var response = await client.PostAsync(
        $"1/upload?key={Uri.EscapeDataString(_options.ApiKey.Trim())}",
        content,
        cancellationToken);

    var payloadJson = await response.Content.ReadAsStringAsync(cancellationToken);
    if (!response.IsSuccessStatusCode) {
      throw new ImageUploadException(
          ResolveUploadError(payloadJson) ?? "ImgBB rejected the image upload.",
          StatusCodes.Status502BadGateway);
    }

    var payload = JsonSerializer.Deserialize<ImgBbUploadResponse>(payloadJson, JsonOptions);
    var publicUrl = payload?.Data?.DisplayUrl ?? payload?.Data?.Url;
    if (payload is null || !payload.Success || string.IsNullOrWhiteSpace(publicUrl)) {
      throw new ImageUploadException(
          ResolveUploadError(payloadJson) ?? "ImgBB did not return a public image URL.",
          StatusCodes.Status502BadGateway);
    }

    return new ImageUploadResult(
        Path.GetFileName(file.FileName),
        payload.Data?.Image?.Filename ?? storedFileName,
        payload.Data?.Image?.Mime ?? format.ContentType,
        publicUrl,
        payload.Data?.Id,
        payload.Data?.DeleteUrl,
        bytes.LongLength);
  }

  private static void ValidateFileShell(IFormFile file, ImageUploadPolicy policy) {
    if (file.Length <= 0) {
      throw new ImageUploadException($"File '{file.FileName}' is empty.");
    }

    if (file.Length > policy.MaxBytes) {
      throw new ImageUploadException($"File '{file.FileName}' exceeds the {policy.FriendlySize} upload limit.");
    }
  }

  private static ImageFormat? DetectImageFormat(byte[] bytes) {
    if (bytes.Length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return new ImageFormat(".jpg", "image/jpeg");
    }

    if (bytes.Length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return new ImageFormat(".png", "image/png");
    }

    if (bytes.Length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50) {
      return new ImageFormat(".webp", "image/webp");
    }

    return null;
  }

  private static string BuildStoredFileName(ImageUploadContext context, string extension) {
    var safePrefix = string.Join(
        "-",
        context.NamePrefix
            .Split([' ', '/', '\\', ':', '.', '_'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => new string(part.Where(char.IsLetterOrDigit).ToArray()))
            .Where(part => !string.IsNullOrWhiteSpace(part)))
        .ToLowerInvariant();
    safePrefix = string.IsNullOrWhiteSpace(safePrefix) ? "servifinance-image" : safePrefix;

    return $"{safePrefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension}";
  }

  private static string BuildRateKey(ImageUploadContext context) =>
    $"imgbb:{context.Purpose}:{context.TenantDomainSlug.Trim().ToLowerInvariant()}:{context.ActorKey.Trim().ToLowerInvariant()}";

  private static string? ResolveUploadError(string payloadJson) {
    try {
      var payload = JsonSerializer.Deserialize<ImgBbUploadResponse>(payloadJson, JsonOptions);
      return payload?.Error?.Message;
    } catch {
      return null;
    }
  }

  private sealed record ImageFormat(string Extension, string ContentType);

  private sealed class ImgBbUploadResponse {
    public bool Success { get; set; }
    public int Status { get; set; }
    public ImgBbUploadData? Data { get; set; }
    public ImgBbUploadError? Error { get; set; }
  }

  private sealed class ImgBbUploadData {
    public string? Id { get; set; }
    public string? Url { get; set; }

    [JsonPropertyName("display_url")]
    public string? DisplayUrl { get; set; }

    [JsonPropertyName("delete_url")]
    public string? DeleteUrl { get; set; }

    public ImgBbUploadImage? Image { get; set; }
  }

  private sealed class ImgBbUploadImage {
    public string? Filename { get; set; }
    public string? Mime { get; set; }
  }

  private sealed class ImgBbUploadError {
    public string? Message { get; set; }
  }
}

internal interface IImageUploadRateLimiter {
  bool TryAcquire(string key, int amount, int limit, TimeSpan window, out DateTimeOffset resetAtUtc);
}

internal sealed class MemoryImageUploadRateLimiter(IMemoryCache cache) : IImageUploadRateLimiter {
  private static readonly ConcurrentDictionary<string, object> Locks = new();

  public bool TryAcquire(string key, int amount, int limit, TimeSpan window, out DateTimeOffset resetAtUtc) {
    var gate = Locks.GetOrAdd(key, _ => new object());
    lock (gate) {
      var now = DateTimeOffset.UtcNow;
      var state = cache.Get<ImageUploadRateState>(key);
      if (state is null || state.ExpiresAtUtc <= now) {
        state = new ImageUploadRateState(0, now.Add(window));
      }

      resetAtUtc = state.ExpiresAtUtc;
      if (state.Count + amount > limit) {
        return false;
      }

      state.Count += amount;
      cache.Set(key, state, state.ExpiresAtUtc);
      return true;
    }
  }

  private sealed class ImageUploadRateState(int count, DateTimeOffset expiresAtUtc) {
    public int Count { get; set; } = count;
    public DateTimeOffset ExpiresAtUtc { get; } = expiresAtUtc;
  }
}
