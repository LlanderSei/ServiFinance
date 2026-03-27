import { useParams } from "react-router-dom";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function MlsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">{tenantDomainSlug} / MLS / Dashboard</p>
          <h1>Micro-Lending System</h1>
          <p className="lede">Tenant-specific desktop placeholder surface for {tenantDomainSlug}.</p>
        </div>

        <article className="surface-card">
          <p className="eyebrow">Current scope</p>
          <strong>Desktop placeholder only</strong>
          <p>This route documents the tenant-aware desktop entry point until the MAUI client is wired to shared auth.</p>
        </article>
      </main>
    </ProtectedRoute>
  );
}
