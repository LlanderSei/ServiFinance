import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { TenantOperationalReportsResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { WorkspaceBarChart, WorkspaceLineChart, WorkspacePieChart } from "@/shared/charts/WorkspaceCharts";
import { SmsModuleCodes, hasFullModuleAccess } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { MetricCard } from "@/shared/records/MetricCard";
import { MobileRecordField, MobileRecordFieldGrid, mobileRecordRailClass } from "@/shared/records/MobileRecordDetails";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceActionButton,
  WorkspaceField,
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
  WorkspaceKpiRailLayout,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceTenantCell,
  WorkspaceToolbar
} from "@/shared/records/WorkspacePanel";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

type ReportRangePreset = "7d" | "30d" | "custom";

type ActionReadiness = {
  allowed: boolean;
  reason: string | null;
};

const defaultDateTo = formatDateInput(new Date());
const defaultDateFrom = shiftDate(defaultDateTo, -6);

export function SmsReportsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const canUseFullReports = hasFullModuleAccess(currentUser, SmsModuleCodes.reports);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [isWindowOptionsOpen, setIsWindowOptionsOpen] = useState(false);
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
  const customWindowReadiness = getFullReportsReadiness(canUseFullReports, "Custom reporting windows");
  const exportReadiness = getReportOutputReadiness(
    canUseFullReports,
    reportsQuery.isLoading,
    Boolean(reportsQuery.data),
    "Exporting report packets"
  );
  const printReadiness = getReportOutputReadiness(
    canUseFullReports,
    reportsQuery.isLoading,
    Boolean(reportsQuery.data),
    "Printing report packets"
  );

  const distributionTotal = useMemo(
    () => (reportsQuery.data?.serviceStatusDistribution ?? []).reduce((total, row) => total + row.count, 0),
    [reportsQuery.data?.serviceStatusDistribution]
  );
  const windowActivityChart = reportsQuery.data
    ? [
      {
        name: "Selected window",
        newCustomers: reportsQuery.data.windowedActivity.newCustomers,
        newRequests: reportsQuery.data.windowedActivity.newRequests,
        scheduled: reportsQuery.data.windowedActivity.assignmentsScheduled,
        completedAssignments: reportsQuery.data.windowedActivity.assignmentsCompleted,
        completedRequests: reportsQuery.data.windowedActivity.completedRequests,
        invoices: reportsQuery.data.windowedActivity.invoicesFinalized
      }
    ]
    : [];
  const comparisonChart = (reportsQuery.data?.comparison ?? []).map((row) => ({
    name: row.label,
    current: row.currentValue,
    previous: row.previousValue
  }));
  const turnaroundHoursChart = reportsQuery.data
    ? [
      {
        name: "Intake to completion",
        hours: reportsQuery.data.turnaround.averageIntakeToCompletionHours ?? 0
      },
      {
        name: "Request to schedule",
        hours: reportsQuery.data.turnaround.averageRequestToScheduleHours ?? 0
      },
      {
        name: "Scheduled work",
        hours: reportsQuery.data.turnaround.averageScheduledWorkHours ?? 0
      }
    ]
    : [];
  const feedbackChart = reportsQuery.data
    ? [
      { name: "Rated", value: reportsQuery.data.feedbackSummary.ratedRequests },
      { name: "Pending", value: reportsQuery.data.feedbackSummary.pendingFeedback },
      { name: "Expired", value: reportsQuery.data.feedbackSummary.expiredFeedback },
      { name: "Low rating", value: reportsQuery.data.feedbackSummary.lowRatingCount }
    ]
    : [];
  const suggestionChart = (reportsQuery.data?.suggestionThemes ?? []).map((row) => ({
    name: row.category,
    value: row.count
  }));
  const statusChart = (reportsQuery.data?.serviceStatusDistribution ?? []).map((row) => ({
    name: row.status,
    value: row.count
  }));
  const workloadChart = (reportsQuery.data?.technicianWorkload ?? []).map((row) => ({
    name: row.fullName,
    active: row.activeAssignments,
    scheduled: row.scheduledAssignments,
    completed: row.completedAssignments
  }));
  const dailyActivityChart = reportsQuery.data
    ? [
      { name: "New customers", count: reportsQuery.data.dailyActivity.newCustomersToday },
      { name: "New requests", count: reportsQuery.data.dailyActivity.newRequestsToday },
      { name: "Scheduled", count: reportsQuery.data.dailyActivity.assignmentsScheduledToday },
      { name: "Completed", count: reportsQuery.data.dailyActivity.assignmentsCompletedToday }
    ]
    : [];

  function handlePresetChange(nextPreset: ReportRangePreset) {
    if (nextPreset === "custom" && !canUseFullReports) {
      toast.warning({
        title: "Full reports required",
        message: customWindowReadiness.reason ?? "Custom reporting windows require full Reports module access."
      });
      return;
    }

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
    if (!exportReadiness.allowed || !reportsQuery.data) {
      toast.warning({
        title: "Export unavailable",
        message: exportReadiness.reason ?? "Report export is not available right now."
      });
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
      ["Feedback", "Average Rating", formatRating(reportsQuery.data.feedbackSummary.averageRating)],
      ["Feedback", "Rated Requests", String(reportsQuery.data.feedbackSummary.ratedRequests)],
      ["Feedback", "Pending Feedback", String(reportsQuery.data.feedbackSummary.pendingFeedback)],
      ["Feedback", "Expired Feedback", String(reportsQuery.data.feedbackSummary.expiredFeedback)],
      ["Feedback", "Low Rating Count", String(reportsQuery.data.feedbackSummary.lowRatingCount)],
      ["Feedback", "Suggestions Count", String(reportsQuery.data.feedbackSummary.suggestionsCount)],
      ...reportsQuery.data.feedbackHighlights.map((row) => ["Feedback Highlight", `${row.requestNumber} / ${row.customerName}`, row.rating == null ? "Pending" : `${row.rating}/5`]),
      ...reportsQuery.data.feedbackHighlights.map((row) => ["Feedback Comment", `${row.requestNumber} / ${row.suggestionCategory ?? "No category"}`, row.feedbackComments ?? ""]),
      ...reportsQuery.data.suggestionThemes.map((row) => ["Suggestion Theme", `${row.category} / Count`, String(row.count)]),
      ...reportsQuery.data.suggestionThemes.map((row) => ["Suggestion Theme", `${row.category} / Average Rating`, formatRating(row.averageRating)]),
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
    if (!printReadiness.allowed || !reportsQuery.data) {
      toast.warning({
        title: "Print unavailable",
        message: printReadiness.reason ?? "Report printing is not available right now."
      });
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
    const feedbackRows = reportsQuery.data.feedbackHighlights
      .map((row) => `<tr><td>${escapeHtml(row.requestNumber)}</td><td>${escapeHtml(row.customerName)}</td><td>${row.rating == null ? "Pending" : `${row.rating}/5`}</td><td>${escapeHtml(row.suggestionCategory ?? "No category")}</td><td>${escapeHtml(row.feedbackComments ?? "")}</td></tr>`)
      .join("");
    const suggestionRows = reportsQuery.data.suggestionThemes
      .map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${row.count}</td><td>${escapeHtml(formatRating(row.averageRating))}</td></tr>`)
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
        <h2>Customer Feedback and CRM Signals</h2>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Average Rating</td><td>${escapeHtml(formatRating(reportsQuery.data.feedbackSummary.averageRating))}</td></tr>
            <tr><td>Rated Requests</td><td>${reportsQuery.data.feedbackSummary.ratedRequests}</td></tr>
            <tr><td>Pending Feedback</td><td>${reportsQuery.data.feedbackSummary.pendingFeedback}</td></tr>
            <tr><td>Expired Feedback</td><td>${reportsQuery.data.feedbackSummary.expiredFeedback}</td></tr>
            <tr><td>Low Rating Count</td><td>${reportsQuery.data.feedbackSummary.lowRatingCount}</td></tr>
            <tr><td>Suggestion Entries</td><td>${reportsQuery.data.feedbackSummary.suggestionsCount}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Feedback Highlights</h2>
        <table>
          <thead><tr><th>Request</th><th>Customer</th><th>Rating</th><th>Suggestion</th><th>Comment</th></tr></thead>
          <tbody>${feedbackRows || `<tr><td colspan="5">No feedback highlights in this window.</td></tr>`}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Suggestion Themes</h2>
        <table>
          <thead><tr><th>Category</th><th>Count</th><th>Average Rating</th></tr></thead>
          <tbody>${suggestionRows || `<tr><td colspan="3">No suggestion themes in this window.</td></tr>`}</tbody>
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

  function resetWindow() {
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
  }

  const reportingWindowControls = (
    <>
      <div className="grid shrink-0 gap-1.5">
        <span className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-base-content/60">Window</span>
        <WorkspaceToggleGroup className="whitespace-nowrap">
          <WorkspaceToggleButton active={preset === "7d"} onClick={() => handlePresetChange("7d")}>
            Last 7 days
          </WorkspaceToggleButton>
          <WorkspaceToggleButton active={preset === "30d"} onClick={() => handlePresetChange("30d")}>
            Last 30 days
          </WorkspaceToggleButton>
          <WorkspaceToggleButton
            active={preset === "custom"}
            onClick={() => handlePresetChange("custom")}
            disabled={!customWindowReadiness.allowed}
            title={customWindowReadiness.reason ?? undefined}
          >
            Custom
          </WorkspaceToggleButton>
        </WorkspaceToggleGroup>
      </div>

      <div className="w-full shrink-0 lg:w-40">
        <WorkspaceField label="Date from">
          <WorkspaceInput
            type="date"
            value={dateFrom}
            max={dateTo}
            disabled={!customWindowReadiness.allowed}
            title={customWindowReadiness.reason ?? undefined}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </WorkspaceField>
      </div>

      <div className="w-full shrink-0 lg:w-40">
        <WorkspaceField label="Date to">
          <WorkspaceInput
            type="date"
            value={dateTo}
            min={dateFrom}
            max={defaultDateTo}
            disabled={!customWindowReadiness.allowed}
            title={customWindowReadiness.reason ?? undefined}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </WorkspaceField>
      </div>
    </>
  );

  const reportingWindowNote = !canUseFullReports
    ? "Limited reports can review the standard 7-day and 30-day windows. Custom date windows and exports require full Reports access."
    : reportsQuery.data
    ? `Current window: ${formatDateOnly(reportsQuery.data.reportingWindow.dateFromUtc)} to ${formatDateOnly(reportsQuery.data.reportingWindow.dateToUtc)}. Previous window: ${formatDateOnly(reportsQuery.data.reportingWindow.previousDateFromUtc)} to ${formatDateOnly(reportsQuery.data.reportingWindow.previousDateToUtc)}.`
    : "Select a reporting window to compare current operational activity against the immediately preceding period.";

  return (
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

        <WorkspaceKpiRailLayout
          contentClassName="min-h-0"
          kpis={(
            <>
              <MetricCard
                label="Customers"
                value={reportsQuery.data?.totals.customers ?? 0}
                description="Tenant customer profiles available for intake and dispatch."
              />
              <MetricCard
                label="Service requests"
                value={reportsQuery.data?.totals.serviceRequests ?? 0}
                description="Total service intake records currently tracked in this workspace."
              />
              <MetricCard
                label="Active assignments"
                value={reportsQuery.data?.totals.activeAssignments ?? 0}
                description="Scheduled, in-progress, or on-hold dispatch work still open."
              />
              <MetricCard
                label="Completed assignments"
                value={reportsQuery.data?.totals.completedAssignments ?? 0}
                description="Assignments already completed across the tenant service register."
              />
              <MetricCard
                label="Average rating"
                value={formatRating(reportsQuery.data?.feedbackSummary.averageRating ?? null)}
                description="Customer rating average for submitted feedback in this reporting window."
              />
              <MetricCard
                label="Pending feedback"
                value={reportsQuery.data?.feedbackSummary.pendingFeedback ?? 0}
                description="Completed services still inside the 7-day customer feedback window."
              />
              <MetricCard
                label="Low ratings"
                value={reportsQuery.data?.feedbackSummary.lowRatingCount ?? 0}
                description="Submitted feedback at 2 stars or below for customer-care follow-up."
              />
              <MetricCard
                label="Suggestions"
                value={reportsQuery.data?.feedbackSummary.suggestionsCount ?? 0}
                description="Categorized customer suggestions submitted in the selected window."
              />
            </>
          )}
        >
          <WorkspacePanel className="shrink-0">
            <WorkspacePanelHeader
              eyebrow="Reporting window"
              title="Compare operating periods"
              actions={(
                <>
                  <WorkspaceActionButton className="lg:hidden" onClick={() => setIsWindowOptionsOpen(true)}>
                    Options
                  </WorkspaceActionButton>
                  <WorkspaceActionButton onClick={resetWindow}>
                    Reset window
                  </WorkspaceActionButton>
                </>
              )}
            />

            <WorkspaceToolbar className="hidden flex-nowrap overflow-x-auto pb-1 lg:flex">
              {reportingWindowControls}
            </WorkspaceToolbar>

            <WorkspaceInlineNote className="hidden leading-6 lg:block">
              {reportingWindowNote}
            </WorkspaceInlineNote>
          </WorkspacePanel>

          <WorkspaceScrollStack className="overflow-visible pb-0">
              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Selected window" title="Operating movement" />

                  <WorkspaceBarChart
                    data={windowActivityChart}
                    series={[
                      { key: "newCustomers", name: "New customers" },
                      { key: "newRequests", name: "New requests" },
                      { key: "scheduled", name: "Scheduled" },
                      { key: "completedAssignments", name: "Assignments completed" },
                      { key: "completedRequests", name: "Requests completed" },
                      { key: "invoices", name: "Invoices" }
                    ]}
                    emptyMessage="No selected-window movement can be charted yet."
                  />

                  <WorkspaceMetricGrid className="2xl:!grid-cols-3">
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

                  <WorkspaceLineChart
                    data={turnaroundHoursChart}
                    height={240}
                    series={[{ key: "hours", name: "Average hours" }]}
                    valueFormatter={(value) => formatMetricHours(value)}
                    emptyMessage="No turnaround timing can be charted yet."
                  />

                  <WorkspaceMetricGrid className="2xl:!grid-cols-3">
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
                  <WorkspacePanelHeader eyebrow="Customer feedback" title="Ratings and CRM signals" />

                  <WorkspacePieChart data={feedbackChart} height={240} emptyMessage="No customer feedback mix can be charted yet." />

                  <WorkspaceMetricGrid className="2xl:!grid-cols-3">
                    <MetricCard
                      label="Average rating"
                      value={formatRating(reportsQuery.data?.feedbackSummary.averageRating ?? null)}
                      description="Average score from feedback submitted inside the selected window."
                    />
                    <MetricCard
                      label="Rated requests"
                      value={reportsQuery.data?.feedbackSummary.ratedRequests ?? 0}
                      description="Completed services with customer ratings in this period."
                    />
                    <MetricCard
                      label="Pending feedback"
                      value={reportsQuery.data?.feedbackSummary.pendingFeedback ?? 0}
                      description="Completed jobs still inside the 7-day review window."
                    />
                    <MetricCard
                      label="Expired feedback"
                      value={reportsQuery.data?.feedbackSummary.expiredFeedback ?? 0}
                      description="Completed jobs where the customer feedback window closed."
                    />
                    <MetricCard
                      label="Low ratings"
                      value={reportsQuery.data?.feedbackSummary.lowRatingCount ?? 0}
                      description="Ratings at 2 stars or lower that should trigger follow-up."
                    />
                    <MetricCard
                      label="Suggestions"
                      value={reportsQuery.data?.feedbackSummary.suggestionsCount ?? 0}
                      description="Categorized suggestions tied to submitted feedback."
                    />
                  </WorkspaceMetricGrid>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Suggestion themes" title="What customers mention" />

                  <WorkspacePieChart data={suggestionChart} height={230} emptyMessage="No suggestion theme chart can be shown yet." />

                  <div className="grid gap-4">
                    {reportsQuery.isLoading ? (
                      <WorkspaceEmptyState>
                        <WorkspaceInlineNote>Loading suggestion themes...</WorkspaceInlineNote>
                      </WorkspaceEmptyState>
                    ) : null}

                    {!reportsQuery.isLoading && !reportsQuery.data?.suggestionThemes.length ? (
                      <WorkspaceEmptyState>
                        <WorkspaceInlineNote>No categorized suggestions are available for this window.</WorkspaceInlineNote>
                      </WorkspaceEmptyState>
                    ) : null}

                    {reportsQuery.data?.suggestionThemes.map((row) => (
                      <WorkspaceDistributionRow
                        key={row.category}
                        label={`${row.category} (${formatRating(row.averageRating)} avg)`}
                        value={row.count}
                        percentage={reportsQuery.data.feedbackSummary.suggestionsCount ? (row.count / reportsQuery.data.feedbackSummary.suggestionsCount) * 100 : 0}
                      />
                    ))}
                  </div>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid singleColumn>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Feedback highlights" title="Services linked to ratings and comments" />

                  <RecordTableShell className="max-h-80 flex-none">
                    <RecordTable className={mobileRecordRailClass(reportsQuery.data?.comparison.length ?? 0)}>
                      <thead>
                        <tr>
                          <th>Request</th>
                          <th>Customer</th>
                          <th>Rating</th>
                          <th>Suggestion</th>
                          <th>Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsQuery.isLoading ? (
                          <RecordTableStateRow colSpan={5}>Loading feedback highlights...</RecordTableStateRow>
                        ) : null}

                        {!reportsQuery.isLoading && !reportsQuery.data?.feedbackHighlights.length ? (
                          <RecordTableStateRow colSpan={5}>No customer feedback highlights are available for this window.</RecordTableStateRow>
                        ) : null}

                        {reportsQuery.data?.feedbackHighlights.map((row) => (
                          <tr key={row.serviceRequestId}>
                            <td>{row.requestNumber}</td>
                            <td>{row.customerName}</td>
                            <td>
                              <WorkspaceStatusPill tone={row.rating != null && row.rating <= 2 ? "warning" : "active"}>
                                {row.rating == null ? "Pending" : `${row.rating}/5`}
                              </WorkspaceStatusPill>
                            </td>
                            <td>{row.suggestionCategory ?? "No category"}</td>
                            <td>{row.feedbackComments ?? "Rating only"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid singleColumn>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Window comparison" title="Current versus previous period" />

                  <WorkspaceBarChart
                    data={comparisonChart}
                    height={280}
                    series={[
                      { key: "current", name: "Current" },
                      { key: "previous", name: "Previous" }
                    ]}
                    emptyMessage="No current-versus-previous comparison can be charted yet."
                  />

                  <RecordTableShell className="max-h-80 flex-none">
                    <RecordTable>
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
                            <td>
                              <MobileRecordFieldGrid className="lg:hidden">
                                <strong className="block text-sm text-base-content">{row.label}</strong>
                                <MobileRecordField label="Current" value={row.currentValue} />
                                <MobileRecordField label="Previous" value={row.previousValue} />
                                <MobileRecordField
                                  label="Delta"
                                  value={
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                      <WorkspaceStatusPill tone={getDeltaTone(row.deltaValue)}>
                                        {formatSignedValue(row.deltaValue)}
                                      </WorkspaceStatusPill>
                                      <span className="text-base-content/65">
                                        {row.deltaPercentage === null ? "No baseline" : formatDeltaPercentage(row.deltaPercentage)}
                                      </span>
                                    </span>
                                  }
                                />
                              </MobileRecordFieldGrid>
                              <span className="hidden lg:inline">{row.label}</span>
                            </td>
                            <td className="max-lg:hidden">{row.currentValue}</td>
                            <td className="max-lg:hidden">{row.previousValue}</td>
                            <td className="max-lg:hidden">
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
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Daily activity" title="Today's operating movement" />

                  <WorkspaceBarChart
                    data={dailyActivityChart}
                    height={220}
                    series={[{ key: "count", name: "Count" }]}
                    emptyMessage="No daily movement can be charted yet."
                  />

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

                  <WorkspacePieChart data={statusChart} height={230} emptyMessage="No service status mix can be charted yet." />

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

                  <WorkspaceBarChart
                    data={workloadChart}
                    height={260}
                    series={[
                      { key: "active", name: "Active" },
                      { key: "scheduled", name: "Scheduled" },
                      { key: "completed", name: "Completed" }
                    ]}
                    emptyMessage="No technician assignment pressure can be charted yet."
                  />

                  <RecordTableShell className="max-h-80 flex-none">
                    <RecordTable className={mobileRecordRailClass(reportsQuery.data?.technicianWorkload.length ?? 0)}>
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
                            <td>
                              <MobileRecordFieldGrid className="lg:hidden">
                                <strong className="block text-sm text-base-content">{row.fullName}</strong>
                                <MobileRecordField label="Active" value={row.activeAssignments} />
                                <MobileRecordField label="Scheduled" value={row.scheduledAssignments} />
                                <MobileRecordField label="Completed" value={row.completedAssignments} />
                              </MobileRecordFieldGrid>
                              <span className="hidden lg:inline">{row.fullName}</span>
                            </td>
                            <td className="max-lg:hidden">{row.activeAssignments}</td>
                            <td className="max-lg:hidden">{row.scheduledAssignments}</td>
                            <td className="max-lg:hidden">{row.completedAssignments}</td>
                          </tr>
                        ))}
                      </tbody>
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Catalog" title="Operational report set" />

                  <RecordTableShell className="max-h-80 flex-none">
                    <RecordTable>
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
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>
              </WorkspacePanelGrid>

              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Output formats" title="Export-ready layouts" />
                <WorkspaceNoteList
                  items={[
                    "Spreadsheet export includes the active date window, comparison deltas, and turnaround metrics in the report packet.",
                    "Print export generates a report packet with selected-window activity, prior-period comparison, and completion efficiency.",
                    "The next reporting depth should focus on technician productivity and SLA-style breach tracking if the tenant needs more operational control."
                  ]}
                />
              </WorkspacePanel>
          </WorkspaceScrollStack>
        </WorkspaceKpiRailLayout>

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
              disabled: !exportReadiness.allowed,
              disabledReason: exportReadiness.reason ?? undefined
            },
            {
              key: "print-report-packet",
              label: "Print report packet",
              icon: "print",
              onClick: handlePrintReport,
              disabled: !printReadiness.allowed,
              disabledReason: printReadiness.reason ?? undefined
            }
          ]}
        />
      </RecordContentStack>

      {isWindowOptionsOpen ? (
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Reporting window options"
          onClick={() => setIsWindowOptionsOpen(false)}
        >
          <section
            className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-base-300/70 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Reporting window</p>
                <h2 className="mt-1 text-lg font-bold text-base-content">Compare periods</h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-sm border-base-300/70 bg-base-100 shadow-none"
                onClick={() => setIsWindowOptionsOpen(false)}
                aria-label="Close reporting window options"
              >
                x
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="grid gap-4">
                {reportingWindowControls}
                <WorkspaceInlineNote className="block leading-6">
                  {reportingWindowNote}
                </WorkspaceInlineNote>
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-base-300/70 bg-base-200/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <WorkspaceActionButton onClick={resetWindow}>
                Reset window
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => setIsWindowOptionsOpen(false)}>
                Apply
              </WorkspaceActionButton>
            </footer>
          </section>
        </div>
      ) : null}
    </RecordWorkspace>
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

function formatRating(value: number | null) {
  return value === null ? "No data" : `${value.toFixed(1)}/5`;
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function getFullReportsReadiness(canUseFullReports: boolean, actionLabel: string): ActionReadiness {
  if (!canUseFullReports) {
    return {
      allowed: false,
      reason: `${actionLabel} require full Reports module access.`
    };
  }

  return { allowed: true, reason: null };
}

function getReportOutputReadiness(
  canUseFullReports: boolean,
  isLoading: boolean,
  hasData: boolean,
  actionLabel: string
): ActionReadiness {
  if (!canUseFullReports) {
    return {
      allowed: false,
      reason: `${actionLabel} require full Reports module access.`
    };
  }

  if (isLoading) {
    return {
      allowed: false,
      reason: "Wait for the report data to finish loading."
    };
  }

  if (!hasData) {
    return {
      allowed: false,
      reason: "No report data is available to output."
    };
  }

  return { allowed: true, reason: null };
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
