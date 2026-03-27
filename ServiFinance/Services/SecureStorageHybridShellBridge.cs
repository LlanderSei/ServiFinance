using Microsoft.Maui.Storage;

namespace ServiFinance.Services;

public sealed class SecureStorageHybridShellBridge : IDesktopHybridShellBridge {
  private const string RefreshTokenKey = "servifinance:refresh-token";
  private const string DefaultApiBaseUrl = "https://localhost:7050";

  public Task<string?> GetRefreshTokenAsync() =>
      SecureStorage.Default.GetAsync(RefreshTokenKey);

  public Task SaveRefreshTokenAsync(string refreshToken) =>
      SecureStorage.Default.SetAsync(RefreshTokenKey, refreshToken);

  public Task ClearRefreshTokenAsync() {
    SecureStorage.Default.Remove(RefreshTokenKey);
    return Task.CompletedTask;
  }

  public Task<DesktopShellContext> GetShellContextAsync() =>
      Task.FromResult(new DesktopShellContext(
          AppInfo.Current.VersionString,
          DeviceInfo.Current.Platform.ToString(),
          Environment.GetEnvironmentVariable("SERVIFINANCE_API_BASE_URL") ?? DefaultApiBaseUrl));
}
