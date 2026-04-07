import { SubscriptionTierCard } from "@/shared/api/contracts";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

const segmentOrder = ["Micro", "Small", "Medium"];

function getModulesByChannel(tier: SubscriptionTierCard, channel: "Web" | "Desktop") {
  return tier.modules.filter((module) => module.channel === channel);
}

export function SubscriptionsPage() {
  const { data } = useSubscriptionTiers();
  const tiers = data ?? [];

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / Subscriptions</p>
          <h1>Subscriptions</h1>
          <p className="lede">
            MSME tier catalog for segment, edition, and unlocked modules. Standard stays web-only, while Premium
            extends into the desktop finance terminal according to the seeded entitlement matrix.
          </p>
        </div>

        {segmentOrder.map((segment) => {
          const segmentTiers = tiers.filter((tier) => tier.businessSizeSegment === segment);
          if (!segmentTiers.length) {
            return null;
          }

          return (
            <section key={segment} className="detail-section detail-section--compact">
              <div className="section-heading section-heading--compact">
                <p className="eyebrow">{segment}</p>
                <h2>{segment} business tiers</h2>
              </div>

              <div className="tier-grid tier-grid--expanded">
                {segmentTiers.map((tier) => {
                  const webModules = getModulesByChannel(tier, "Web");
                  const desktopModules = getModulesByChannel(tier, "Desktop");

                  return (
                    <article key={tier.id} className="tier-card tier-card--detailed">
                      <span className="tier-card__label">{tier.highlightLabel || tier.code}</span>
                      <div className="tier-card__meta">
                        <strong>{tier.displayName}</strong>
                        <span>{tier.subscriptionEdition}</span>
                      </div>
                      <p>{tier.audienceSummary}</p>
                      <strong>{tier.priceDisplay}</strong>
                      <small>{tier.billingLabel}</small>
                      <p>{tier.planSummary}</p>

                      <div className="tier-card__module-columns">
                        <div className="tier-card__module-column">
                          <h4>Web modules</h4>
                          <ul className="tier-card__module-list">
                            {webModules.map((module) => (
                              <li key={module.moduleCode}>
                                <span>{module.moduleName}</span>
                                <strong className={`module-pill module-pill--${module.accessLevel.toLowerCase()}`}>{module.accessLevel}</strong>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="tier-card__module-column">
                          <h4>Desktop modules</h4>
                          {desktopModules.length ? (
                            <ul className="tier-card__module-list">
                              {desktopModules.map((module) => (
                                <li key={module.moduleCode}>
                                  <span>{module.moduleName}</span>
                                  <strong className={`module-pill module-pill--${module.accessLevel.toLowerCase()}`}>{module.accessLevel}</strong>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="tier-card__empty">No desktop modules in this tier.</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </ProtectedRoute>
  );
}
