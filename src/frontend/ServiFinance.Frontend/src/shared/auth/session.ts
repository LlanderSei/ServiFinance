import type { AuthSessionResponse } from "@/shared/api/contracts";
import { isDesktopShell, resolveApiUrl } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";
import { webSessionStorage } from "@/platform/web/sessionStorage";

let accessToken: string | null = null;
let currentSession: AuthSessionResponse | null = null;
let refreshRequest: Promise<AuthSessionResponse | null> | null = null;

type ApplySessionOptions = {
  rememberOnWeb?: boolean;
};

function normalizeSurface(
  surface: AuthSessionResponse["user"]["surface"] | number,
): AuthSessionResponse["user"]["surface"] {
  if (surface === "Root" || surface === "TenantWeb" || surface === "TenantDesktop") {
    return surface;
  }

  switch (surface) {
    case 0:
      return "Root";
    case 1:
      return "TenantWeb";
    case 2:
      return "TenantDesktop";
    default:
      return "TenantWeb";
  }
}

function normalizeSessionResponse(response: AuthSessionResponse): AuthSessionResponse {
  return {
    ...response,
    user: {
      ...response.user,
      surface: normalizeSurface(response.user.surface as AuthSessionResponse["user"]["surface"] | number)
    }
  };
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getCurrentSession() {
  return currentSession;
}

export async function applySession(response: AuthSessionResponse, options: ApplySessionOptions = {}) {
  const normalizedResponse = normalizeSessionResponse(response);
  accessToken = normalizedResponse.tokens.accessToken;
  currentSession = normalizedResponse;

  if (isDesktopShell()) {
    await desktopBridge.saveRefreshToken(normalizedResponse.tokens.refreshToken);
    return;
  }

  if (options.rememberOnWeb) {
    webSessionStorage.saveRefreshToken(normalizedResponse.tokens.refreshToken);
  } else {
    webSessionStorage.clear();
  }
}

export async function clearSession() {
  accessToken = null;
  currentSession = null;

  if (isDesktopShell()) {
    await desktopBridge.clearRefreshToken();
    return;
  }

  webSessionStorage.clear();
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
    const storedRefreshToken = isDesktopShell()
      ? await desktopBridge.getRefreshToken()
      : webSessionStorage.getRefreshToken();

    const useTokenBody = Boolean(storedRefreshToken);

    if (isDesktopShell() && !storedRefreshToken) {
      return null;
    }

    const response = await fetch(requestUrl, {
      method: useTokenBody ? "POST" : "GET",
      headers: useTokenBody
        ? {
            "Content-Type": "application/json"
          }
        : undefined,
      credentials: isDesktopShell() ? "omit" : "include",
      body: useTokenBody
        ? JSON.stringify({ refreshToken: storedRefreshToken })
        : undefined
    });

    if (!response.ok) {
      if (isDesktopShell()) {
        await desktopBridge.clearRefreshToken();
      } else {
        webSessionStorage.clear();
      }

      accessToken = null;
      currentSession = null;
      return null;
    }

    const payload = normalizeSessionResponse(await response.json() as AuthSessionResponse);
    await applySession(payload, { rememberOnWeb: !isDesktopShell() && useTokenBody });
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
