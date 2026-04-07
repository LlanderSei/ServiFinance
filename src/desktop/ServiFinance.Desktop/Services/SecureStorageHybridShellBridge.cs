using Microsoft.Maui.Storage;

namespace ServiFinance.Services;

public sealed class SecureStorageHybridShellBridge(IDesktopApiBootstrapper apiBootstrapper) : IDesktopHybridShellBridge {
  private const string RefreshTokenKey = "servifinance:refresh-token";

  public Task<string?> GetRefreshTokenAsync() =>
      SecureStorage.Default.GetAsync(RefreshTokenKey);

  public Task SaveRefreshTokenAsync(string refreshToken) =>
      SecureStorage.Default.SetAsync(RefreshTokenKey, refreshToken);

  public Task ClearRefreshTokenAsync() {
    SecureStorage.Default.Remove(RefreshTokenKey);
    return Task.CompletedTask;
  }

  public async Task<DesktopShellContext> GetShellContextAsync() {
    var apiBaseUrl = await apiBootstrapper.EnsureAvailableAsync();

    return new DesktopShellContext(
        AppInfo.Current.VersionString,
        DeviceInfo.Current.Platform.ToString(),
        apiBaseUrl);
  }
}
