import { useSuperadminSystemHealth } from "@/shared/api/useSuperadminSystemHealth";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export function SystemHealthPage() {
  const healthQuery = useSuperadminSystemHealth();
  const health = healthQuery.data;

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <RecordWorkspace
        breadcrumbs="SaaS / System Health"
        title="System health"
        description="Watch API readiness, database state, hybrid bridge coverage, and deployment metadata from the root-domain monitoring console."
      >
        <div className="superadmin-module-scroll">
          <section className="superadmin-metric-grid">
            <article className="superadmin-metric-card">
              <span>API status</span>
              <strong>{health?.api.status ?? "--"}</strong>
              <small>{health?.api.environment ?? "Loading environment..."}</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Database</span>
              <strong>{health?.database.status ?? "--"}</strong>
              <small>{health?.database.canConnect ? "Connection verified." : "Waiting on connectivity check."}</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Pending migrations</span>
              <strong>{health?.database.pendingMigrationCount ?? "--"}</strong>
              <small>Migration drift between code and SQL Server.</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Queue workers</span>
              <strong>{health?.queues.status ?? "--"}</strong>
              <small>{health?.queues.summary ?? "Loading background worker state..."}</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Hybrid bridge</span>
              <strong>{health?.hybrid.status ?? "--"}</strong>
              <small>{health?.hybrid.summary ?? "Loading hybrid shell state..."}</small>
            </article>
          </section>

          <section className="superadmin-panel-grid">
            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Runtime</p>
                  <h2>Host diagnostics</h2>
                </div>
              </div>

              <dl className="superadmin-detail-grid">
                <div>
                  <dt>Version</dt>
                  <dd>{health?.api.version ?? "--"}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{health?.api.environment ?? "--"}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{health?.api.startedAtUtc ? dateFormatter.format(new Date(health.api.startedAtUtc)) : "--"}</dd>
                </div>
                <div>
                  <dt>Uptime</dt>
                  <dd>{typeof health?.api.uptimeMinutes === "number" ? `${health.api.uptimeMinutes} min` : "--"}</dd>
                </div>
                <div>
                  <dt>Last build</dt>
                  <dd>{health?.api.buildTimestampUtc ? dateFormatter.format(new Date(health.api.buildTimestampUtc)) : "--"}</dd>
                </div>
                <div>
                  <dt>Latest migration</dt>
                  <dd>{health?.database.latestAppliedMigration ?? "--"}</dd>
                </div>
              </dl>
            </article>

            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Catalog state</p>
                  <h2>Tiers and modules</h2>
                </div>
              </div>

              <dl className="superadmin-detail-grid">
                <div>
                  <dt>Active tiers</dt>
                  <dd>{health?.catalog.activeTierCount ?? "--"}</dd>
                </div>
                <div>
                  <dt>Inactive tiers</dt>
                  <dd>{health?.catalog.inactiveTierCount ?? "--"}</dd>
                </div>
                <div>
                  <dt>Active modules</dt>
                  <dd>{health?.catalog.activeModuleCount ?? "--"}</dd>
                </div>
                <div>
                  <dt>Inactive modules</dt>
                  <dd>{health?.catalog.inactiveModuleCount ?? "--"}</dd>
                </div>
                <div>
                  <dt>Applied migrations</dt>
                  <dd>{health?.database.appliedMigrationCount ?? "--"}</dd>
                </div>
                <div>
                  <dt>Can connect</dt>
                  <dd>{health?.database.canConnect ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="superadmin-panel-grid superadmin-panel-grid--single">
            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Warnings</p>
                  <h2>Health alerts</h2>
                </div>
              </div>

              {healthQuery.isLoading ? <p className="superadmin-empty">Loading health warnings...</p> : null}
              {healthQuery.isError ? <p className="superadmin-empty">Unable to load health diagnostics.</p> : null}

              {!healthQuery.isLoading && !healthQuery.isError && !health?.warnings.length ? (
                <p className="superadmin-empty">No health alerts right now.</p>
              ) : null}

              {health?.warnings.length ? (
                <ul className="superadmin-warning-list">
                  {health.warnings.map((warning) => (
                    <li key={warning.code} className={`superadmin-warning superadmin-warning--${warning.severity.toLowerCase()}`}>
                      <div>
                        <strong>{warning.title}</strong>
                        <p>{warning.message}</p>
                      </div>
                      <span>{warning.severity}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </section>
        </div>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
