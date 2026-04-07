using ServiFinance.Services;

namespace ServiFinance;

public partial class App : Microsoft.Maui.Controls.Application {
  private readonly MainPage _mainPage;
  private readonly IDesktopApiBootstrapper _apiBootstrapper;
  private readonly DesktopStartupHostedService _startupHostedService;

  public App(
      MainPage mainPage,
      IDesktopApiBootstrapper apiBootstrapper,
      DesktopStartupHostedService startupHostedService) {
    InitializeComponent();
    _mainPage = mainPage;
    _apiBootstrapper = apiBootstrapper;
    _startupHostedService = startupHostedService;

    AppDomain.CurrentDomain.ProcessExit += (_, _) => DisposeApiBootstrapper();
    _ = _startupHostedService.WarmUpAsync();
  }

  protected override Microsoft.Maui.Controls.Window CreateWindow(IActivationState? activationState) {
    return new Microsoft.Maui.Controls.Window(_mainPage) { Title = "ServiFinance" };
  }

  private void DisposeApiBootstrapper() {
    try {
      _apiBootstrapper.DisposeAsync().AsTask().GetAwaiter().GetResult();
    } catch {
      // Best-effort cleanup only.
    }
  }
}
