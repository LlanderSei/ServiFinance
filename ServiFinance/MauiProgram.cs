using Microsoft.Extensions.Logging;
using ServiFinance.Services;
using ServiFinance.Shared.Services;
#if WINDOWS
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Extensions;
#endif

namespace ServiFinance {
  public static class MauiProgram {
    public static MauiApp CreateMauiApp() {
      var builder = MauiApp.CreateBuilder();
      builder
          .UseMauiApp<App>()
          .ConfigureFonts(fonts => {
            fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
          });

      // Add device-specific services used by the ServiFinance.Shared project
      builder.Services.AddSingleton<IFormFactor, FormFactor>();

#if WINDOWS
      builder.Services.AddServiFinanceSqlServer(ServiFinanceDatabaseDefaults.DefaultConnectionString);
#endif

      builder.Services.AddMauiBlazorWebView();

#if DEBUG
          builder.Services.AddBlazorWebViewDeveloperTools();
          builder.Logging.AddDebug();
#endif

      var app = builder.Build();

#if WINDOWS
      app.Services.EnsureServiFinanceDatabaseAsync().GetAwaiter().GetResult();
#endif

      return app;
    }
  }
}
