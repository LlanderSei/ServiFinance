namespace ServiFinance.Services;

public static class DesktopWebViewEnvironment {
#if WINDOWS
  public static void ConfigureWebViewUserDataFolder() {
    var baseFolder = Path.Combine(FileSystem.AppDataDirectory, "WebView2");

#if DEBUG
    var userDataFolder = Path.Combine(baseFolder, Guid.NewGuid().ToString("N"));
#else
    var userDataFolder = Path.Combine(baseFolder, AppInfo.Current.VersionString);
#endif

    Directory.CreateDirectory(userDataFolder);
    Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", userDataFolder);
  }
#endif
}
