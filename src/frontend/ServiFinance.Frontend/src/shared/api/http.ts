import { resolveApiUrl } from "@/platform/runtime";
import { isDesktopShell } from "@/platform/runtime";
import { ensureAccessToken, getAccessToken } from "@/shared/auth/session";

export type UploadProgressHandler = (progress: number) => void;

async function createRequestInit(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<RequestInit> {
  const headers: Record<string, string> = {};
  const shouldAttachToken = path.startsWith("/api/") && (!path.startsWith("/api/auth/") || path === "/api/auth/logout");

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

async function createFormDataRequestMetadata(path: string): Promise<{ headers: Record<string, string>; credentials: RequestCredentials }> {
  const headers: Record<string, string> = {};
  const shouldAttachToken = path.startsWith("/api/") && !path.startsWith("/api/auth/");

  if (shouldAttachToken) {
    const token = getAccessToken() ?? await ensureAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return {
    headers,
    credentials: isDesktopShell() ? "omit" : "include"
  };
}

async function createFormDataRequestInit(path: string, body: FormData): Promise<RequestInit> {
  const metadata = await createFormDataRequestMetadata(path);

  return {
    method: "POST",
    ...metadata,
    body
  };
}

export async function readApiErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!isJson) {
    return null;
  }

  try {
    const payload = await response.json() as { error?: string };
    return payload.error?.trim() ? payload.error : null;
  } catch {
    return null;
  }
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

async function throwApiError(response: Response): Promise<never> {
  const errorMessage = await readApiErrorMessage(response);
  throw new Error(errorMessage ?? `Request failed: ${response.status}`);
}

export async function httpGet<T>(path: string): Promise<T> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("GET", path));

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function httpPostJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("POST", path, body));

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export async function httpPutJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("PUT", path, body));

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export async function httpPostFormData<TResponse>(path: string, body: FormData): Promise<TResponse> {
  const response = await fetch(await resolveApiUrl(path), await createFormDataRequestInit(path, body));

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export async function httpPostFormDataWithProgress<TResponse>(
  path: string,
  body: FormData,
  onProgress?: UploadProgressHandler
): Promise<TResponse> {
  const url = await resolveApiUrl(path);
  const metadata = await createFormDataRequestMetadata(path);

  return new Promise<TResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.withCredentials = metadata.credentials === "include";

    Object.entries(metadata.headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(readXhrErrorMessage(request) ?? `Request failed: ${request.status}`));
        return;
      }

      if (request.status === 204) {
        resolve(undefined as TResponse);
        return;
      }

      try {
        resolve(JSON.parse(request.responseText) as TResponse);
      } catch {
        reject(new Error("The upload completed but the server returned an invalid response."));
      }
    };

    request.onerror = () => reject(new Error("Network error while uploading."));
    request.onabort = () => reject(new Error("Upload was cancelled."));
    request.send(body);
  });
}

export async function httpDelete(path: string): Promise<void> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("DELETE", path));

  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function httpDeleteJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(await resolveApiUrl(path), await createRequestInit("DELETE", path));

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

function readXhrErrorMessage(request: XMLHttpRequest): string | null {
  const contentType = request.getResponseHeader("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!isJson || !request.responseText) {
    return null;
  }

  try {
    const payload = JSON.parse(request.responseText) as { error?: string };
    return payload.error?.trim() ? payload.error : null;
  } catch {
    return null;
  }
}
