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

  const highlightedModules = selectedTier?.modules.slice(0, 5) ?? [];
  const remainingModuleCount = Math.max((selectedTier?.modules.length ?? 0) - highlightedModules.length, 0);

  return (
    <div className="marketing-page">
      <PublicHeader />

      <main className="register-page">
        <section className="register-story">
          <div className="register-story__copy">
            <p className="eyebrow">Onboarding preview</p>
            <h1>Provision one business identity, then unlock the right operating surface.</h1>
            <p className="lede">
              ServiFinance onboards MSMEs through a single tenant setup. The selected tier decides whether the business
              stays web-only or extends into the desktop finance terminal.
            </p>
          </div>

          <div className="register-story__grid">
            <div>
              <strong>Business shell</strong>
              <p>Tenant domain, owner identity, and plan become the base control plane.</p>
            </div>
            <div>
              <strong>Segment-aware access</strong>
              <p>Micro stays lean, Small becomes the baseline, and Medium adds broader visibility.</p>
            </div>
            <div>
              <strong>Edition switch</strong>
              <p>Standard is web-first. Premium extends the tenant into desktop finance and lending workflows.</p>
            </div>
          </div>

          <ol className="workflow-list register-story__workflow">
            <li><strong>Choose the business shape</strong><span>Select the MSME segment and edition through the seeded tier catalog.</span></li>
            <li><strong>Preview unlocked modules</strong><span>See which web and desktop capabilities become available before activation.</span></li>
            <li><strong>Activate the tenant</strong><span>The backend will later provision auth, defaults, and entitlements from this selection.</span></li>
          </ol>
        </section>

        <section className="register-workbench">
          <div className="register-workbench__header">
            <div>
              <p className="eyebrow">Business</p>
              <h2>Guided setup shell</h2>
            </div>
            {selectedTier ? (
              <div className="register-workbench__active">
                <span className="tier-card__label">{selectedTier.highlightLabel || selectedTier.code}</span>
                <strong>{selectedTier.priceDisplay}</strong>
              </div>
            ) : null}
          </div>

          <div className="register-tier-picker">
            {tiers.map((tier) => {
              const isActive = selectedTier?.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={`register-tier-option${isActive ? " is-active" : ""}`}
                  onClick={() => setSelectedCode(tier.code)}
                >
                  <span>{tier.businessSizeSegment}</span>
                  <strong>{tier.subscriptionEdition}</strong>
                </button>
              );
            })}
          </div>

          <div className="register-shell">
            <div className="register-form">
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
                Registration persistence is not enabled yet. This page now previews MSME segment and edition selection
                against the live backend tier catalog.
              </div>
            </div>

            <aside className="register-summary">
              {selectedTier ? (
                <>
                  <div className="register-summary__hero">
                    <span className="tier-card__label">{selectedTier.highlightLabel || selectedTier.code}</span>
                    <h3>{selectedTier.displayName}</h3>
                    <p className="tier-card__kicker">{selectedTier.businessSizeSegment} business • {selectedTier.subscriptionEdition} edition</p>
                    <p>{selectedTier.audienceSummary}</p>
                  </div>

                  <div className="register-summary__facts">
                    <div>
                      <small>Commercial view</small>
                      <strong>{selectedTier.priceDisplay}</strong>
                      <span>{selectedTier.billingLabel}</span>
                    </div>
                    <div>
                      <small>Product shape</small>
                      <strong>{selectedTier.includesMicroLendingDesktop ? "Web + Desktop" : "Web Only"}</strong>
                      <span>{selectedTier.planSummary}</span>
                    </div>
                  </div>

                  <div className="register-summary__modules">
                    <div className="register-summary__module-header">
                      <h4>Unlocked modules</h4>
                      <span>{selectedTier.modules.length} total</span>
                    </div>
                    <ul className="tier-card__module-list">
                      {highlightedModules.map((module) => (
                        <li key={module.moduleCode}>
                          <span>{module.moduleName}</span>
                          <strong className={`module-pill module-pill--${module.accessLevel.toLowerCase()}`}>{module.accessLevel}</strong>
                        </li>
                      ))}
                    </ul>
                    {remainingModuleCount > 0 ? (
                      <p className="register-summary__remainder">+ {remainingModuleCount} more modules unlocked after activation</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <h3>No active tiers</h3>
                  <p>The registration preview needs active seeded subscription tiers from the backend catalog.</p>
                </>
              )}
            </aside>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
