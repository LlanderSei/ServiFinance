import { useMemo, useState } from "react";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";

export function RegisterPage() {
  const { data } = useSubscriptionTiers();
  const tiers = data ?? [];
  const [selectedCode, setSelectedCode] = useState<string>("");

  const selectedTier = useMemo(() => {
    if (!tiers.length) {
      return null;
    }

    return tiers.find((tier) => tier.code === (selectedCode || tiers[0].code)) ?? tiers[0];
  }, [selectedCode, tiers]);

  return (
    <div className="marketing-page">
      <PublicHeader />

      <main className="register-page">
        <section className="register-panel">
          <div>
            <p className="eyebrow">Onboarding preview</p>
            <h1>Register the business once, then deliver by tenant domain.</h1>
            <p className="lede">
              This is the future-facing onboarding shell for MSMEs that will subscribe to ServiFinance.
              Persistence is intentionally disabled for this phase.
            </p>
          </div>

          <ul className="workflow-list">
            <li><strong>Business setup</strong><span>Name, tenant domain, and operating owner details become the base identity.</span></li>
            <li><strong>Plan selection</strong><span>Choose the tier that unlocks web-only or web + desktop delivery.</span></li>
            <li><strong>Tenant activation</strong><span>The backend will later provision auth, modules, and tenant-scoped defaults automatically.</span></li>
          </ul>
        </section>

        <section className="register-shell">
          <div className="register-form">
            <div className="section-heading">
              <p className="eyebrow">Business</p>
              <h2>Guided setup shell</h2>
            </div>

            <label><span>Business name</span><input disabled placeholder="Future owner business name" /></label>
            <label><span>Tenant domain slug</span><input disabled placeholder="exampledomain" /></label>
            <label><span>Owner full name</span><input disabled placeholder="Business owner" /></label>
            <label><span>Owner email</span><input disabled placeholder="owner@business.com" /></label>
            <label>
              <span>Subscription tier</span>
              <select value={selectedTier?.code ?? ""} onChange={(event) => setSelectedCode(event.target.value)} disabled={!tiers.length}>
                {tiers.map((tier) => <option key={tier.id} value={tier.code}>{tier.displayName}</option>)}
              </select>
            </label>

            <div className="status-note">
              Registration persistence is not enabled yet. This page now previews the React onboarding experience against the live tier catalog.
            </div>
          </div>

          <aside className="tier-card">
            {selectedTier ? (
              <>
                <span className="tier-card__label">{selectedTier.highlightLabel || selectedTier.code}</span>
                <h3>{selectedTier.displayName}</h3>
                <p>{selectedTier.audienceSummary}</p>
                <strong>{selectedTier.priceDisplay}</strong>
                <small>{selectedTier.billingLabel}</small>
                <p>{selectedTier.planSummary}</p>
                <ul className="surface-list">
                  <li>{selectedTier.includesServiceManagementWeb ? "Includes" : "Excludes"} Service Management System web delivery</li>
                  <li>{selectedTier.includesMicroLendingDesktop ? "Includes" : "Excludes"} Micro-Lending System desktop delivery</li>
                </ul>
              </>
            ) : (
              <>
                <h3>No active tiers</h3>
                <p>The registration preview needs active seeded subscription tiers from the backend catalog.</p>
              </>
            )}
          </aside>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
