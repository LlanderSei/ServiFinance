import { isDesktopShell, resolveApiUrl } from "@/platform/runtime";

export interface TenantBranding {
  domainSlug: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  headerBackgroundColor: string | null;
  pageBackgroundColor: string | null;
}

type TenantBrandingPayload = {
  domainSlug?: string | null;
  tenantDomainSlug?: string | null;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  headerBackgroundColor?: string | null;
  pageBackgroundColor?: string | null;
};

export class TenantBrandingRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TenantBrandingRequestError";
  }
}

export const defaultTenantBranding: TenantBranding = {
  domainSlug: "",
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  headerBackgroundColor: null,
  pageBackgroundColor: null
};

export function tenantBrandingQueryKey(tenantDomainSlug: string) {
  return ["tenant-branding", tenantDomainSlug] as const;
}

export function toTenantBranding(payload: TenantBrandingPayload, fallbackDomainSlug = ""): TenantBranding {
  return {
    domainSlug: payload.domainSlug ?? payload.tenantDomainSlug ?? fallbackDomainSlug,
    displayName: payload.displayName ?? null,
    logoUrl: payload.logoUrl ?? null,
    primaryColor: payload.primaryColor ?? null,
    secondaryColor: payload.secondaryColor ?? null,
    headerBackgroundColor: payload.headerBackgroundColor ?? null,
    pageBackgroundColor: payload.pageBackgroundColor ?? null
  };
}

export async function fetchTenantBranding(tenantDomainSlug: string): Promise<TenantBranding> {
  const normalizedSlug = tenantDomainSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return defaultTenantBranding;
  }

  const response = await fetch(
    await resolveApiUrl(`/api/tenants/${encodeURIComponent(normalizedSlug)}/public-info`),
    {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: isDesktopShell() ? "omit" : "include"
    }
  );

  if (!response.ok) {
    throw new TenantBrandingRequestError(
      response.status === 404
        ? "Tenant domain not found or is no longer active."
        : `Tenant branding request failed: ${response.status}`,
      response.status
    );
  }

  return toTenantBranding(await response.json() as TenantBrandingPayload, normalizedSlug);
}

export function applyTenantBrandingToDocument(branding: TenantBranding) {
  const root = document.documentElement;
  const headerTextColors = resolveReadableTextColors(branding.headerBackgroundColor);
  setCssVariable(root, "--tenant-primary-color", branding.primaryColor);
  setCssVariable(root, "--tenant-secondary-color", branding.secondaryColor);
  setCssVariable(root, "--tenant-header-bg", branding.headerBackgroundColor);
  setCssVariable(root, "--tenant-header-fg", headerTextColors.foreground);
  setCssVariable(root, "--tenant-header-muted", headerTextColors.muted);
  setCssVariable(root, "--tenant-page-bg", branding.pageBackgroundColor);

  if (branding.displayName) {
    document.title = branding.displayName;
  }
}

export function clearTenantBrandingFromDocument() {
  const root = document.documentElement;
  root.style.removeProperty("--tenant-primary-color");
  root.style.removeProperty("--tenant-secondary-color");
  root.style.removeProperty("--tenant-header-bg");
  root.style.removeProperty("--tenant-header-fg");
  root.style.removeProperty("--tenant-header-muted");
  root.style.removeProperty("--tenant-page-bg");
}

export function resolveReadableTextColors(backgroundColor: string | null | undefined) {
  const color = parseHexColor(backgroundColor);
  if (!color) {
    return {
      foreground: null,
      muted: null
    };
  }

  const luminance = relativeLuminance(color);
  if (luminance > 0.52) {
    return {
      foreground: "#141827",
      muted: "rgba(20, 24, 39, 0.68)"
    };
  }

  return {
    foreground: "#ffffff",
    muted: "rgba(255, 255, 255, 0.78)"
  };
}

function setCssVariable(root: HTMLElement, key: string, value: string | null) {
  if (value) {
    root.style.setProperty(key, value);
    return;
  }

  root.style.removeProperty(key);
}

function parseHexColor(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const shortHexMatch = /^#([0-9a-fA-F]{3})$/.exec(normalized);
  if (shortHexMatch) {
    const [, hex] = shortHexMatch;
    return {
      red: parseInt(hex[0] + hex[0], 16),
      green: parseInt(hex[1] + hex[1], 16),
      blue: parseInt(hex[2] + hex[2], 16)
    };
  }

  const fullHexMatch = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!fullHexMatch) {
    return null;
  }

  const [, hex] = fullHexMatch;
  return {
    red: parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue: parseInt(hex.slice(4, 6), 16)
  };
}

function relativeLuminance(color: { red: number; green: number; blue: number }) {
  const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
