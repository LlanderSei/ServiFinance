import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";
import { clearSession } from "./session";

export function useLogout() {
  return async function logout() {
    const refreshToken = isDesktopShell() ? await desktopBridge.getRefreshToken() : null;

    await fetch(await resolveApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: isDesktopShell() ? "omit" : "include",
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    });

    await clearSession();
    window.location.assign(toPlatformRoute("/"));
  };
}
