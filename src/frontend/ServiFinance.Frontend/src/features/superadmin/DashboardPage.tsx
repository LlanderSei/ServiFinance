import { useSuperadminOverview } from "@/shared/api/useSuperadminOverview";
import { WorkspaceBarChart, WorkspacePieChart } from "@/shared/charts/WorkspaceCharts";
import {
  MobileRecordCardLayout,
  MobileRecordField,
  MobileRecordFieldGrid
} from "@/shared/records/MobileRecordDetails";
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

const mobileStaticTableClass = "max-lg:table max-lg:w-full max-lg:[&_thead]:table-header-group max-lg:[&_tbody]:table-row-group max-lg:[&_tr]:table-row max-lg:[&_tr]:rounded-none max-lg:[&_tr]:border-0 max-lg:[&_tr]:bg-transparent max-lg:[&_tr]:p-0 max-lg:[&_th]:table-cell max-lg:[&_th]:px-3 max-lg:[&_th]:py-2 max-lg:[&_td]:table-cell max-lg:[&_td]:border-b max-lg:[&_td]:border-base-300/55 max-lg:[&_td]:px-3 max-lg:[&_td]:py-2 max-lg:[&_td:first-child]:text-[0.82rem] max-lg:[&_td:first-child]:font-normal";

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
  const tenantStandingChart = overview
    ? [
      { name: "Active", value: overview.summary.activeTenants },
      { name: "Suspended", value: overview.summary.suspendedTenants }
    ]
    : [];
  const editionChart = overview
    ? [
      { name: "Standard", value: overview.summary.standardTenants },
      { name: "Premium", value: overview.summary.premiumTenants }
    ]
    : [];
  const subscriptionMixChart = (overview?.subscriptionMix ?? []).map((row) => ({
    name: `${row.businessSizeSegment} ${row.subscriptionEdition}`,
    value: row.count
  }));

  return (
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

            <div className="mb-4">
              <WorkspacePieChart data={subscriptionMixChart} emptyMessage="No tenant subscription mix can be charted yet." />
            </div>

            <WorkspaceSubtableShell className="max-lg:max-h-[14.5rem]">
              <WorkspaceSubtable className={mobileStaticTableClass}>
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
            <WorkspacePanelHeader eyebrow="Tenant posture" title="Active state and edition split" />

            <div className="grid gap-5">
              <WorkspaceBarChart
                data={[
                  { name: "Tenant state", active: tenantStandingChart[0]?.value ?? 0, suspended: tenantStandingChart[1]?.value ?? 0 }
                ]}
                series={[
                  { key: "active", name: "Active" },
                  { key: "suspended", name: "Suspended" }
                ]}
                emptyMessage="No tenant state metrics can be charted yet."
              />
              <WorkspacePieChart data={editionChart} height={230} emptyMessage="No tenant edition split can be charted yet." />
            </div>
          </WorkspacePanel>
        </WorkspacePanelGrid>

        <WorkspacePanelGrid singleColumn>
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
                        <MobileRecordCardLayout
                          upper={(
                            <WorkspaceTenantCell title={tenant.name} subtitle={`/${tenant.domainSlug}`} />
                          )}
                          middleColumns={2}
                          middle={(
                            <>
                              <MobileRecordFieldGrid>
                                <MobileRecordField label="Segment" value={tenant.businessSizeSegment} />
                                <MobileRecordField label="Registered" value={dateFormatter.format(new Date(tenant.createdAtUtc))} />
                              </MobileRecordFieldGrid>
                              <span className="inline-flex min-h-8 items-center justify-center rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1 text-xs font-semibold text-base-content/72">
                                {tenant.subscriptionEdition}
                              </span>
                            </>
                          )}
                        />
                        <div className="hidden lg:block">
                          <WorkspaceTenantCell title={tenant.name} subtitle={`/${tenant.domainSlug}`} />
                        </div>
                      </td>
                      <td className="max-lg:hidden">{tenant.businessSizeSegment}</td>
                      <td className="max-lg:hidden">{tenant.subscriptionEdition}</td>
                      <td className="max-lg:hidden">{dateFormatter.format(new Date(tenant.createdAtUtc))}</td>
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
  );
}
