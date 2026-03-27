(function () {
  if (typeof window === "undefined" || !window.HybridWebView || typeof window.HybridWebView.InvokeDotNet !== "function") {
    return;
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
})();
