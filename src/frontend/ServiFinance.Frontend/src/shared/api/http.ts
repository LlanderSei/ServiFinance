import { resolveApiUrl } from "@/platform/runtime";
import { isDesktopShell } from "@/platform/runtime";
import { ensureAccessToken, getAccessToken } from "@/shared/auth/session";

async function createRequestInit(method: "GET" | "POST", path: string, body?: unknown): Promise<RequestInit> {
  const headers: Record<string, string> = {};
  const shouldAttachToken = path.startsWith("/api/") && !path.startsWith("/api/auth/");

  if (body !== null && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (shouldAttachToken) {
    const token = getAccessToken() ?? await ensureAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return {
    method,
    headers,
    credentials: isDesktopShell() ? "omit" : "include",
    body: body === undefined ? undefined : JSON.stringify(body)
  };
}

export async function httpGet<T>(path: string): Promise<T> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("GET", path));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function httpPostJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("POST", path, body));

  if (!response.ok) {
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) {
        throw new Error(payload.error);
      }
    } catch (error) {
      if (error instanceof Error && error.message) {
        throw error;
      }
    }

    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
