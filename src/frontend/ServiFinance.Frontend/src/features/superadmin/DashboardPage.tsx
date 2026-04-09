import { Link } from "react-router-dom";
import { useSuperadminOverview } from "@/shared/api/useSuperadminOverview";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export function DashboardPage() {
  const overviewQuery = useSuperadminOverview();
  const overview = overviewQuery.data;

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <RecordWorkspace
        breadcrumbs="SaaS / Dashboard"
        title="Platform control plane"
        description="Monitor the root domain with live tenant posture, segment coverage, recent provisioning activity, and platform warnings from one surface."
      >
        <div className="superadmin-module-scroll">
          <section className="superadmin-metric-grid">
            <article className="superadmin-metric-card">
              <span>Total tenants</span>
              <strong>{overview?.summary.totalTenants ?? "--"}</strong>
              <small>Subscribed customer workspaces on the root domain.</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Active tenants</span>
              <strong>{overview?.summary.activeTenants ?? "--"}</strong>
              <small>Tenant accounts currently allowed to operate.</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Suspended tenants</span>
              <strong>{overview?.summary.suspendedTenants ?? "--"}</strong>
              <small>Accounts waiting on manual platform review.</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Standard edition</span>
              <strong>{overview?.summary.standardTenants ?? "--"}</strong>
              <small>Tenants currently on web-only commercial coverage.</small>
            </article>

            <article className="superadmin-metric-card">
              <span>Premium edition</span>
              <strong>{overview?.summary.premiumTenants ?? "--"}</strong>
              <small>Tenants with web and desktop commercial coverage.</small>
            </article>
          </section>

          <section className="superadmin-panel-grid">
            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Subscription mix</p>
                  <h2>MSME coverage</h2>
                </div>
              </div>

              <div className="superadmin-subtable-shell">
                <table className="superadmin-subtable">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th>Edition</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.isLoading ? (
                      <tr>
                        <td colSpan={3}>Loading coverage...</td>
                      </tr>
                    ) : null}

                    {overviewQuery.isError ? (
                      <tr>
                        <td colSpan={3}>Unable to load subscription mix.</td>
                      </tr>
                    ) : null}

                    {!overviewQuery.isLoading && !overviewQuery.isError && !overview?.subscriptionMix.length ? (
                      <tr>
                        <td colSpan={3}>No subscription mix records found.</td>
                      </tr>
                    ) : null}

                    {overview?.subscriptionMix.map((row) => (
                      <tr key={`${row.businessSizeSegment}-${row.subscriptionEdition}`}>
                        <td>{row.businessSizeSegment}</td>
                        <td>{row.subscriptionEdition}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Recent activity</p>
                  <h2>Provisioning stream</h2>
                </div>
              </div>

              <div className="superadmin-subtable-shell">
                <table className="superadmin-subtable">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Segment</th>
                      <th>Edition</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.isLoading ? (
                      <tr>
                        <td colSpan={4}>Loading recent registrations...</td>
                      </tr>
                    ) : null}

                    {overviewQuery.isError ? (
                      <tr>
                        <td colSpan={4}>Unable to load recent provisioning activity.</td>
                      </tr>
                    ) : null}

                    {!overviewQuery.isLoading && !overviewQuery.isError && !overview?.recentTenants.length ? (
                      <tr>
                        <td colSpan={4}>No recent tenant activity found.</td>
                      </tr>
                    ) : null}

                    {overview?.recentTenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td>
                          <div className="superadmin-tenant-cell">
                            <strong>{tenant.name}</strong>
                            <span>/{tenant.domainSlug}</span>
                          </div>
                        </td>
                        <td>{tenant.businessSizeSegment}</td>
                        <td>{tenant.subscriptionEdition}</td>
                        <td>{dateFormatter.format(new Date(tenant.createdAtUtc))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="superadmin-panel-grid superadmin-panel-grid--single">
            <article className="superadmin-panel">
              <div className="superadmin-panel__header">
                <div>
                  <p className="superadmin-panel__eyebrow">Warnings</p>
                  <h2>Platform watch list</h2>
                </div>

                <div className="superadmin-panel__actions">
                  <Link className="record-action-button" to="/tenants">Manage tenants</Link>
                  <Link className="record-action-button" to="/system-health">Open health</Link>
                </div>
              </div>

              {overviewQuery.isLoading ? <p className="superadmin-empty">Loading platform warnings...</p> : null}
              {overviewQuery.isError ? <p className="superadmin-empty">Unable to load platform warnings.</p> : null}

              {!overviewQuery.isLoading && !overviewQuery.isError && !overview?.warnings.length ? (
                <p className="superadmin-empty">No platform warnings at the moment.</p>
              ) : null}

              {overview?.warnings.length ? (
                <ul className="superadmin-warning-list">
                  {overview.warnings.map((warning) => (
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
