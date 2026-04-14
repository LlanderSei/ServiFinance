import { useMemo, useState } from "react";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicBadge,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell,
  PublicWorkflowList
} from "@/shared/public/PublicPrimitives";

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
    <PublicShell>
      <PublicHeader />

      <main className="py-10">
        <PublicContainer className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.84fr)_minmax(0,1.16fr)]">
          <PublicCard className="grid min-h-full gap-6 p-7">
            <div className="grid gap-4">
              <PublicSectionHeading
                eyebrow="Onboarding preview"
                title="Provision one business identity, then unlock the right operating surface."
                description="ServiFinance onboards MSMEs through a single tenant setup. The selected tier decides whether the business stays web-only or extends into the desktop finance terminal."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Business shell</strong>
                <p className="mt-2 text-slate-600">Tenant domain, owner identity, and plan become the base control plane.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Segment-aware access</strong>
                <p className="mt-2 text-slate-600">Micro stays lean, Small becomes the baseline, and Medium adds broader visibility.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Edition switch</strong>
                <p className="mt-2 text-slate-600">Standard is web-first. Premium extends the tenant into desktop finance and lending workflows.</p>
              </div>
            </div>

            <PublicWorkflowList>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Choose the business shape</strong><span className="text-slate-600">Select the MSME segment and edition through the seeded tier catalog.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Preview unlocked modules</strong><span className="text-slate-600">See which web and desktop capabilities become available before activation.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Activate the tenant</strong><span className="text-slate-600">The backend will later provision auth, defaults, and entitlements from this selection.</span></li>
            </PublicWorkflowList>
          </PublicCard>

          <PublicCard className="grid gap-5 p-7 bg-white/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Business</p>
                <h2 className="mt-2 font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(2.8rem,4vw,4.6rem)] leading-[0.94] tracking-[-0.055em] text-slate-950">Guided setup shell</h2>
              </div>
              {selectedTier ? (
                <div className="grid justify-items-start gap-2 lg:justify-items-end">
                  <PublicBadge>{selectedTier.highlightLabel || selectedTier.code}</PublicBadge>
                  <strong className="text-slate-950">{selectedTier.priceDisplay}</strong>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {tiers.map((tier) => {
                const isActive = selectedTier?.id === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={[
                      "grid gap-1 rounded-[1.15rem] border px-4 py-4 text-left transition",
                      isActive
                        ? "border-primary/30 bg-gradient-to-b from-sky-50 to-teal-50 shadow-[0_14px_26px_rgba(63,88,184,0.08)]"
                        : "border-slate-900/8 bg-white/90 text-slate-950"
                    ].join(" ")}
                    onClick={() => setSelectedCode(tier.code)}
                  >
                    <span className="text-[0.82rem] uppercase tracking-[0.08em] text-slate-500">{tier.businessSizeSegment}</span>
                    <strong className="text-base text-slate-950">{tier.subscriptionEdition}</strong>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.7fr)]">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Business name</span>
                  <input className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950" disabled placeholder="Future owner business name" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Tenant domain slug</span>
                  <input className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950" disabled placeholder="exampledomain" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Owner full name</span>
                  <input className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950" disabled placeholder="Business owner" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Owner email</span>
                  <input className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950" disabled placeholder="owner@business.com" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Subscription tier</span>
                  <select
                    className="select select-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={selectedTier?.code ?? ""}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    disabled={!tiers.length}
                  >
                    {tiers.map((tier) => <option key={tier.id} value={tier.code}>{tier.displayName}</option>)}
                  </select>
                </label>

                <div className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-4 text-slate-700">
                  Registration persistence is not enabled yet. This page now previews MSME segment and edition selection
                  against the live backend tier catalog.
                </div>
              </div>

              <aside className="grid gap-4 rounded-[1.5rem] border border-primary/15 bg-gradient-to-b from-[rgba(218,248,244,0.84)] to-[rgba(255,255,255,0.88)] p-5">
                {selectedTier ? (
                  <>
                    <div className="grid gap-2">
                      <PublicBadge>{selectedTier.highlightLabel || selectedTier.code}</PublicBadge>
                      <h3 className="text-[2rem] tracking-[-0.04em] text-slate-950">{selectedTier.displayName}</h3>
                      <p className="text-[0.92rem] text-slate-500">{selectedTier.businessSizeSegment} business • {selectedTier.subscriptionEdition} edition</p>
                      <p className="text-slate-700">{selectedTier.audienceSummary}</p>
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-1 border-t border-slate-900/10 pt-3">
                        <small className="text-slate-500">Commercial view</small>
                        <strong className="text-slate-950">{selectedTier.priceDisplay}</strong>
                        <span className="text-slate-500">{selectedTier.billingLabel}</span>
                      </div>
                      <div className="grid gap-1 border-t border-slate-900/10 pt-3">
                        <small className="text-slate-500">Product shape</small>
                        <strong className="text-slate-950">{selectedTier.includesMicroLendingDesktop ? "Web + Desktop" : "Web Only"}</strong>
                        <span className="text-slate-500">{selectedTier.planSummary}</span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <h4 className="text-slate-950">Unlocked modules</h4>
                        <span className="text-slate-500">{selectedTier.modules.length} total</span>
                      </div>
                      <ul className="grid gap-3">
                        {highlightedModules.map((module) => (
                          <li key={module.moduleCode} className="flex items-start justify-between gap-4 border-t border-slate-900/8 pt-3">
                            <span className="text-slate-800">{module.moduleName}</span>
                            <span className={module.accessLevel === "Included"
                              ? "badge badge-success badge-soft border-0"
                              : "badge badge-warning badge-soft border-0"}>
                              {module.accessLevel}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {remainingModuleCount > 0 ? (
                        <p className="text-[0.92rem] text-slate-500">+ {remainingModuleCount} more modules unlocked after activation</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl text-slate-950">No active tiers</h3>
                    <p className="text-slate-600">The registration preview needs active seeded subscription tiers from the backend catalog.</p>
                  </>
                )}
              </aside>
            </div>
          </PublicCard>
        </PublicContainer>
      </main>

      <PublicFooter />
    </PublicShell>
  );
}
