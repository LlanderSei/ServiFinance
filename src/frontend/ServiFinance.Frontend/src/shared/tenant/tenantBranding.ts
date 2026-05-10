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
  setCssVariable(root, "--tenant-primary-color", branding.primaryColor);
  setCssVariable(root, "--tenant-secondary-color", branding.secondaryColor);
  setCssVariable(root, "--tenant-header-bg", branding.headerBackgroundColor);
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
  root.style.removeProperty("--tenant-page-bg");
}

function setCssVariable(root: HTMLElement, key: string, value: string | null) {
  if (value) {
    root.style.setProperty(key, value);
    return;
  }

  root.style.removeProperty(key);
}
