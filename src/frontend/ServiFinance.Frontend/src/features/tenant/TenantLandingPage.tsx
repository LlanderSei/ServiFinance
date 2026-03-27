import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
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
    [system],
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
    <div className="marketing-page">
      <PublicHeader onLoginRequested={openLogin} />

      <main className="page tenant-public-page">
        <div className="section-heading">
          <p className="eyebrow">{tenantDomainSlug} / {system.toUpperCase()}</p>
          <h1>{systemName}</h1>
          <p className="lede">{systemLead}</p>
        </div>

        <div className="detail-grid">
          <article className="surface-card">
            <p className="eyebrow">Tenant identity</p>
            <strong>{tenantDomainSlug}</strong>
            <p>This route remains tenant-scoped and will never authenticate accounts from other domains.</p>
          </article>
          <article className="surface-card">
            <p className="eyebrow">Delivery</p>
            <strong>{system === "sms" ? "Web workspace" : "Desktop workspace"}</strong>
            <p>{system === "sms" ? "Browser-based workflow execution for service operations." : "Desktop-oriented workflow execution for financial and lending actions."}</p>
          </article>
          <article className="surface-card">
            <p className="eyebrow">Access</p>
            <strong>Tenant-only sign in</strong>
            <p>The same tenant account can cross SMS and MLS when the plan allows it, but never into another tenant slug.</p>
          </article>
        </div>

        <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
          <button type="button" className="button button--primary" onClick={openLogin}>Login</button>
        </div>
      </main>

      <PublicFooter />
      <TenantLoginModal
        open={loginOpen}
        tenantDomainSlug={tenantDomainSlug ?? ""}
        system={system}
        error={error}
        onClose={closeLogin}
      />
    </div>
  );
}
