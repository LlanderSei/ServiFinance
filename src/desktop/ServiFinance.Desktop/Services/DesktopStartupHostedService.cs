namespace ServiFinance.Services;

public sealed class DesktopStartupHostedService(IDesktopApiBootstrapper apiBootstrapper) {
  public async Task WarmUpAsync(CancellationToken cancellationToken = default) {
    await apiBootstrapper.EnsureAvailableAsync(cancellationToken);
  }
}
