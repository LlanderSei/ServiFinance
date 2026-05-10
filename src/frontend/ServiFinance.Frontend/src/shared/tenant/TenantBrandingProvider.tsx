import { useEffect } from "react";
import { useTenantDomainValidation } from "./useTenantDomainValidation";
import {
  applyTenantBrandingToDocument,
  clearTenantBrandingFromDocument
} from "./tenantBranding";

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const { branding, isLoading } = useTenantDomainValidation();

  useEffect(() => {
    if (isLoading) return;

    applyTenantBrandingToDocument(branding);

    return () => {
      clearTenantBrandingFromDocument();
    };
  }, [branding, isLoading]);

  return children;
}
