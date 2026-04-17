import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TenantMlsReportsWorkspaceResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
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
  WorkspaceNotice,
  WorkspaceSelect
} from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function buildReportsQueryString(rangeDays: number) {
  return `?rangeDays=${rangeDays}`;
}

export function MlsReportsPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [rangeDays, setRangeDays] = useState(30);

  const reportsQueryString = useMemo(() => buildReportsQueryString(rangeDays), [rangeDays]);
  const reportsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-reports", rangeDays],
    queryFn: () => httpGet<TenantMlsReportsWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/reports${reportsQueryString}`),
    enabled: Boolean(tenantDomainSlug)
  });

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Reports`}
        title="Finance reports"
        description="Review collections, disbursement, portfolio exposure, and overdue aging from the MLS desktop reporting workspace."
      >
        <WorkspaceScrollStack>
          {reportsQuery.isLoading ? <WorkspaceNotice>Loading MLS finance reports...</WorkspaceNotice> : null}
          {reportsQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load MLS finance reports right now.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid>
            <MetricCard label="Active loans" value={String(reportsQuery.data?.summary.activeLoans ?? 0)} description="Current loan accounts still carrying unpaid balances." />
            <MetricCard label="Portfolio outstanding" value={formatCurrency(reportsQuery.data?.summary.outstandingPortfolioBalance ?? 0)} description="Remaining repayable balance across the active MLS loan portfolio." />
            <MetricCard label="Collections in window" value={formatCurrency(reportsQuery.data?.summary.collectionsInWindow ?? 0)} description="Loan payments posted during the selected reporting range." />
            <MetricCard label="Disbursed in window" value={formatCurrency(reportsQuery.data?.summary.loanDisbursedInWindow ?? 0)} description="Loan principal released through invoice and standalone onboarding in the selected range." />
            <MetricCard label="Overdue balance" value={formatCurrency(reportsQuery.data?.summary.overdueBalance ?? 0)} description="Current unpaid installment value already past due across the tenant portfolio." />
          </WorkspaceMetricGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader
              eyebrow="Filters"
              title="Reporting window"
              actions={(
                <WorkspaceActionButton onClick={() => setRangeDays(30)}>
                  Reset to 30 days
                </WorkspaceActionButton>
              )}
            />

            <WorkspaceFieldGrid>
              <WorkspaceField label="Range">
                <WorkspaceSelect value={String(rangeDays)} onChange={(event) => setRangeDays(Number(event.target.value))}>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last 365 days</option>
                </WorkspaceSelect>
              </WorkspaceField>
              <WorkspaceField label="Window">
                <WorkspaceSelect value="fixed" disabled>
                  <option value="fixed">
                    {reportsQuery.data
                      ? `${reportsQuery.data.window.dateFromUtc.slice(0, 10)} to ${reportsQuery.data.window.dateToUtc.slice(0, 10)}`
                      : "Waiting for report window"}
                  </option>
                </WorkspaceSelect>
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
                <WorkspaceEmptyState>No loan payments were posted in the selected reporting range.</WorkspaceEmptyState>
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
