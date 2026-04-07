using System.Text.Json.Serialization;

namespace ServiFinance.Services;

public interface IDesktopHybridShellBridge {
  Task<string?> GetRefreshTokenAsync();
  Task SaveRefreshTokenAsync(string refreshToken);
  Task ClearRefreshTokenAsync();
  Task<DesktopShellContext> GetShellContextAsync();
}

public sealed record DesktopShellContext(
    [property: JsonPropertyName("appVersion")] string AppVersion,
    [property: JsonPropertyName("platform")] string Platform,
    [property: JsonPropertyName("apiBaseUrl")] string ApiBaseUrl);
