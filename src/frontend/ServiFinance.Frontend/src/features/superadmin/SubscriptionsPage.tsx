import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function SubscriptionsPage() {
  const { data } = useSubscriptionTiers();

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / Subscriptions</p>
          <h1>Subscriptions</h1>
          <p className="lede">Tier catalog placeholder for future billing state, plan management, and lifecycle workflows.</p>
        </div>

        <div className="tier-grid">
          {data?.map((tier) => (
            <article key={tier.id} className="tier-card">
              <span className="tier-card__label">{tier.highlightLabel || tier.code}</span>
              <h3>{tier.displayName}</h3>
              <p>{tier.description}</p>
              <strong>{tier.priceDisplay}</strong>
              <small>{tier.billingLabel}</small>
            </article>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}
