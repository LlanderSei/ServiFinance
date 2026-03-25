namespace ServiFinance.Web.Components.Layout;

public sealed class ThemeState {
  public string CurrentTheme { get; private set; } = "light";

  public event Action? Changed;

  public void SetTheme(string theme) {
    CurrentTheme = theme;
    Changed?.Invoke();
  }
}
