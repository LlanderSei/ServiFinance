import { desktopBridge } from "@/platform/desktop/bridge";
import { isDesktopBridgeEnvironment } from "@/platform/desktop/bridge";

export type DesktopShellContext = {
  appVersion: string;
  platform: string;
  apiBaseUrl: string;
};

let shellContextPromise: Promise<DesktopShellContext> | null = null;

export function isDesktopShell() {
  return typeof window !== "undefined" && isDesktopBridgeEnvironment();
}

export function toPlatformRoute(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return isDesktopShell() ? `/#${normalizedPath}` : normalizedPath;
}

export async function getDesktopShellContext() {
  if (!isDesktopShell()) {
    return {
      appVersion: "web",
      platform: "web",
      apiBaseUrl: ""
    } satisfies DesktopShellContext;
  }

  if (!shellContextPromise) {
    shellContextPromise = desktopBridge.getShellContext().then((context) => ({
      ...context,
      apiBaseUrl: context.apiBaseUrl.replace(/\/+$/, "")
    }));
  }

  return shellContextPromise;
}

export async function resolveApiUrl(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!isDesktopShell()) {
    return path;
  }

  const shellContext = await getDesktopShellContext();
  return `${shellContext.apiBaseUrl}${path}`;
}
