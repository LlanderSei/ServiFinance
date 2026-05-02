import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";
import { webSessionStorage } from "@/platform/web/sessionStorage";
import { clearSession, getAccessToken } from "./session";

export function useLogout() {
  return async function logout() {
    const refreshToken = isDesktopShell()
      ? await desktopBridge.getRefreshToken()
      : webSessionStorage.getRefreshToken();

    const accessToken = getAccessToken();
    await fetch(await resolveApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      credentials: isDesktopShell() ? "omit" : "include",
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    });

    await clearSession();
    window.location.assign(toPlatformRoute("/"));
  };
}
