namespace ServiFinance;

public partial class App : Microsoft.Maui.Controls.Application {
  private readonly MainPage _mainPage;

  public App(MainPage mainPage) {
    InitializeComponent();
    _mainPage = mainPage;

#if WINDOWS
    var userDataFolder = Path.Combine(FileSystem.AppDataDirectory, "WebView2");
    Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", userDataFolder);
#endif
  }

  protected override Microsoft.Maui.Controls.Window CreateWindow(IActivationState? activationState) {
    return new Microsoft.Maui.Controls.Window(_mainPage) { Title = "ServiFinance" };
  }
}
