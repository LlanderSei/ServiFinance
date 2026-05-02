import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { TenantOperationalReportsResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceActionLink, WorkspaceInlineNote, WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import {
  WorkspaceAlertItem,
  WorkspaceAlertList,
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceDistributionRow,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell,
  WorkspaceTenantCell
} from "@/shared/records/WorkspacePanel";

export function SmsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();
  const dashboardQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dashboard-overview"],
    queryFn: () => httpGet<TenantOperationalReportsResponse>(`/api/tenants/${tenantDomainSlug}/sms/reports/overview`)
  });

  const distributionTotal = useMemo(
    () => (dashboardQuery.data?.serviceStatusDistribution ?? []).reduce((total, row) => total + row.count, 0),
    [dashboardQuery.data?.serviceStatusDistribution]
  );
  const comparisonLeaders = useMemo(
    () =>
      [...(dashboardQuery.data?.comparison ?? [])]
        .sort((left, right) => Math.abs(right.deltaValue) - Math.abs(left.deltaValue))
        .slice(0, 3),
    [dashboardQuery.data?.comparison]
  );
  const workloadLeaders = useMemo(
    () =>
      [...(dashboardQuery.data?.technicianWorkload ?? [])]
        .sort((left, right) => {
          const leftPressure = left.activeAssignments * 3 + left.scheduledAssignments * 2 + left.completedAssignments;
          const rightPressure = right.activeAssignments * 3 + right.scheduledAssignments * 2 + right.completedAssignments;
          return rightPressure - leftPressure;
        })
        .slice(0, 5),
    [dashboardQuery.data?.technicianWorkload]
  );

  const reportWindowLabel = dashboardQuery.data
    ? `${formatDateOnly(dashboardQuery.data.reportingWindow.dateFromUtc)} to ${formatDateOnly(dashboardQuery.data.reportingWindow.dateToUtc)}`
    : "Last 7 days";
  const activeAssignments = dashboardQuery.data?.totals.activeAssignments ?? 0;
  const overdueRequests = dashboardQuery.data?.turnaround.overdueOpenRequests ?? 0;
  const inProgressAssignments = dashboardQuery.data?.technicianWorkload.reduce((sum, row) => sum + row.activeAssignments, 0) ?? 0;
  const completedWindowRequests = dashboardQuery.data?.windowedActivity.completedRequests ?? 0;
  const intakeWindowRequests = dashboardQuery.data?.windowedActivity.newRequests ?? 0;

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / SMS / Dashboard`}
      title="Service operations"
      description="Keep one brief on tenant intake, dispatch movement, request pressure, and reporting health from a live service-operations control surface."
      recordCount={dashboardQuery.data?.totals.serviceRequests ?? 0}
      singularLabel="tracked request"
    >
      {dashboardQuery.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          Unable to load the tenant dashboard overview right now.
        </WorkspaceNotice>
      ) : null}

      <RecordScrollRegion>
        <WorkspaceScrollStack className="p-0">
          <WorkspacePanel className="overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(86,146,255,0.12),transparent_32%),linear-gradient(180deg,rgba(18,28,46,0.98),rgba(10,16,28,0.98))] text-white border-base-300/25">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[58rem]">
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/56">Control tower</p>
                <h2 className="mt-2 text-[clamp(1.9rem,3vw,2.8rem)] font-bold tracking-[-0.05em] text-white">
                  {buildDashboardHeadline(activeAssignments, overdueRequests, intakeWindowRequests)}
                </h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-white/74">
                  {dashboardQuery.isLoading
                    ? "Pulling tenant service activity, dispatch load, and reporting movement..."
                    : `Current window: ${reportWindowLabel}. The dashboard blends live intake, request execution, and reporting cues so the tenant team can see what is moving and what needs intervention first.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
                <HeroStat
                  label="Requests in window"
                  value={dashboardQuery.data?.windowedActivity.newRequests ?? 0}
                  description="Fresh intake recorded in the active dashboard window."
                />
                <HeroStat
                  label="Active work"
                  value={inProgressAssignments}
                  description="Assignments currently marked in progress."
                />
                <HeroStat
                  label="Overdue follow-up"
                  value={overdueRequests}
                  description="Open requests already past their requested service date."
                />
              </div>
            </div>
          </WorkspacePanel>

          <WorkspaceMetricGrid className="2xl:grid-cols-5">
            <MetricCard
              label="Customer base"
              value={dashboardQuery.data?.totals.customers ?? 0}
              description="Tenant-scoped customer records available for intake and dispatch."
            />
            <MetricCard
              label="Tracked requests"
              value={dashboardQuery.data?.totals.serviceRequests ?? 0}
              description="Total service requests currently present in the tenant register."
            />
            <MetricCard
              label="Active dispatch"
              value={activeAssignments}
              description="Assignments still scheduled, in progress, or on hold."
            />
            <MetricCard
              label="Completed work"
              value={dashboardQuery.data?.totals.completedAssignments ?? 0}
              description="Assignments already completed across the current tenant record set."
            />
            <MetricCard
              label="Invoices finalized"
              value={dashboardQuery.data?.windowedActivity.invoicesFinalized ?? 0}
              description="Finance-ready invoices created in the active reporting window."
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Attention queue"
                title="What needs focus now"
                actions={<WorkspaceStatusPill tone={getAttentionTone(overdueRequests, activeAssignments)}>{buildAttentionBadge(overdueRequests, activeAssignments)}</WorkspaceStatusPill>}
              />

              <WorkspaceAlertList>
                <WorkspaceAlertItem
                  title="Overdue open requests"
                  message="Requests still open after the requested service date should be reviewed first for customer follow-up or rescheduling."
                  badge={`${overdueRequests} flagged`}
                  tone={overdueRequests > 0 ? "critical" : "info"}
                />
                <WorkspaceAlertItem
                  title="Dispatch execution load"
                  message="This reflects currently scheduled and active assignments that still need technician time, updates, or completion handoff."
                  badge={`${activeAssignments} live`}
                  tone={activeAssignments > 0 ? "warning" : "info"}
                />
                <WorkspaceAlertItem
                  title="Completion throughput"
                  message="Compare intake against completions to see whether the service register is closing work as fast as new requests are entering."
                  badge={`${completedWindowRequests}/${intakeWindowRequests || 0}`}
                  tone={completedWindowRequests >= intakeWindowRequests && intakeWindowRequests > 0 ? "info" : "warning"}
                />
              </WorkspaceAlertList>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Today" title="Daily movement" />

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="New customers" value={dashboardQuery.data?.dailyActivity.newCustomersToday ?? 0} />
                <WorkspaceDetailItem label="New requests" value={dashboardQuery.data?.dailyActivity.newRequestsToday ?? 0} />
                <WorkspaceDetailItem label="Assignments scheduled" value={dashboardQuery.data?.dailyActivity.assignmentsScheduledToday ?? 0} />
                <WorkspaceDetailItem label="Assignments completed" value={dashboardQuery.data?.dailyActivity.assignmentsCompletedToday ?? 0} />
              </WorkspaceDetailGrid>

              <WorkspaceEmptyState className="pt-1">
                These counts reset with today&apos;s UTC activity window and give the tenant a quick brief before going deeper into dispatch or reports.
              </WorkspaceEmptyState>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Status mix" title="Where requests currently sit" />

              <div className="grid gap-4">
                {dashboardQuery.isLoading ? (
                  <WorkspaceEmptyState>
                    <WorkspaceInlineNote>Loading service status distribution...</WorkspaceInlineNote>
                  </WorkspaceEmptyState>
                ) : null}

                {!dashboardQuery.isLoading && !dashboardQuery.data?.serviceStatusDistribution.length ? (
                  <WorkspaceEmptyState>
                    <WorkspaceInlineNote>No service status distribution is available yet.</WorkspaceInlineNote>
                  </WorkspaceEmptyState>
                ) : null}

                {dashboardQuery.data?.serviceStatusDistribution.slice(0, 6).map((row) => (
                  <WorkspaceDistributionRow
                    key={row.status}
                    label={row.status}
                    value={row.count}
                    percentage={distributionTotal ? (row.count / distributionTotal) * 100 : 0}
                  />
                ))}
              </div>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Team pressure" title="Technician workload snapshot" />

              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Staff member</th>
                      <th>Active</th>
                      <th>Scheduled</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardQuery.isLoading ? (
                      <RecordTableStateRow colSpan={4}>Loading technician workload...</RecordTableStateRow>
                    ) : null}

                    {!dashboardQuery.isLoading && !workloadLeaders.length ? (
                      <RecordTableStateRow colSpan={4}>No technician workload is available yet.</RecordTableStateRow>
                    ) : null}

                    {workloadLeaders.map((row) => (
                      <tr key={row.userId}>
                        <td>{row.fullName}</td>
                        <td>{row.activeAssignments}</td>
                        <td>{row.scheduledAssignments}</td>
                        <td>{row.completedAssignments}</td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Comparison"
                title="Window momentum"
                actions={<WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/reports`}>Open full reports</WorkspaceActionLink>}
              />

              <div className="grid gap-3">
                {dashboardQuery.isLoading ? (
                  <WorkspaceEmptyState>
                    <WorkspaceInlineNote>Loading current-versus-previous period movement...</WorkspaceInlineNote>
                  </WorkspaceEmptyState>
                ) : null}

                {!dashboardQuery.isLoading && !comparisonLeaders.length ? (
                  <WorkspaceEmptyState>
                    <WorkspaceInlineNote>No comparison metrics are available yet.</WorkspaceInlineNote>
                  </WorkspaceEmptyState>
                ) : null}

                {comparisonLeaders.map((item) => (
                  <article key={item.key} className="rounded-2xl border border-base-300/65 bg-base-200/45 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <strong className="text-base-content">{item.label}</strong>
                        <p className="mt-1 text-sm text-base-content/65">
                          Current {item.currentValue} vs previous {item.previousValue}
                        </p>
                      </div>
                      <WorkspaceStatusPill tone={getDeltaTone(item.deltaValue)}>
                        {formatSignedValue(item.deltaValue)}
                        {item.deltaPercentage === null ? "" : ` • ${formatDeltaPercentage(item.deltaPercentage)}`}
                      </WorkspaceStatusPill>
                    </div>
                  </article>
                ))}
              </div>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Workspace map" title="Jump into the right module" />

              <div className="grid gap-3 md:grid-cols-2">
                <ModuleQuickLink
                  to={`/t/${tenantDomainSlug}/sms/customers`}
                  title="Customers"
                  stat={`${dashboardQuery.data?.totals.customers ?? 0} records`}
                  description="Review the tenant customer base before intake, dispatch, or finance handoff."
                />
                <ModuleQuickLink
                  to={`/t/${tenantDomainSlug}/sms/service-requests`}
                  title="Service Requests"
                  stat={`${dashboardQuery.data?.totals.serviceRequests ?? 0} tracked`}
                  description="Inspect intake flow, issue backlog, and request-to-invoice progress."
                />
                <ModuleQuickLink
                  to={`/t/${tenantDomainSlug}/sms/dispatch`}
                  title="Dispatch"
                  stat={`${activeAssignments} live`}
                  description="Coordinate technicians, assignment states, and execution evidence."
                />
                <ModuleQuickLink
                  to={`/t/${tenantDomainSlug}/sms/reports`}
                  title="Reports"
                  stat={reportWindowLabel}
                  description="Open full window comparison, turnaround metrics, and export-ready views."
                />
              </div>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Tenant brief" title="How this dashboard should be read" />
            <WorkspaceNoteList
              items={[
                "Start with the attention queue: overdue requests and active dispatch load are the fastest signals of operational drag.",
                "Use the status mix to see whether work is accumulating in a specific phase such as intake, scheduling, or service execution.",
                "Use the team pressure table to spot technicians carrying the highest live load before opening the dispatch timeline.",
                "Use the window momentum panel when you need a quick answer on whether current throughput is improving or slipping versus the previous period."
              ]}
            />
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordScrollRegion>
    </RecordWorkspace>
  );
}

function HeroStat({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <article className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-white/56">{label}</p>
      <strong className="mt-2 block text-[2rem] tracking-[-0.05em] text-white">{value}</strong>
      <p className="mt-1 text-sm leading-6 text-white/65">{description}</p>
    </article>
  );
}

function ModuleQuickLink({
  to,
  title,
  stat,
  description
}: {
  to: string;
  title: string;
  stat: string;
  description: string;
}) {
  return (
    <WorkspaceActionLink to={to} className="grid h-auto justify-start gap-2 rounded-2xl px-4 py-4 text-left normal-case">
      <div className="flex w-full items-center justify-between gap-3">
        <strong className="text-base-content">{title}</strong>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-base-content/55">{stat}</span>
      </div>
      <span className="whitespace-normal text-sm leading-6 text-base-content/65">{description}</span>
    </WorkspaceActionLink>
  );
}

function buildDashboardHeadline(activeAssignments: number, overdueRequests: number, intakeWindowRequests: number) {
  if (overdueRequests > 0) {
    return `${overdueRequests} overdue request${overdueRequests === 1 ? "" : "s"} need follow-up before they slip further.`;
  }

  if (activeAssignments > 0) {
    return `${activeAssignments} live assignment${activeAssignments === 1 ? "" : "s"} are currently moving through the tenant workspace.`;
  }

  if (intakeWindowRequests > 0) {
    return `${intakeWindowRequests} request${intakeWindowRequests === 1 ? "" : "s"} entered the current operating window with no urgent backlog yet.`;
  }

  return "The tenant workspace is quiet right now, with no urgent backlog signals in the current window.";
}

function buildAttentionBadge(overdueRequests: number, activeAssignments: number) {
  if (overdueRequests > 0) {
    return "Follow-up needed";
  }

  if (activeAssignments > 0) {
    return "Execution in motion";
  }

  return "Stable";
}

function getAttentionTone(overdueRequests: number, activeAssignments: number) {
  if (overdueRequests > 0) {
    return "warning";
  }

  if (activeAssignments > 0) {
    return "progress";
  }

  return "active";
}

function getDeltaTone(value: number) {
  if (value > 0) {
    return "active";
  }

  if (value < 0) {
    return "warning";
  }

  return "neutral";
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function formatDeltaPercentage(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
