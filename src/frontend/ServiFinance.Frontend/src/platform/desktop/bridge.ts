declare global {
  interface Window {
    __SERVIFINANCE_PLATFORM__?: "desktop" | "web";
    ServiFinanceDesktop?: {
      getRefreshToken(): Promise<string | null>;
      saveRefreshToken(token: string): Promise<void>;
      clearRefreshToken(): Promise<void>;
      getShellContext(): Promise<{ appVersion: string; platform: string; apiBaseUrl: string }>;
    };
  }
}

export const desktopBridge = {
  getRefreshToken: () => window.ServiFinanceDesktop?.getRefreshToken() ?? Promise.resolve(null),
  saveRefreshToken: (token: string) => window.ServiFinanceDesktop?.saveRefreshToken(token) ?? Promise.resolve(),
  clearRefreshToken: () => window.ServiFinanceDesktop?.clearRefreshToken() ?? Promise.resolve(),
  getShellContext: () =>
    window.ServiFinanceDesktop?.getShellContext() ??
    Promise.resolve({ appVersion: "development", platform: "desktop", apiBaseUrl: "https://localhost:7050" })
};
