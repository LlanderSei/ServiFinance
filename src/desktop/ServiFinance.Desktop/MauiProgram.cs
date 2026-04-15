using Microsoft.Extensions.Logging;
using Microsoft.Maui.LifecycleEvents;
using ServiFinance.Services;
#if WINDOWS
using ServiFinance.Platforms.Windows;
#endif

namespace ServiFinance;

public static class MauiProgram {
  public static MauiApp CreateMauiApp() {
#if WINDOWS
    DesktopWebViewEnvironment.ConfigureWebViewUserDataFolder();
#endif

    var builder = MauiApp.CreateBuilder();
    builder
        .UseMauiApp<App>()
        .ConfigureFonts(fonts => {
          fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
        });

#if WINDOWS
    builder.ConfigureLifecycleEvents(events => {
      events.AddWindows(windows => {
        windows.OnWindowCreated(window => {
          DesktopWindowSizing.ApplyMinimumSize(window);
        });
      });
    });
#endif

    builder.Services.AddSingleton<MainPage>();
    builder.Services.AddSingleton<DesktopHybridWebViewBridgeTarget>();
    builder.Services.AddSingleton<IDesktopApiBootstrapper, DesktopApiBootstrapper>();
    builder.Services.AddSingleton<DesktopStartupHostedService>();
    builder.Services.AddSingleton<IDesktopHybridShellBridge, SecureStorageHybridShellBridge>();

#if DEBUG
    builder.Services.AddHybridWebViewDeveloperTools();
    builder.Logging.AddDebug();
#endif

    return builder.Build();
  }
}
