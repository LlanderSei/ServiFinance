import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRefreshSession(true);

  useEffect(() => {
    if (isError) {
      navigate("/?showLogin=true", { replace: true });
    }
  }, [isError, navigate]);

  if (isLoading) {
    return (
      <main className="page">
        <p className="eyebrow">Superadmin</p>
        <h1>Loading SaaS dashboard…</h1>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="page authed-page">
      <div className="section-heading">
        <p className="eyebrow">SaaS / Dashboard</p>
        <h1>Platform control plane</h1>
        <p className="lede">Signed in as {data.user.fullName}. This React slice now owns the root superadmin dashboard route.</p>
      </div>

      <div className="detail-grid">
        <article className="surface-card">
          <p className="eyebrow">Platform scope</p>
          <strong>Root-domain control plane</strong>
          <p>This surface remains reserved for SuperAdmin and stays separate from tenant dashboards.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Tenants</p>
          <strong>Subscribed tenants</strong>
          <p>Inspect tenant accounts, future billing posture, and SaaS adoption from one place.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Modules</p>
          <strong>Service Management + Micro-Lending</strong>
          <p>Tenant product surfaces still authenticate independently and continue to live outside the root domain.</p>
        </article>
      </div>

      <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
        <Link className="button button--ghost" to="/tenants">Legacy Tenants Page</Link>
        <Link className="button button--ghost" to="/subscriptions">Legacy Subscriptions Page</Link>
      </div>
    </main>
  );
}
