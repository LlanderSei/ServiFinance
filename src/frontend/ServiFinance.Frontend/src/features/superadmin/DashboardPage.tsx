import { useSuperadminOverview } from "@/shared/api/useSuperadminOverview";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceActionLink } from "@/shared/records/WorkspaceControls";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceAlertItem,
  WorkspaceAlertList,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell,
  WorkspaceTenantCell
} from "@/shared/records/WorkspacePanel";

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
        <WorkspaceScrollStack>
          <WorkspaceMetricGrid>
            <MetricCard
              label="Total tenants"
              value={overview?.summary.totalTenants ?? "--"}
              description="Subscribed customer workspaces on the root domain."
            />
            <MetricCard
              label="Active tenants"
              value={overview?.summary.activeTenants ?? "--"}
              description="Tenant accounts currently allowed to operate."
            />
            <MetricCard
              label="Suspended tenants"
              value={overview?.summary.suspendedTenants ?? "--"}
              description="Accounts waiting on manual platform review."
            />
            <MetricCard
              label="Standard edition"
              value={overview?.summary.standardTenants ?? "--"}
              description="Tenants currently on web-only commercial coverage."
            />
            <MetricCard
              label="Premium edition"
              value={overview?.summary.premiumTenants ?? "--"}
              description="Tenants with web and desktop commercial coverage."
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Subscription mix" title="MSME coverage" />

              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
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
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Recent activity" title="Provisioning stream" />

              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
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
                          <WorkspaceTenantCell title={tenant.name} subtitle={`/${tenant.domainSlug}`} />
                        </td>
                        <td>{tenant.businessSizeSegment}</td>
                        <td>{tenant.subscriptionEdition}</td>
                        <td>{dateFormatter.format(new Date(tenant.createdAtUtc))}</td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid singleColumn>
            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Warnings"
                title="Platform watch list"
                actions={(
                  <>
                    <WorkspaceActionLink to="/tenants">Manage tenants</WorkspaceActionLink>
                    <WorkspaceActionLink to="/system-health">Open health</WorkspaceActionLink>
                  </>
                )}
              />

              {overviewQuery.isLoading ? <WorkspaceEmptyState>Loading platform warnings...</WorkspaceEmptyState> : null}
              {overviewQuery.isError ? <WorkspaceEmptyState>Unable to load platform warnings.</WorkspaceEmptyState> : null}

              {!overviewQuery.isLoading && !overviewQuery.isError && !overview?.warnings.length ? (
                <WorkspaceEmptyState>No platform warnings at the moment.</WorkspaceEmptyState>
              ) : null}

              {overview?.warnings.length ? (
                <WorkspaceAlertList>
                  {overview.warnings.map((warning) => (
                    <WorkspaceAlertItem
                      key={warning.code}
                      title={warning.title}
                      message={warning.message}
                      badge={warning.severity}
                      tone={
                        warning.severity === "Critical"
                          ? "critical"
                          : warning.severity === "Warning"
                            ? "warning"
                            : "info"
                      }
                    />
                  ))}
                </WorkspaceAlertList>
              ) : null}
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
