import { useEffect } from "react";
import { useTenantDomainValidation } from "./useTenantDomainValidation";

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const { branding, isLoading } = useTenantDomainValidation();

  useEffect(() => {
    if (isLoading) return;

    const root = document.documentElement;

    // Only inject properties that are explicitly set by the tenant
    if (branding.primaryColor) {
      root.style.setProperty("--tenant-primary-color", branding.primaryColor);
    } else {
      root.style.removeProperty("--tenant-primary-color");
    }

    if (branding.secondaryColor) {
      root.style.setProperty("--tenant-secondary-color", branding.secondaryColor);
    } else {
      root.style.removeProperty("--tenant-secondary-color");
    }

    if (branding.headerBackgroundColor) {
      root.style.setProperty("--tenant-header-bg", branding.headerBackgroundColor);
    } else {
      root.style.removeProperty("--tenant-header-bg");
    }

    if (branding.pageBackgroundColor) {
      root.style.setProperty("--tenant-page-bg", branding.pageBackgroundColor);
    } else {
      root.style.removeProperty("--tenant-page-bg");
    }

    if (branding.displayName) {
      document.title = branding.displayName;
    }

    return () => {
      root.style.removeProperty("--tenant-primary-color");
      root.style.removeProperty("--tenant-secondary-color");
      root.style.removeProperty("--tenant-header-bg");
      root.style.removeProperty("--tenant-page-bg");
    };
  }, [branding, isLoading]);

  return children;
}