#if WINDOWS
namespace ServiFinance.Platforms.Windows;

using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using global::Windows.Graphics;
using WinRT.Interop;

internal static class DesktopWindowSizing {
  private const int MinimumWidth = 1280;
  private const int MinimumHeight = 820;

  public static void ApplyMinimumSize(Window window) {
    var hwnd = WindowNative.GetWindowHandle(window);
    var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
    var appWindow = AppWindow.GetFromWindowId(windowId);
    var isResizing = false;

    EnsureMinimumSize(appWindow);

    appWindow.Changed += (_, args) => {
      if (!args.DidSizeChange || isResizing) {
        return;
      }

      var targetWidth = Math.Max(appWindow.Size.Width, MinimumWidth);
      var targetHeight = Math.Max(appWindow.Size.Height, MinimumHeight);
      if (targetWidth == appWindow.Size.Width && targetHeight == appWindow.Size.Height) {
        return;
      }

      try {
        isResizing = true;
        appWindow.Resize(new SizeInt32(targetWidth, targetHeight));
      } finally {
        isResizing = false;
      }
    };
  }

  private static void EnsureMinimumSize(AppWindow appWindow) {
    var targetWidth = Math.Max(appWindow.Size.Width, MinimumWidth);
    var targetHeight = Math.Max(appWindow.Size.Height, MinimumHeight);
    if (targetWidth == appWindow.Size.Width && targetHeight == appWindow.Size.Height) {
      return;
    }

    appWindow.Resize(new SizeInt32(targetWidth, targetHeight));
  }
}
#endif
