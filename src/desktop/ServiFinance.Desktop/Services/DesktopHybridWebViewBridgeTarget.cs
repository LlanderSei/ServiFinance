namespace ServiFinance.Services;

public sealed class DesktopHybridWebViewBridgeTarget(IDesktopHybridShellBridge bridge) {
  public Task<string?> GetRefreshToken() => bridge.GetRefreshTokenAsync();

  public Task SaveRefreshToken(string refreshToken) => bridge.SaveRefreshTokenAsync(refreshToken);

  public Task ClearRefreshToken() => bridge.ClearRefreshTokenAsync();

  public Task<DesktopShellContext> GetShellContext() => bridge.GetShellContextAsync();
}
