import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export interface TenantBranding {
  domainSlug: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  headerBackgroundColor: string | null;
  pageBackgroundColor: string | null;
}

const defaultTenantBranding: TenantBranding = {
  domainSlug: "",
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  headerBackgroundColor: null,
  pageBackgroundColor: null
};

export function useTenantDomainValidation() {
  const { tenantDomainSlug = "" } = useParams();
  const [state, setState] = useState<{
    isLoading: boolean;
    exists: boolean | null;
    branding: TenantBranding;
  }>({
    isLoading: true,
    exists: null,
    branding: defaultTenantBranding
  });

  useEffect(() => {
    if (!tenantDomainSlug) {
      setState({ isLoading: false, exists: false, branding: defaultTenantBranding });
      return;
    }

    let cancelled = false;

    const validateTenant = async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantDomainSlug}/public-info`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          setState({
            isLoading: false,
            exists: true,
            branding: {
              domainSlug: data.domainSlug ?? tenantDomainSlug,
              displayName: data.displayName ?? null,
              logoUrl: data.logoUrl ?? null,
              primaryColor: data.primaryColor ?? null,
              secondaryColor: data.secondaryColor ?? null,
              headerBackgroundColor: data.headerBackgroundColor ?? null,
              pageBackgroundColor: data.pageBackgroundColor ?? null
            }
          });
        } else if (response.status === 404) {
          setState({ isLoading: false, exists: false, branding: defaultTenantBranding });
        } else {
          // Other error (5xx, etc.) — fail open to not block real tenants
          setState({
            isLoading: false,
            exists: true,
            branding: { ...defaultTenantBranding, domainSlug: tenantDomainSlug }
          });
        }
      } catch {
        if (cancelled) return;
        // Network error — fail open gracefully
        setState({
          isLoading: false,
          exists: true,
          branding: { ...defaultTenantBranding, domainSlug: tenantDomainSlug }
        });
      }
    };

    validateTenant();

    return () => {
      cancelled = true;
    };
  }, [tenantDomainSlug]);

  return state;
}