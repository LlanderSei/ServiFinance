import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function SystemHealthPage() {
  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / System Health</p>
          <h1>System health</h1>
          <p className="lede">
            This module is reserved for platform health monitoring, background job status, and environment readiness.
          </p>
        </div>

        <section className="surface-card surface-card--empty">
          <p className="eyebrow">Planned Surface</p>
          <strong>Monitoring console scaffold</strong>
          <p>
            The route is live so navigation and access control are in place. The next pass should add API health checks,
            database readiness, queue status, and deployment diagnostics for superadmin use.
          </p>
        </section>
      </main>
    </ProtectedRoute>
  );
}
