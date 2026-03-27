import { useParams } from "react-router-dom";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function SmsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">{tenantDomainSlug} / SMS / Dashboard</p>
          <h1>Service Management Dashboard</h1>
          <p className="lede">Tenant-scoped web dashboard for {tenantDomainSlug}.</p>
        </div>

        <article className="surface-card">
          <p className="eyebrow">Current scope</p>
          <strong>Dashboard shell only</strong>
          <p>Service requests, customers, assignments, and reports will be added under this tenant route group.</p>
        </article>
      </main>
    </ProtectedRoute>
  );
}
