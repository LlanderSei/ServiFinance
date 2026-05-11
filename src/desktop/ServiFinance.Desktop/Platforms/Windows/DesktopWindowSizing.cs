#if WINDOWS
namespace ServiFinance.Platforms.Windows;

using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using global::Windows.Graphics;
using System.Runtime.InteropServices;
using WinRT.Interop;

internal static class DesktopWindowSizing {
  private const int MinimumWidth = 1280;
  private const int MinimumHeight = 820;
  private const int GwlWndProc = -4;
  private const uint WmGetMinMaxInfo = 0x0024;
  private static readonly Dictionary<IntPtr, WindowSubclass> WindowSubclasses = new();

  public static void ApplyMinimumSize(Window window) {
    var hwnd = WindowNative.GetWindowHandle(window);
    var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
    var appWindow = AppWindow.GetFromWindowId(windowId);

    ApplyLaunchBounds(appWindow, windowId);
    RegisterMinimumResizeBounds(hwnd);
  }

  private static void ApplyLaunchBounds(AppWindow appWindow, Microsoft.UI.WindowId windowId) {
    var targetWidth = Math.Max(appWindow.Size.Width, MinimumWidth);
    var targetHeight = Math.Max(appWindow.Size.Height, MinimumHeight);
    var displayArea = DisplayArea.GetFromWindowId(windowId, DisplayAreaFallback.Primary);
    var workArea = displayArea.WorkArea;
    var targetX = workArea.X + Math.Max(0, (workArea.Width - targetWidth) / 2);
    var targetY = workArea.Y + Math.Max(0, (workArea.Height - targetHeight) / 2);

    appWindow.MoveAndResize(new RectInt32(targetX, targetY, targetWidth, targetHeight));
  }

  private static void RegisterMinimumResizeBounds(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero || WindowSubclasses.ContainsKey(hwnd)) {
      return;
    }

    IntPtr previousProcedure = IntPtr.Zero;
    WindowProc callback = (windowHandle, message, wParam, lParam) => {
      if (message == WmGetMinMaxInfo) {
        var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);
        minMaxInfo.MinTrackSize.X = MinimumWidth;
        minMaxInfo.MinTrackSize.Y = MinimumHeight;
        Marshal.StructureToPtr(minMaxInfo, lParam, false);
      }

      return previousProcedure == IntPtr.Zero
        ? DefWindowProc(windowHandle, message, wParam, lParam)
        : CallWindowProc(previousProcedure, windowHandle, message, wParam, lParam);
    };

    var callbackPointer = Marshal.GetFunctionPointerForDelegate(callback);
    previousProcedure = SetWindowLongPtr(hwnd, GwlWndProc, callbackPointer);
    WindowSubclasses[hwnd] = new WindowSubclass(callback, callbackPointer, previousProcedure);
  }

  private static IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr newValue) {
    return IntPtr.Size == 8
      ? SetWindowLongPtr64(hwnd, index, newValue)
      : SetWindowLongPtr32(hwnd, index, newValue);
  }

  private delegate IntPtr WindowProc(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct MinMaxInfo {
    public NativePoint Reserved;
    public NativePoint MaxSize;
    public NativePoint MaxPosition;
    public NativePoint MinTrackSize;
    public NativePoint MaxTrackSize;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct NativePoint {
    public int X;
    public int Y;
  }

  private sealed record WindowSubclass(
    WindowProc Callback,
    IntPtr CallbackPointer,
    IntPtr PreviousProcedure);

  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
  private static extern IntPtr SetWindowLongPtr64(IntPtr hwnd, int index, IntPtr newValue);

  [DllImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
  private static extern IntPtr SetWindowLongPtr32(IntPtr hwnd, int index, IntPtr newValue);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern IntPtr CallWindowProc(
    IntPtr previousProcedure,
    IntPtr hwnd,
    uint message,
    IntPtr wParam,
    IntPtr lParam);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern IntPtr DefWindowProc(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
}
#endif
