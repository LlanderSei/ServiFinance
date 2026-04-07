import { Link } from "react-router-dom";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function DashboardPage() {
  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / Dashboard</p>
          <h1>Platform control plane</h1>
          <p className="lede">Operate the root domain from one rail. Review tenant access, subscription posture, and overall platform readiness without leaving the shell.</p>
        </div>

        <div className="detail-grid">
          <article className="surface-card">
            <p className="eyebrow">Platform scope</p>
            <strong>Root-domain control plane</strong>
            <p>This overview remains reserved for SuperAdmin and stays cleanly separated from tenant workspaces.</p>
          </article>
          <article className="surface-card">
            <p className="eyebrow">Tenants</p>
            <strong>Subscribed tenants</strong>
            <p>Inspect account coverage, business segments, and adoption signals from a single navigation rail.</p>
          </article>
          <article className="surface-card">
            <p className="eyebrow">Modules</p>
            <strong>Service Management + Micro-Lending</strong>
            <p>Track which product surfaces are unlocked per tier while keeping root administration on its own route.</p>
          </article>
        </div>

        <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
          <Link className="button button--ghost" to="/tenants">Manage tenants</Link>
          <Link className="button button--ghost" to="/subscriptions">Review plans</Link>
        </div>
      </main>
    </ProtectedRoute>
  );
}
