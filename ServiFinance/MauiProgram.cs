using Microsoft.Extensions.Logging;
using ServiFinance.Services;

namespace ServiFinance;

public static class MauiProgram {
  public static MauiApp CreateMauiApp() {
    var builder = MauiApp.CreateBuilder();
    builder
        .UseMauiApp<App>()
        .ConfigureFonts(fonts => {
          fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
        });

    builder.Services.AddSingleton<MainPage>();
    builder.Services.AddSingleton<DesktopHybridWebViewBridgeTarget>();
    builder.Services.AddSingleton<IDesktopHybridShellBridge, SecureStorageHybridShellBridge>();

#if DEBUG
    builder.Services.AddHybridWebViewDeveloperTools();
    builder.Logging.AddDebug();
#endif

    return builder.Build();
  }
}
