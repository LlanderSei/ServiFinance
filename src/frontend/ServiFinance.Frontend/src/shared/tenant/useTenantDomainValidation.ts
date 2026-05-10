import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  defaultTenantBranding,
  fetchTenantBranding,
  TenantBrandingRequestError
} from "./tenantBranding";
import type { TenantBranding } from "./tenantBranding";

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
        const branding = await fetchTenantBranding(tenantDomainSlug);
        if (cancelled) {
          return;
        }

        setState({
          isLoading: false,
          exists: true,
          branding
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof TenantBrandingRequestError && error.status === 404) {
          setState({ isLoading: false, exists: false, branding: defaultTenantBranding });
          return;
        }

        // Fail open so transient branding lookup issues do not block tenant login.
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
