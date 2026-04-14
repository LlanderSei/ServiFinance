import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicActionRow,
  PublicButton,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell
} from "@/shared/public/PublicPrimitives";
import { TenantLoginModal } from "@/shared/public/TenantLoginModal";

type Props = {
  system: "sms" | "mls";
};

export function TenantLandingPage({ system }: Props) {
  const { tenantDomainSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualOpen, setManualOpen] = useState(false);
  const loginOpen = manualOpen || searchParams.get("showLogin") === "true";
  const error = searchParams.get("error");
  const systemName = system === "sms" ? "Service Management System" : "Micro-Lending System";
  const systemLead = useMemo(
    () =>
      system === "sms"
        ? "Public tenant-facing web surface for intake, scheduling, dispatching, and operator coordination."
        : "Public tenant-facing desktop companion surface for collections, amortization, and lending execution.",
    [system]
  );

  const openLogin = () => setManualOpen(true);
  const closeLogin = () => {
    setManualOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("showLogin");
    next.delete("error");
    next.delete("returnUrl");
    setSearchParams(next, { replace: true });
  };

  return (
    <PublicShell>
      <PublicHeader onLoginRequested={openLogin} />

      <main className="py-10">
        <PublicContainer>
          <PublicSectionHeading
            eyebrow={`${tenantDomainSlug} / ${system.toUpperCase()}`}
            title={systemName}
            description={systemLead}
          />

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            <PublicCard>
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Tenant identity</p>
              <strong className="mt-2 block text-lg text-slate-950">{tenantDomainSlug}</strong>
              <p className="mt-2 text-slate-600">This route remains tenant-scoped and will never authenticate accounts from other domains.</p>
            </PublicCard>
            <PublicCard>
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Delivery</p>
              <strong className="mt-2 block text-lg text-slate-950">{system === "sms" ? "Web workspace" : "Desktop workspace"}</strong>
              <p className="mt-2 text-slate-600">{system === "sms" ? "Browser-based workflow execution for service operations." : "Desktop-oriented workflow execution for financial and lending actions."}</p>
            </PublicCard>
            <PublicCard>
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Access</p>
              <strong className="mt-2 block text-lg text-slate-950">Tenant-only sign in</strong>
              <p className="mt-2 text-slate-600">The same tenant account can cross SMS and MLS when the plan allows it, but never into another tenant slug.</p>
            </PublicCard>
          </div>

          <PublicActionRow>
            <PublicButton tone="primary" onClick={openLogin}>Login</PublicButton>
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
