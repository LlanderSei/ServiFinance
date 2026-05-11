import type { AuthSessionResponse } from "@/shared/api/contracts";
import { isDesktopShell, resolveApiUrl } from "@/platform/runtime";
import { desktopBridge } from "@/platform/desktop/bridge";
import { webSessionStorage } from "@/platform/web/sessionStorage";

let accessToken: string | null = null;
let currentSession: AuthSessionResponse | null = null;
let refreshRequest: Promise<AuthSessionResponse | null> | null = null;
let sessionEpoch = 0;

type ApplySessionOptions = {
  rememberOnWeb?: boolean;
};

function normalizeSurface(
  surface: AuthSessionResponse["user"]["surface"] | number,
): AuthSessionResponse["user"]["surface"] {
  if (typeof surface === "string") {
    const validSurfaces: AuthSessionResponse["user"]["surface"][] = ["Root", "TenantWeb", "TenantDesktop", "CustomerWeb"];
    if (validSurfaces.includes(surface as any)) {
      return surface as AuthSessionResponse["user"]["surface"];
    }
    return "Root";
  }

  switch (surface) {
    case 0:
      return "Root";
    case 1:
      return "TenantWeb";
    case 2:
      return "TenantDesktop";
    case 3:
      return "CustomerWeb";
    default:
      return "Root";
  }
}

function normalizeSessionResponse(response: AuthSessionResponse): AuthSessionResponse {
  return {
    ...response,
    user: {
      ...response.user,
      platformScopes: response.user.platformScopes ?? [],
      permissionKeys: response.user.permissionKeys ?? [],
      moduleAccess: response.user.moduleAccess ?? [],
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

export function updateCurrentSessionUser(patch: Partial<AuthSessionResponse["user"]>) {
  if (!currentSession) {
    return null;
  }

  currentSession = normalizeSessionResponse({
    ...currentSession,
    user: {
      ...currentSession.user,
      ...patch
    }
  });
  accessToken = currentSession.tokens.accessToken;
  return currentSession;
}

export async function applySession(response: AuthSessionResponse, options: ApplySessionOptions = {}) {
  const normalizedResponse = normalizeSessionResponse(response);
  sessionEpoch += 1;
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
  sessionEpoch += 1;
  accessToken = null;
  currentSession = null;
  refreshRequest = null;

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

  const requestEpoch = sessionEpoch;
  const request = (async () => {
    const requestUrl = await resolveApiUrl("/api/auth/refresh");
    const storedRefreshToken = isDesktopShell()
      ? await desktopBridge.getRefreshToken()
      : webSessionStorage.getRefreshToken();

    if (requestEpoch !== sessionEpoch) {
      return null;
    }

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

    if (requestEpoch !== sessionEpoch) {
      return null;
    }

    if (!response.ok) {
      if (requestEpoch === sessionEpoch) {
        if (isDesktopShell()) {
          await desktopBridge.clearRefreshToken();
        } else {
          webSessionStorage.clear();
        }

        accessToken = null;
        currentSession = null;
      }

      return null;
    }

    const payload = normalizeSessionResponse(await response.json() as AuthSessionResponse);
    if (requestEpoch !== sessionEpoch) {
      return null;
    }

    await applySession(payload, { rememberOnWeb: !isDesktopShell() && useTokenBody });
    return payload;
  })();

  refreshRequest = request;
  void request.then(() => {
    if (refreshRequest === request) {
      refreshRequest = null;
    }
  }, () => {
    if (refreshRequest === request) {
      refreshRequest = null;
    }
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
