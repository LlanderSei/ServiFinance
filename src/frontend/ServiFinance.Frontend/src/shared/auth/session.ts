import type { AuthSessionResponse } from "@/shared/api/contracts";
import { isDesktopShell, resolveApiUrl } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";

let accessToken: string | null = null;
let currentSession: AuthSessionResponse | null = null;
let refreshRequest: Promise<AuthSessionResponse | null> | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getCurrentSession() {
  return currentSession;
}

export async function applySession(response: AuthSessionResponse) {
  accessToken = response.tokens.accessToken;
  currentSession = response;

  if (isDesktopShell()) {
    await desktopBridge.saveRefreshToken(response.tokens.refreshToken);
  }
}

export async function clearSession() {
  accessToken = null;
  currentSession = null;

  if (isDesktopShell()) {
    await desktopBridge.clearRefreshToken();
  }
}

export async function refreshSession() {
  if (currentSession) {
    const expiresAtUtc = Date.parse(currentSession.tokens.expiresAtUtc);
    if (!Number.isNaN(expiresAtUtc) && expiresAtUtc - Date.now() > 15_000) {
      accessToken = currentSession.tokens.accessToken;
      return currentSession;
    }
  }

  if (refreshRequest) {
    return refreshRequest;
  }

  refreshRequest = (async () => {
    const requestUrl = await resolveApiUrl("/api/auth/refresh");
    const body = isDesktopShell()
      ? { refreshToken: await desktopBridge.getRefreshToken() }
      : {};

    if (isDesktopShell() && !body.refreshToken) {
      return null;
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: isDesktopShell() ? "omit" : "include",
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (isDesktopShell()) {
        await desktopBridge.clearRefreshToken();
      }

      accessToken = null;
      currentSession = null;
      return null;
    }

    const payload = await response.json() as AuthSessionResponse;
    await applySession(payload);
    return payload;
  })().finally(() => {
    refreshRequest = null;
  });

  return refreshRequest;
}

export async function ensureAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  const session = await refreshSession();
  return session?.tokens.accessToken ?? null;
}
