namespace ServiFinance;

public partial class MainPage : ContentPage {
  public MainPage(Services.DesktopHybridWebViewBridgeTarget bridgeTarget) {
    InitializeComponent();
    hybridWebView.SetInvokeJavaScriptTarget(bridgeTarget);
  }
}
