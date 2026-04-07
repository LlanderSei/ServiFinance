import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function ModulesPage() {
  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / Modules</p>
          <h1>Modules</h1>
          <p className="lede">
            This module will own the platform module catalog and the access rules that back MSME subscription tiers.
          </p>
        </div>

        <section className="surface-card surface-card--empty">
          <p className="eyebrow">Planned Surface</p>
          <strong>Module catalog scaffold</strong>
          <p>
            The route is live so the sidebar can expose the full superadmin module set. The next pass should add the
            catalog list, module metadata editing, channel tagging, and tier entitlement mapping workflows.
          </p>
        </section>
      </main>
    </ProtectedRoute>
  );
}
