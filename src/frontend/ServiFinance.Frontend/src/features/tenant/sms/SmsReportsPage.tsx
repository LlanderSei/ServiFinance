import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { TenantOperationalReportsResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceActionButton,
  WorkspaceFilter,
  WorkspaceInlineNote,
  WorkspaceInput,
  WorkspaceNotice,
  WorkspaceStatusPill,
  WorkspaceToggleButton,
  WorkspaceToggleGroup
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceEmptyState,
  WorkspaceDistributionRow,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell,
  WorkspaceTenantCell,
  WorkspaceToolbar
} from "@/shared/records/WorkspacePanel";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";

type ReportRangePreset = "7d" | "30d" | "custom";

const defaultDateTo = formatDateInput(new Date());
const defaultDateFrom = shiftDate(defaultDateTo, -6);

export function SmsReportsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const preset = useMemo<ReportRangePreset>(() => {
    if (dateTo === defaultDateTo && dateFrom === defaultDateFrom) {
      return "7d";
    }

    if (dateTo === defaultDateTo && dateFrom === shiftDate(defaultDateTo, -29)) {
      return "30d";
    }

    return "custom";
  }, [dateFrom, dateTo]);
  const reportsQueryString = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (dateFrom) {
      searchParams.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      searchParams.set("dateTo", dateTo);
    }

    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }, [dateFrom, dateTo]);
  const reportsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-reports", dateFrom, dateTo],
    queryFn: () => httpGet<TenantOperationalReportsResponse>(`/api/tenants/${tenantDomainSlug}/sms/reports/overview${reportsQueryString}`)
  });

  const distributionTotal = useMemo(
    () => (reportsQuery.data?.serviceStatusDistribution ?? []).reduce((total, row) => total + row.count, 0),
    [reportsQuery.data?.serviceStatusDistribution]
  );

  function handlePresetChange(nextPreset: ReportRangePreset) {
    if (nextPreset === "7d") {
      setDateTo(defaultDateTo);
      setDateFrom(defaultDateFrom);
      return;
    }

    if (nextPreset === "30d") {
      setDateTo(defaultDateTo);
      setDateFrom(shiftDate(defaultDateTo, -29));
    }
  }

  function handleExportCsv() {
    if (!reportsQuery.data) {
      return;
    }

    const generatedAt = new Date().toISOString();
    const rows = [
      ["Report", "Metric", "Value"],
      ["Window", "Date From", formatDateOnly(reportsQuery.data.reportingWindow.dateFromUtc)],
      ["Window", "Date To", formatDateOnly(reportsQuery.data.reportingWindow.dateToUtc)],
      ["Window", "Previous Date From", formatDateOnly(reportsQuery.data.reportingWindow.previousDateFromUtc)],
      ["Window", "Previous Date To", formatDateOnly(reportsQuery.data.reportingWindow.previousDateToUtc)],
      ["Totals", "Customers", String(reportsQuery.data.totals.customers)],
      ["Totals", "Service Requests", String(reportsQuery.data.totals.serviceRequests)],
      ["Totals", "Active Assignments", String(reportsQuery.data.totals.activeAssignments)],
      ["Totals", "Completed Assignments", String(reportsQuery.data.totals.completedAssignments)],
      ["Daily Activity", "New Customers Today", String(reportsQuery.data.dailyActivity.newCustomersToday)],
      ["Daily Activity", "New Requests Today", String(reportsQuery.data.dailyActivity.newRequestsToday)],
      ["Daily Activity", "Assignments Scheduled Today", String(reportsQuery.data.dailyActivity.assignmentsScheduledToday)],
      ["Daily Activity", "Assignments Completed Today", String(reportsQuery.data.dailyActivity.assignmentsCompletedToday)],
      ["Window Activity", "New Customers", String(reportsQuery.data.windowedActivity.newCustomers)],
      ["Window Activity", "New Requests", String(reportsQuery.data.windowedActivity.newRequests)],
      ["Window Activity", "Assignments Scheduled", String(reportsQuery.data.windowedActivity.assignmentsScheduled)],
      ["Window Activity", "Assignments Completed", String(reportsQuery.data.windowedActivity.assignmentsCompleted)],
      ["Window Activity", "Completed Requests", String(reportsQuery.data.windowedActivity.completedRequests)],
      ["Window Activity", "Invoices Finalized", String(reportsQuery.data.windowedActivity.invoicesFinalized)],
      ...reportsQuery.data.comparison.map((row) => ["Comparison", `${row.label} / Current`, String(row.currentValue)]),
      ...reportsQuery.data.comparison.map((row) => ["Comparison", `${row.label} / Previous`, String(row.previousValue)]),
      ...reportsQuery.data.comparison.map((row) => ["Comparison", `${row.label} / Delta`, String(row.deltaValue)]),
      ["Turnaround", "Completed Requests", String(reportsQuery.data.turnaround.completedRequests)],
      ["Turnaround", "Average Intake to Completion Hours", formatMetricHours(reportsQuery.data.turnaround.averageIntakeToCompletionHours)],
      ["Turnaround", "Average Request to Schedule Hours", formatMetricHours(reportsQuery.data.turnaround.averageRequestToScheduleHours)],
      ["Turnaround", "Average Scheduled Work Hours", formatMetricHours(reportsQuery.data.turnaround.averageScheduledWorkHours)],
      ["Turnaround", "Overdue Open Requests", String(reportsQuery.data.turnaround.overdueOpenRequests)],
      ...reportsQuery.data.serviceStatusDistribution.map((row) => ["Service Status Distribution", row.status, String(row.count)]),
      ...reportsQuery.data.technicianWorkload.map((row) => ["Technician Workload", `${row.fullName} / Active`, String(row.activeAssignments)]),
      ...reportsQuery.data.technicianWorkload.map((row) => ["Technician Workload", `${row.fullName} / Scheduled`, String(row.scheduledAssignments)]),
      ...reportsQuery.data.technicianWorkload.map((row) => ["Technician Workload", `${row.fullName} / Completed`, String(row.completedAssignments)]),
      ["Metadata", "Generated At UTC", generatedAt]
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll(`"`, `""`)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tenantDomainSlug}-sms-operational-reports.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrintReport() {
    if (!reportsQuery.data) {
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1080,height=900");
    if (!printWindow) {
      return;
    }

    const generatedAt = new Date().toLocaleString("en-PH");
    const statusRows = reportsQuery.data.serviceStatusDistribution
      .map((row) => `<tr><td>${escapeHtml(row.status)}</td><td>${row.count}</td></tr>`)
      .join("");
    const workloadRows = reportsQuery.data.technicianWorkload
      .map((row) => `<tr><td>${escapeHtml(row.fullName)}</td><td>${row.activeAssignments}</td><td>${row.scheduledAssignments}</td><td>${row.completedAssignments}</td></tr>`)
      .join("");
    const catalogRows = reportsQuery.data.catalog
      .map((row) => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.scope)}</td><td>${escapeHtml(row.freshness)}</td><td>${escapeHtml(row.owner)}</td></tr>`)
      .join("");
    const comparisonRows = reportsQuery.data.comparison
      .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${row.currentValue}</td><td>${row.previousValue}</td><td>${formatSignedValue(row.deltaValue)}${row.deltaPercentage === null ? "" : ` (${formatDeltaPercentage(row.deltaPercentage)})`}</td></tr>`)
      .join("");

    printWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${tenantDomainSlug} SMS Operational Reports</title>
    <style>
      body { font-family: "Segoe UI", system-ui, sans-serif; color: #161724; margin: 32px; }
      h1, h2 { margin: 0; }
      p { margin: 0; color: #556284; line-height: 1.6; }
      .sheet { display: grid; gap: 24px; }
      .header { display: grid; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid #d8dfef; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .metric { border: 1px solid #d8dfef; padding: 14px; }
      .metric strong { display: block; font-size: 24px; margin-top: 6px; }
      .section { display: grid; gap: 12px; }
      .section h2 { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d8dfef; padding: 10px 12px; text-align: left; font-size: 14px; }
      th { background: #f5f7fc; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; color: #556284; }
      @media print {
        body { margin: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <section class="header">
        <p>Tenant SMS Reports</p>
        <h1>${escapeHtml(tenantDomainSlug)} Operational Report Packet</h1>
        <p>Generated ${escapeHtml(generatedAt)} for ${escapeHtml(formatDateOnly(reportsQuery.data.reportingWindow.dateFromUtc))} to ${escapeHtml(formatDateOnly(reportsQuery.data.reportingWindow.dateToUtc))}. This export captures the current tenant service-management operational snapshot.</p>
      </section>

      <section class="grid">
        <div class="metric"><p>Customers</p><strong>${reportsQuery.data.totals.customers}</strong></div>
        <div class="metric"><p>Service Requests</p><strong>${reportsQuery.data.totals.serviceRequests}</strong></div>
        <div class="metric"><p>Active Assignments</p><strong>${reportsQuery.data.totals.activeAssignments}</strong></div>
        <div class="metric"><p>Completed Assignments</p><strong>${reportsQuery.data.totals.completedAssignments}</strong></div>
      </section>

      <section class="section">
        <h2>Selected Window Activity</h2>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>New Customers</td><td>${reportsQuery.data.windowedActivity.newCustomers}</td></tr>
            <tr><td>New Requests</td><td>${reportsQuery.data.windowedActivity.newRequests}</td></tr>
            <tr><td>Assignments Scheduled</td><td>${reportsQuery.data.windowedActivity.assignmentsScheduled}</td></tr>
            <tr><td>Assignments Completed</td><td>${reportsQuery.data.windowedActivity.assignmentsCompleted}</td></tr>
            <tr><td>Completed Requests</td><td>${reportsQuery.data.windowedActivity.completedRequests}</td></tr>
            <tr><td>Invoices Finalized</td><td>${reportsQuery.data.windowedActivity.invoicesFinalized}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Window Comparison</h2>
        <table>
          <thead><tr><th>Metric</th><th>Current</th><th>Previous</th><th>Delta</th></tr></thead>
          <tbody>${comparisonRows}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Turnaround Metrics</h2>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Completed Requests</td><td>${reportsQuery.data.turnaround.completedRequests}</td></tr>
            <tr><td>Average Intake to Completion</td><td>${escapeHtml(formatMetricHours(reportsQuery.data.turnaround.averageIntakeToCompletionHours))}</td></tr>
            <tr><td>Average Request to Schedule</td><td>${escapeHtml(formatMetricHours(reportsQuery.data.turnaround.averageRequestToScheduleHours))}</td></tr>
            <tr><td>Average Scheduled Work</td><td>${escapeHtml(formatMetricHours(reportsQuery.data.turnaround.averageScheduledWorkHours))}</td></tr>
            <tr><td>Overdue Open Requests</td><td>${reportsQuery.data.turnaround.overdueOpenRequests}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Daily Activity Summary</h2>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>New Customers Today</td><td>${reportsQuery.data.dailyActivity.newCustomersToday}</td></tr>
            <tr><td>New Requests Today</td><td>${reportsQuery.data.dailyActivity.newRequestsToday}</td></tr>
            <tr><td>Assignments Scheduled Today</td><td>${reportsQuery.data.dailyActivity.assignmentsScheduledToday}</td></tr>
            <tr><td>Assignments Completed Today</td><td>${reportsQuery.data.dailyActivity.assignmentsCompletedToday}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Service Status Distribution</h2>
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>${statusRows}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Technician Workload</h2>
        <table>
          <thead><tr><th>Staff Member</th><th>Active</th><th>Scheduled</th><th>Completed</th></tr></thead>
          <tbody>${workloadRows}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Operational Report Catalog</h2>
        <table>
          <thead><tr><th>Report</th><th>Scope</th><th>Freshness</th><th>Owner</th></tr></thead>
          <tbody>${catalogRows}</tbody>
        </table>
      </section>
    </div>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / SMS / Reports`}
        title="Operational reports"
        description="Review live operational summaries, compare date windows, and track turnaround efficiency from one tenant reporting workspace."
        recordCount={reportsQuery.data?.catalog.length ?? 0}
        singularLabel="report"
      >
        <RecordContentStack>
          {reportsQuery.isError ? (
            <WorkspaceNotice tone="error">Unable to load operational reports.</WorkspaceNotice>
          ) : null}

          <RecordScrollRegion>
            <WorkspaceScrollStack>
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Reporting window" title="Date range and comparison" />
                <WorkspaceToolbar className="flex flex-col items-start gap-4 lg:flex-row lg:flex-wrap lg:items-end">
                  <div className="flex flex-wrap gap-2">
                    <WorkspaceToggleGroup>
                      <WorkspaceToggleButton active={preset === "7d"} onClick={() => handlePresetChange("7d")}>
                        Last 7 days
                      </WorkspaceToggleButton>
                      <WorkspaceToggleButton active={preset === "30d"} onClick={() => handlePresetChange("30d")}>
                        Last 30 days
                      </WorkspaceToggleButton>
                      <WorkspaceToggleButton active={preset === "custom"}>
                        Custom
                      </WorkspaceToggleButton>
                    </WorkspaceToggleGroup>
                  </div>

                  <WorkspaceFilter label="Date from">
                    <WorkspaceInput
                      type="date"
                      value={dateFrom}
                      max={dateTo}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </WorkspaceFilter>

                  <WorkspaceFilter label="Date to">
                    <WorkspaceInput
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      max={defaultDateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </WorkspaceFilter>

                  <WorkspaceActionButton
                    onClick={() => {
                      setDateFrom(defaultDateFrom);
                      setDateTo(defaultDateTo);
                    }}
                  >
                    Reset window
                  </WorkspaceActionButton>
                </WorkspaceToolbar>

                <WorkspaceInlineNote>
                  {reportsQuery.data
                    ? `Current window: ${formatDateOnly(reportsQuery.data.reportingWindow.dateFromUtc)} to ${formatDateOnly(reportsQuery.data.reportingWindow.dateToUtc)}. Previous window: ${formatDateOnly(reportsQuery.data.reportingWindow.previousDateFromUtc)} to ${formatDateOnly(reportsQuery.data.reportingWindow.previousDateToUtc)}.`
                    : "Select a reporting window to compare current operational activity against the immediately preceding period."}
                </WorkspaceInlineNote>
              </WorkspacePanel>

              <WorkspaceMetricGrid className="2xl:grid-cols-4">
                <MetricCard
                  label="Customers"
                  value={reportsQuery.data?.totals.customers ?? 0}
                  description="Total tenant customer profiles currently active in the service register."
                />
                <MetricCard
                  label="Service requests"
                  value={reportsQuery.data?.totals.serviceRequests ?? 0}
                  description="Total intake volume recorded across the tenant service workflow."
                />
                <MetricCard
                  label="Active assignments"
                  value={reportsQuery.data?.totals.activeAssignments ?? 0}
                  description="Assignments currently scheduled, active, or temporarily on hold."
                />
                <MetricCard
                  label="Completed assignments"
                  value={reportsQuery.data?.totals.completedAssignments ?? 0}
                  description="Completed dispatch entries already pushed through the tenant workflow."
                />
              </WorkspaceMetricGrid>

              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Selected window" title="Operating movement" />

                  <WorkspaceMetricGrid className="xl:grid-cols-3">
                    <MetricCard
                      label="New customers"
                      value={reportsQuery.data?.windowedActivity.newCustomers ?? 0}
                      description="Customer profiles added inside the selected reporting window."
                    />
                    <MetricCard
                      label="New requests"
                      value={reportsQuery.data?.windowedActivity.newRequests ?? 0}
                      description="Service intake volume recorded in the selected period."
                    />
                    <MetricCard
                      label="Assignments scheduled"
                      value={reportsQuery.data?.windowedActivity.assignmentsScheduled ?? 0}
                      description="Dispatch schedules created in the active reporting window."
                    />
                    <MetricCard
                      label="Assignments completed"
                      value={reportsQuery.data?.windowedActivity.assignmentsCompleted ?? 0}
                      description="Assignments whose planned service window ended as completed in the selected period."
                    />
                    <MetricCard
                      label="Completed requests"
                      value={reportsQuery.data?.windowedActivity.completedRequests ?? 0}
                      description="Service requests closed inside the active comparison window."
                    />
                    <MetricCard
                      label="Invoices finalized"
                      value={reportsQuery.data?.windowedActivity.invoicesFinalized ?? 0}
                      description="Finance-ready service invoices finalized during the selected period."
                    />
                  </WorkspaceMetricGrid>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Turnaround" title="Completion efficiency" />

                  <WorkspaceMetricGrid className="xl:grid-cols-2">
                    <MetricCard
                      label="Completed requests"
                      value={reportsQuery.data?.turnaround.completedRequests ?? 0}
                      description="Requests completed within the selected reporting window."
                    />
                    <MetricCard
                      label="Overdue open requests"
                      value={reportsQuery.data?.turnaround.overdueOpenRequests ?? 0}
                      description="Requests still open after their requested service date."
                    />
                    <MetricCard
                      label="Intake to completion"
                      value={formatMetricHours(reportsQuery.data?.turnaround.averageIntakeToCompletionHours ?? null)}
                      description="Average elapsed time from intake creation until completion."
                    />
                    <MetricCard
                      label="Request to schedule"
                      value={formatMetricHours(reportsQuery.data?.turnaround.averageRequestToScheduleHours ?? null)}
                      description="Average lead time before work is first scheduled."
                    />
                    <MetricCard
                      label="Scheduled work"
                      value={formatMetricHours(reportsQuery.data?.turnaround.averageScheduledWorkHours ?? null)}
                      description="Average planned technician work duration for completed assignments."
                    />
                  </WorkspaceMetricGrid>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Window comparison" title="Current versus previous period" />

                  <WorkspaceSubtableShell>
                    <WorkspaceSubtable>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Current</th>
                          <th>Previous</th>
                          <th>Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsQuery.isLoading ? (
                          <RecordTableStateRow colSpan={4}>Loading comparison metrics...</RecordTableStateRow>
                        ) : null}

                        {!reportsQuery.isLoading && !reportsQuery.data?.comparison.length ? (
                          <RecordTableStateRow colSpan={4}>No comparison metrics are available yet.</RecordTableStateRow>
                        ) : null}

                        {reportsQuery.data?.comparison.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>{row.currentValue}</td>
                            <td>{row.previousValue}</td>
                            <td>
                              <div className="flex flex-wrap items-center gap-2">
                                <WorkspaceStatusPill tone={getDeltaTone(row.deltaValue)}>
                                  {formatSignedValue(row.deltaValue)}
                                </WorkspaceStatusPill>
                                <span className="text-sm text-base-content/65">
                                  {row.deltaPercentage === null ? "No baseline" : formatDeltaPercentage(row.deltaPercentage)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </WorkspaceSubtable>
                  </WorkspaceSubtableShell>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Daily activity" title="Today&apos;s operating movement" />

                  <dl className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-box border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">New customers</dt>
                      <dd className="mt-1 text-base-content">{reportsQuery.data?.dailyActivity.newCustomersToday ?? 0}</dd>
                    </div>
                    <div className="rounded-box border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">New requests</dt>
                      <dd className="mt-1 text-base-content">{reportsQuery.data?.dailyActivity.newRequestsToday ?? 0}</dd>
                    </div>
                    <div className="rounded-box border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Assignments scheduled</dt>
                      <dd className="mt-1 text-base-content">{reportsQuery.data?.dailyActivity.assignmentsScheduledToday ?? 0}</dd>
                    </div>
                    <div className="rounded-box border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Assignments completed</dt>
                      <dd className="mt-1 text-base-content">{reportsQuery.data?.dailyActivity.assignmentsCompletedToday ?? 0}</dd>
                    </div>
                  </dl>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Service distribution" title="Status mix" />

                  <div className="grid gap-4">
                    {reportsQuery.isLoading ? (
                      <WorkspaceEmptyState>
                        <WorkspaceInlineNote>Loading status distribution...</WorkspaceInlineNote>
                      </WorkspaceEmptyState>
                    ) : null}

                    {!reportsQuery.isLoading && !reportsQuery.data?.serviceStatusDistribution.length ? (
                      <WorkspaceEmptyState>
                        <WorkspaceInlineNote>No service status data available yet.</WorkspaceInlineNote>
                      </WorkspaceEmptyState>
                    ) : null}

                    {reportsQuery.data?.serviceStatusDistribution.map((row) => (
                      <WorkspaceDistributionRow
                        key={row.status}
                        label={row.status}
                        value={row.count}
                        percentage={distributionTotal ? (row.count / distributionTotal) * 100 : 0}
                      />
                    ))}
                  </div>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Workload" title="Technician assignment pressure" />

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
                        {reportsQuery.isLoading ? (
                          <RecordTableStateRow colSpan={4}>Loading workload...</RecordTableStateRow>
                        ) : null}

                        {!reportsQuery.isLoading && !reportsQuery.data?.technicianWorkload.length ? (
                          <RecordTableStateRow colSpan={4}>No technician workload is available yet.</RecordTableStateRow>
                        ) : null}

                        {reportsQuery.data?.technicianWorkload.map((row) => (
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

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Catalog" title="Operational report set" />

                  <WorkspaceSubtableShell>
                    <WorkspaceSubtable>
                      <thead>
                        <tr>
                          <th>Report</th>
                          <th>Scope</th>
                          <th>Freshness</th>
                          <th>Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsQuery.isLoading ? (
                          <RecordTableStateRow colSpan={4}>Loading report catalog...</RecordTableStateRow>
                        ) : null}

                        {reportsQuery.data?.catalog.map((row) => (
                          <tr key={row.key}>
                            <td>
                              <WorkspaceTenantCell title={row.title} subtitle={row.description} />
                            </td>
                            <td>{row.scope}</td>
                            <td>{row.freshness}</td>
                            <td>{row.owner}</td>
                          </tr>
                        ))}
                      </tbody>
                    </WorkspaceSubtable>
                  </WorkspaceSubtableShell>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Output formats" title="Export-ready layouts" />
                <WorkspaceNoteList
                  items={[
                    "Spreadsheet export now includes the active date window, comparison deltas, and turnaround metrics in the report packet.",
                    "Print export now generates a report packet with selected-window activity, prior-period comparison, and completion efficiency.",
                    "The next reporting depth should focus on technician productivity and SLA-style breach tracking if the tenant needs more operational control."
                  ]}
                />
              </WorkspacePanel>
            </WorkspaceScrollStack>
          </RecordScrollRegion>

          <WorkspaceFabDock
            actions={[
              {
                key: "refresh-reports",
                label: "Refresh reports",
                icon: "refresh",
                onClick: () => {
                  void reportsQuery.refetch();
                }
              },
              {
                key: "export-reports-csv",
                label: "Export reports as CSV",
                icon: "download",
                onClick: handleExportCsv,
                disabled: reportsQuery.isLoading || !reportsQuery.data
              },
              {
                key: "print-report-packet",
                label: "Print report packet",
                icon: "print",
                onClick: handlePrintReport,
                disabled: reportsQuery.isLoading || !reportsQuery.data
              }
            ]}
          />
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMetricHours(value: number | null) {
  return value === null ? "No data" : `${value.toFixed(1)} hrs`;
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function formatDeltaPercentage(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(`"`, "&quot;")
    .replaceAll("'", "&#39;");
}
