import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";
import { webSessionStorage } from "@/platform/web/sessionStorage";
import { clearSession, getAccessToken } from "./session";

export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(async function logout(returnTo = "/") {
    const targetRoute = toPlatformRoute(returnTo);

    try {
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
    } catch {
      // Local logout must still complete if the API/desktop bridge is interrupted.
    } finally {
      try {
        await clearSession();
        await queryClient.cancelQueries();
      } finally {
        queryClient.clear();
        window.location.replace(targetRoute);
      }
    }
  }, [queryClient]);
}
