declare global {
  interface Window {
    __SERVIFINANCE_PLATFORM__?: "desktop" | "web";
    chrome?: {
      webview?: unknown;
    };
    ServiFinanceDesktop?: {
      getRefreshToken(): Promise<string | null>;
      saveRefreshToken(token: string): Promise<void>;
      clearRefreshToken(): Promise<void>;
      getShellContext(): Promise<{ appVersion: string; platform: string; apiBaseUrl: string }>;
    };
  }
}

function hasHybridHostSignal() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.__SERVIFINANCE_PLATFORM__ === "desktop" ||
    typeof window.ServiFinanceDesktop !== "undefined" ||
    typeof window.chrome?.webview !== "undefined" ||
    window.location.hostname === "0.0.0.0" ||
    window.location.protocol === "app:";
}

async function waitForDesktopBridge(timeoutMs = 2_500) {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.ServiFinanceDesktop) {
    return window.ServiFinanceDesktop;
  }

  if (!hasHybridHostSignal()) {
    return null;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (window.ServiFinanceDesktop) {
      return window.ServiFinanceDesktop;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  return window.ServiFinanceDesktop ?? null;
}

export function isDesktopBridgeEnvironment() {
  return hasHybridHostSignal();
}

export const desktopBridge = {
  async getRefreshToken() {
    const bridge = await waitForDesktopBridge();
    return bridge?.getRefreshToken() ?? null;
  },
  async saveRefreshToken(token: string) {
    const bridge = await waitForDesktopBridge();
    await (bridge?.saveRefreshToken(token) ?? Promise.resolve());
  },
  async clearRefreshToken() {
    const bridge = await waitForDesktopBridge();
    await (bridge?.clearRefreshToken() ?? Promise.resolve());
  },
  async getShellContext() {
    const bridge = await waitForDesktopBridge();
    return bridge?.getShellContext() ??
      { appVersion: "development", platform: "desktop", apiBaseUrl: "http://localhost:5228" };
  }
};
