(function () {
  if (typeof window === "undefined") {
    return;
  }

  function hasHybridHostSignal() {
    return typeof window.chrome?.webview !== "undefined" ||
      window.location.hostname === "0.0.0.0" ||
      window.location.hostname === "0.0.0.1" ||
      window.location.protocol === "app:";
  }

  function installBridge() {
    if (!window.HybridWebView || typeof window.HybridWebView.InvokeDotNet !== "function") {
      return false;
    }

    window.__SERVIFINANCE_PLATFORM__ = "desktop";
    window.ServiFinanceDesktop = {
      getRefreshToken: function () {
        return window.HybridWebView.InvokeDotNet("GetRefreshToken");
      },
      saveRefreshToken: function (token) {
        return window.HybridWebView.InvokeDotNet("SaveRefreshToken", [token]);
      },
      clearRefreshToken: function () {
        return window.HybridWebView.InvokeDotNet("ClearRefreshToken");
      },
      getShellContext: function () {
        return window.HybridWebView.InvokeDotNet("GetShellContext");
      }
    };

    return true;
  }

  if (installBridge()) {
    return;
  }

  if (!hasHybridHostSignal()) {
    return;
  }

  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;
    if (installBridge() || attempts > 100) {
      window.clearInterval(timer);
    }
  }, 50);
})();
