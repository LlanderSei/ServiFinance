import { useQuery } from "@tanstack/react-query";
import type { TenantMlsPortfolioRiskResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No pending due date";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function getRiskTone(state: string) {
  switch (state) {
    case "Severe":
    case "High":
      return "inactive" as const;
    case "Watch":
      return "warning" as const;
    case "Current":
      return "active" as const;
    default:
      return "neutral" as const;
  }
}

export function MlsPortfolioRiskPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const riskQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-portfolio-risk"],
    queryFn: () => httpGet<TenantMlsPortfolioRiskResponse>(`/api/tenants/${tenantDomainSlug}/mls/portfolio-risk`),
    enabled: Boolean(tenantDomainSlug)
  });
  const summary = riskQuery.data?.summary;
  const rows = riskQuery.data?.rows ?? [];

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.portfolio-risk.view"
      requireModule={MlsModuleCodes.portfolioRiskDashboard}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Risk`}
        title="Portfolio risk"
        description="Review overdue exposure, portfolio-at-risk rate, due-this-week balance, and aging buckets for Medium Premium lending control."
        recordCount={summary?.overdueLoans ?? 0}
        singularLabel="overdue loan"
      >
        <RecordContentStack className="overflow-hidden">
          {riskQuery.isLoading ? <WorkspaceNotice>Loading portfolio risk controls...</WorkspaceNotice> : null}
          {riskQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(riskQuery.error, "Unable to load portfolio risk controls right now.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceKpiRailLayout
            contentClassName="overflow-hidden"
            kpis={(
              <>
                <MetricCard label="Active loans" value={summary?.activeLoans ?? 0} description="Loan accounts that still have active finance exposure." />
                <MetricCard label="Portfolio balance" value={formatCurrency(summary?.portfolioBalance ?? 0)} description="Current outstanding exposure across active loans." />
                <MetricCard label="Overdue balance" value={formatCurrency(summary?.overdueBalance ?? 0)} description="Unpaid installment balance already past due." />
                <MetricCard label="Due this week" value={formatCurrency(summary?.dueThisWeekBalance ?? 0)} description="Upcoming unpaid installment balance due inside the next seven days." />
                <MetricCard label="PAR rate" value={`${summary?.portfolioAtRiskRate ?? 0}%`} description="Portfolio-at-risk based on overdue balance against outstanding exposure." />
              </>
            )}
          >
            <RecordScrollRegion>
              <div className="grid gap-4">
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Aging buckets" title="Portfolio exposure by delinquency age" />

                  {riskQuery.data?.agingBuckets.length ? (
                    <WorkspaceSubtableShell>
                      <WorkspaceSubtable>
                        <thead>
                          <tr>
                            <th>Bucket</th>
                            <th>Loans</th>
                            <th>Outstanding</th>
                            <th>Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riskQuery.data.agingBuckets.map((bucket) => (
                            <tr key={bucket.label}>
                              <td>{bucket.label}</td>
                              <td>{bucket.loanCount}</td>
                              <td>{formatCurrency(bucket.outstandingBalance)}</td>
                              <td>{formatCurrency(bucket.overdueAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </WorkspaceSubtable>
                    </WorkspaceSubtableShell>
                  ) : (
                    <WorkspaceEmptyState>No portfolio aging data is available yet.</WorkspaceEmptyState>
                  )}
                </WorkspacePanel>

                <WorkspacePanel className="min-h-[24rem]">
                  <WorkspacePanelHeader eyebrow="Borrower risk rows" title="Active loans ordered by overdue pressure" />

                  <RecordTableShell>
                    <RecordTable>
                      <thead>
                        <tr>
                          <th>Borrower</th>
                          <th>Loan</th>
                          <th>Outstanding</th>
                          <th>Overdue</th>
                          <th>Days past due</th>
                          <th>Next due</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskQuery.isLoading ? (
                          <RecordTableStateRow colSpan={7}>Loading risk rows...</RecordTableStateRow>
                        ) : rows.length === 0 ? (
                          <RecordTableStateRow colSpan={7}>No active loan exposure is available yet.</RecordTableStateRow>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.microLoanId}>
                              <td>{row.customerName}</td>
                              <td>
                                <div className="grid gap-1">
                                  <strong>{row.loanLabel}</strong>
                                  <span className="text-xs text-base-content/60">{row.loanStatus}</span>
                                </div>
                              </td>
                              <td>{formatCurrency(row.outstandingBalance)}</td>
                              <td>{formatCurrency(row.overdueAmount)}</td>
                              <td>{row.daysPastDue}</td>
                              <td>{formatDate(row.nextDueDate)}</td>
                              <td>
                                <WorkspaceStatusPill tone={getRiskTone(row.riskState)}>{row.riskState}</WorkspaceStatusPill>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>
              </div>
            </RecordScrollRegion>
          </WorkspaceKpiRailLayout>
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

export default MlsPortfolioRiskPage;
