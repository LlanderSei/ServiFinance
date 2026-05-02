import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TenantMlsReportsWorkspaceResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceInput,
  WorkspaceNotice,
  WorkspaceSelect
} from "@/shared/records/WorkspaceControls";

type ReportRangePreset = "7d" | "30d" | "90d" | "365d" | "custom";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

const defaultDateTo = formatDateInput(new Date());
const defaultDateFrom = buildPresetDateFrom(defaultDateTo, "30d");

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function buildReportsQueryString(dateFrom: string, dateTo: string) {
  const searchParams = new URLSearchParams();
  if (dateFrom) {
    searchParams.set("dateFrom", dateFrom);
  }
  if (dateTo) {
    searchParams.set("dateTo", dateTo);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function MlsReportsPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [preset, setPreset] = useState<ReportRangePreset>("30d");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const isWindowInvalid = dateFrom > dateTo;

  const reportsQueryString = useMemo(() => buildReportsQueryString(dateFrom, dateTo), [dateFrom, dateTo]);
  const reportsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-reports", dateFrom, dateTo],
    queryFn: () => httpGet<TenantMlsReportsWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/reports${reportsQueryString}`),
    enabled: Boolean(tenantDomainSlug) && Boolean(dateFrom) && Boolean(dateTo) && !isWindowInvalid
  });

  function handlePresetChange(nextPreset: ReportRangePreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") {
      return;
    }

    setDateTo(defaultDateTo);
    setDateFrom(buildPresetDateFrom(defaultDateTo, nextPreset));
  }

  function handleResetToThirtyDays() {
    setPreset("30d");
    setDateTo(defaultDateTo);
    setDateFrom(defaultDateFrom);
  }

  function handleExportCsv() {
    if (!reportsQuery.data) {
      return;
    }

    const report = reportsQuery.data;
    const generatedAtUtc = new Date().toISOString();
    const rows = [
      ["Section", "Metric", "Value"],
      ["Window", "Date From", formatDateOnly(report.window.dateFromUtc)],
      ["Window", "Date To", formatDateOnly(report.window.dateToUtc)],
      ["Window", "Range Days", String(report.window.rangeDays)],
      ["Summary", "Active Loans", String(report.summary.activeLoans)],
      ["Summary", "Portfolio Outstanding", formatCurrency(report.summary.outstandingPortfolioBalance)],
      ["Summary", "Net Collections in Window", formatCurrency(report.summary.collectionsInWindow)],
      ["Summary", "Payment Count in Window", String(report.summary.paymentCountInWindow)],
      ["Summary", "Disbursed in Window", formatCurrency(report.summary.loanDisbursedInWindow)],
      ["Summary", "Overdue Balance", formatCurrency(report.summary.overdueBalance)],
      ...report.agingBuckets.map((bucket) => ["Aging Buckets", `${bucket.label} / Loans`, String(bucket.loanCount)]),
      ...report.agingBuckets.map((bucket) => ["Aging Buckets", `${bucket.label} / Installments`, String(bucket.installmentCount)]),
      ...report.agingBuckets.map((bucket) => ["Aging Buckets", `${bucket.label} / Outstanding`, formatCurrency(bucket.outstandingAmount)]),
      ...report.transactionMix.map((row) => ["Transaction Mix", `${row.transactionType} / Count`, String(row.count)]),
      ...report.transactionMix.map((row) => ["Transaction Mix", `${row.transactionType} / Total Amount`, formatCurrency(row.totalAmount)]),
      ...report.collectionTrend.map((row) => ["Collection Trend", `${row.periodLabel} / Payments`, String(row.paymentCount)]),
      ...report.collectionTrend.map((row) => ["Collection Trend", `${row.periodLabel} / Collected`, formatCurrency(row.collectedAmount)]),
      ...report.topBorrowers.map((borrower) => ["Top Borrowers", `${borrower.customerName} / Active Loans`, String(borrower.activeLoanCount)]),
      ...report.topBorrowers.map((borrower) => ["Top Borrowers", `${borrower.customerName} / Outstanding`, formatCurrency(borrower.outstandingBalance)]),
      ...report.topBorrowers.map((borrower) => ["Top Borrowers", `${borrower.customerName} / Next Due`, borrower.nextDueDate ?? "No pending due date"]),
      ["Metadata", "Generated At UTC", generatedAtUtc]
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll(`"`, `""`)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildReportFileName(tenantDomainSlug, report, "csv");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrintPacket() {
    if (!reportsQuery.data) {
      return;
    }

    const report = reportsQuery.data;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1120,height=920");
    if (!printWindow) {
      return;
    }

    const generatedAt = new Date().toLocaleString("en-PH");
    const agingRows = report.agingBuckets
      .map((bucket) => `<tr><td>${escapeHtml(bucket.label)}</td><td>${bucket.loanCount}</td><td>${bucket.installmentCount}</td><td>${escapeHtml(formatCurrency(bucket.outstandingAmount))}</td></tr>`)
      .join("");
    const transactionRows = report.transactionMix
      .map((row) => `<tr><td>${escapeHtml(row.transactionType)}</td><td>${row.count}</td><td>${escapeHtml(formatCurrency(row.totalAmount))}</td></tr>`)
      .join("");
    const trendRows = report.collectionTrend
      .map((row) => `<tr><td>${escapeHtml(row.periodLabel)}</td><td>${row.paymentCount}</td><td>${escapeHtml(formatCurrency(row.collectedAmount))}</td></tr>`)
      .join("");
    const borrowerRows = report.topBorrowers
      .map((borrower) => `<tr><td>${escapeHtml(borrower.customerName)}</td><td>${borrower.activeLoanCount}</td><td>${escapeHtml(formatCurrency(borrower.outstandingBalance))}</td><td>${escapeHtml(borrower.nextDueDate ?? "No pending due date")}</td></tr>`)
      .join("");
    printWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(tenantDomainSlug)} MLS Finance Report</title>
    <style>
      body { font-family: "Segoe UI", system-ui, sans-serif; color: #182033; margin: 30px; }
      h1, h2 { margin: 0; }
      p { margin: 0; color: #51607d; line-height: 1.6; }
      .sheet { display: grid; gap: 24px; }
      .header { display: grid; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid #d8dfef; }
      .metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
      .metric { border: 1px solid #d8dfef; padding: 14px; }
      .metric strong { display: block; margin-top: 8px; font-size: 20px; }
      .section { display: grid; gap: 12px; }
      .section h2 { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d8dfef; padding: 10px 12px; text-align: left; font-size: 14px; vertical-align: top; }
      th { background: #f5f7fc; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; color: #51607d; }
      @media print {
        body { margin: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <section class="header">
        <p>Tenant MLS Reports</p>
        <h1>${escapeHtml(tenantDomainSlug)} Finance Report Packet</h1>
        <p>Generated ${escapeHtml(generatedAt)} for ${escapeHtml(formatDateOnly(report.window.dateFromUtc))} to ${escapeHtml(formatDateOnly(report.window.dateToUtc))}. This packet captures the current MLS finance reporting snapshot for the selected desktop workspace window.</p>
      </section>

      <section class="metrics">
        <div class="metric"><p>Active Loans</p><strong>${report.summary.activeLoans}</strong></div>
        <div class="metric"><p>Portfolio Outstanding</p><strong>${escapeHtml(formatCurrency(report.summary.outstandingPortfolioBalance))}</strong></div>
        <div class="metric"><p>Net Collections in Window</p><strong>${escapeHtml(formatCurrency(report.summary.collectionsInWindow))}</strong></div>
        <div class="metric"><p>Disbursed in Window</p><strong>${escapeHtml(formatCurrency(report.summary.loanDisbursedInWindow))}</strong></div>
        <div class="metric"><p>Overdue Balance</p><strong>${escapeHtml(formatCurrency(report.summary.overdueBalance))}</strong></div>
      </section>

      <section class="section">
        <h2>Overdue Bucket Mix</h2>
        <table>
          <thead><tr><th>Bucket</th><th>Loans</th><th>Installments</th><th>Outstanding</th></tr></thead>
          <tbody>${renderPrintRows(agingRows, 4, "No aging data is available for the selected MLS report window.")}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Transaction Composition</h2>
        <table>
          <thead><tr><th>Type</th><th>Count</th><th>Total Amount</th></tr></thead>
          <tbody>${renderPrintRows(transactionRows, 3, "No MLS transactions were posted during the selected reporting range.")}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Collection Trend</h2>
        <table>
          <thead><tr><th>Period</th><th>Payments</th><th>Collected</th></tr></thead>
          <tbody>${renderPrintRows(trendRows, 3, "No loan payment or correction activity was posted in the selected reporting range.")}</tbody>
        </table>
      </section>

      <section class="section">
        <h2>Top Borrower Balances</h2>
        <table>
          <thead><tr><th>Borrower</th><th>Active Loans</th><th>Outstanding</th><th>Next Due</th></tr></thead>
          <tbody>${renderPrintRows(borrowerRows, 4, "No active borrower exposure is available yet.")}</tbody>
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
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Reports`}
        title="Finance reports"
        description="Review collections, corrections, disbursement, portfolio exposure, overdue aging, and export-ready MLS finance snapshots from one desktop reporting workspace."
      >
        <WorkspaceScrollStack>
          {isWindowInvalid ? (
            <WorkspaceNotice tone="error">
              Report end date must be on or after the start date.
            </WorkspaceNotice>
          ) : null}
          {reportsQuery.isLoading ? <WorkspaceNotice>Loading MLS finance reports...</WorkspaceNotice> : null}
          {reportsQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(reportsQuery.error, "Unable to load MLS finance reports right now.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid>
            <MetricCard label="Active loans" value={String(reportsQuery.data?.summary.activeLoans ?? 0)} description="Current loan accounts still carrying unpaid balances." />
            <MetricCard label="Portfolio outstanding" value={formatCurrency(reportsQuery.data?.summary.outstandingPortfolioBalance ?? 0)} description="Remaining repayable balance across the active MLS loan portfolio." />
            <MetricCard label="Net collections in window" value={formatCurrency(reportsQuery.data?.summary.collectionsInWindow ?? 0)} description="Loan payments minus posted reversals during the selected reporting range." />
            <MetricCard label="Disbursed in window" value={formatCurrency(reportsQuery.data?.summary.loanDisbursedInWindow ?? 0)} description="Loan principal released through invoice and standalone onboarding in the selected range." />
            <MetricCard label="Overdue balance" value={formatCurrency(reportsQuery.data?.summary.overdueBalance ?? 0)} description="Current unpaid installment value already past due across the tenant portfolio." />
          </WorkspaceMetricGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader
              eyebrow="Filters"
              title="Reporting window"
              actions={(
                <>
                  <WorkspaceActionButton onClick={handleResetToThirtyDays}>
                    Reset to 30 days
                  </WorkspaceActionButton>
                  <WorkspaceActionButton onClick={handleExportCsv} disabled={!reportsQuery.data || isWindowInvalid}>
                    Export CSV
                  </WorkspaceActionButton>
                  <WorkspaceActionButton onClick={handlePrintPacket} disabled={!reportsQuery.data || isWindowInvalid}>
                    Print packet
                  </WorkspaceActionButton>
                </>
              )}
            />

            <WorkspaceFieldGrid>
              <WorkspaceField label="Range preset">
                <WorkspaceSelect value={preset} onChange={(event) => handlePresetChange(event.target.value as ReportRangePreset)}>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="365d">Last 365 days</option>
                  <option value="custom">Custom range</option>
                </WorkspaceSelect>
              </WorkspaceField>
              <WorkspaceField label="Date from">
                <WorkspaceInput
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setPreset("custom");
                    setDateFrom(event.target.value);
                  }}
                />
              </WorkspaceField>
              <WorkspaceField label="Date to">
                <WorkspaceInput
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setPreset("custom");
                    setDateTo(event.target.value);
                  }}
                />
              </WorkspaceField>
              <WorkspaceField label="Loaded window">
                <WorkspaceInput
                  readOnly
                  value={reportsQuery.data
                    ? `${formatDateOnly(reportsQuery.data.window.dateFromUtc)} to ${formatDateOnly(reportsQuery.data.window.dateToUtc)}`
                    : "Waiting for report window"}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspacePanel>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Aging" title="Overdue bucket mix" />

              {reportsQuery.data?.agingBuckets.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Bucket</th>
                        <th>Loans</th>
                        <th>Installments</th>
                        <th>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data.agingBuckets.map((bucket) => (
                        <tr key={bucket.label}>
                          <td>{bucket.label}</td>
                          <td>{bucket.loanCount}</td>
                          <td>{bucket.installmentCount}</td>
                          <td>{formatCurrency(bucket.outstandingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>No aging data is available for the selected MLS report window.</WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Mix" title="Transaction composition" />

              {reportsQuery.data?.transactionMix.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Count</th>
                        <th>Total amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data.transactionMix.map((row) => (
                        <tr key={row.transactionType}>
                          <td>{row.transactionType}</td>
                          <td>{row.count}</td>
                          <td>{formatCurrency(row.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>No MLS transactions were posted during the selected reporting range.</WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Collections" title="Collection trend" />

              {reportsQuery.data?.collectionTrend.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Payments</th>
                        <th>Collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data.collectionTrend.map((row) => (
                        <tr key={row.periodLabel}>
                          <td>{row.periodLabel}</td>
                          <td>{row.paymentCount}</td>
                          <td>{formatCurrency(row.collectedAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>No loan payment or correction activity was posted in the selected reporting range.</WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Exposure" title="Top borrower balances" />

              {reportsQuery.data?.topBorrowers.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Borrower</th>
                        <th>Active loans</th>
                        <th>Outstanding</th>
                        <th>Next due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data.topBorrowers.map((borrower) => (
                        <tr key={borrower.customerId}>
                          <td>{borrower.customerName}</td>
                          <td>{borrower.activeLoanCount}</td>
                          <td>{formatCurrency(borrower.outstandingBalance)}</td>
                          <td>{borrower.nextDueDate ?? "No pending due date"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>No active borrower exposure is available yet.</WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

function buildPresetDateFrom(dateTo: string, preset: Exclude<ReportRangePreset, "custom">) {
  switch (preset) {
    case "7d":
      return shiftDate(dateTo, -6);
    case "30d":
      return shiftDate(dateTo, -29);
    case "90d":
      return shiftDate(dateTo, -89);
    case "365d":
      return shiftDate(dateTo, -364);
  }

  return shiftDate(dateTo, -29);
}

function buildReportFileName(
  tenantDomainSlug: string,
  report: TenantMlsReportsWorkspaceResponse,
  extension: "csv" | "html"
) {
  return `${tenantDomainSlug}-mls-finance-report-${formatDateOnly(report.window.dateFromUtc)}-to-${formatDateOnly(report.window.dateToUtc)}.${extension}`;
}

function renderPrintRows(rows: string, columnCount: number, emptyMessage: string) {
  if (rows) {
    return rows;
  }

  return `<tr><td colspan="${columnCount}">${escapeHtml(emptyMessage)}</td></tr>`;
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function formatDateOnly(value: string) {
  return value.slice(0, 10);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(`"`, "&quot;")
    .replaceAll("'", "&#39;");
}
