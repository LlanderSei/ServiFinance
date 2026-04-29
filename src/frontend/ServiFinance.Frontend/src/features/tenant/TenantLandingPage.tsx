import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTenantDomainValidation } from "@/shared/tenant/useTenantDomainValidation";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicActionRow,
  PublicButton,
  PublicContainer,
  PublicShell
} from "@/shared/public/PublicPrimitives";
import { TenantLoginModal } from "@/shared/public/TenantLoginModal";

type Props = {
  system: "sms" | "mls";
};

export function TenantLandingPage({ system }: Props) {
  const { tenantDomainSlug } = useParams();
  const { branding } = useTenantDomainValidation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualOpen, setManualOpen] = useState(false);

  const loginOpen = manualOpen || searchParams.get("showLogin") === "true";
  const error = searchParams.get("error");

  const openLogin = () => setManualOpen(true);
  const closeLogin = () => {
    setManualOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("showLogin");
    next.delete("error");
    next.delete("returnUrl");
    setSearchParams(next, { replace: true });
  };

  // Resolve display values — use tenant branding when set, otherwise show placeholder cues
  const displayName = branding.displayName ?? null;
  const systemLabel = system === "sms" ? "Service Management" : "Micro-Lending";

  return (
    <PublicShell>
      <PublicHeader
        onLoginRequested={openLogin}
        tenantDisplayName={displayName}
        tenantLogoUrl={branding.logoUrl}
      />

      <main>
        <PublicContainer className="flex min-h-[calc(100svh-8rem)] flex-col items-start justify-center py-16">
          {/* Eyebrow label */}
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.22em] text-slate-400">
            {tenantDomainSlug} &middot; {systemLabel}
          </p>

          {/* Main title — tenant-configurable, shows placeholder when unset */}
          {displayName ? (
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900">
              {displayName}
            </h1>
          ) : (
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-300 select-none">
              Your Business Name
            </h1>
          )}

          {/* Hero subtitle — intentionally left as a placeholder slot */}
          <p className="mt-4 max-w-[38rem] text-[1.05rem] leading-[1.75] text-slate-400 italic">
            Business tagline or welcome message — configurable by the tenant owner.
          </p>

          <PublicActionRow className="mt-8">
            <PublicButton
              tone="primary"
              onClick={openLogin}
              style={{ background: "var(--tenant-primary-color, undefined)" }}
            >
              Login
            </PublicButton>
          </PublicActionRow>
        </PublicContainer>
      </main>

      <PublicFooter />

      <TenantLoginModal
        open={loginOpen}
        tenantDomainSlug={tenantDomainSlug ?? ""}
        system={system}
        error={error}
        onClose={closeLogin}
      />
    </PublicShell>
  );
}
