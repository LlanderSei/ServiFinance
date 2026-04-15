import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TenantMlsLedgerWorkspaceResponse } from "@/shared/api/contracts";
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
  WorkspaceNotice
} from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function buildLedgerQueryString(transactionType: string) {
  return transactionType ? `?transactionType=${encodeURIComponent(transactionType)}` : "";
}

export function MlsLedgerPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [transactionType, setTransactionType] = useState("");

  const ledgerQueryString = useMemo(() => buildLedgerQueryString(transactionType), [transactionType]);
  const ledgerQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-ledger", transactionType],
    queryFn: () => httpGet<TenantMlsLedgerWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/ledger${ledgerQueryString}`),
    enabled: Boolean(tenantDomainSlug)
  });

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Ledger`}
        title="Finance ledger"
        description="Review loan disbursements, payment postings, and running balances across the MLS desktop finance workspace."
      >
        <WorkspaceScrollStack>
          {ledgerQuery.isLoading ? <WorkspaceNotice>Loading MLS ledger entries...</WorkspaceNotice> : null}
          {ledgerQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load the MLS finance ledger right now.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-4">
            <MetricCard label="Ledger entries" value={String(ledgerQuery.data?.summary.totalEntries ?? 0)} description="Transaction rows currently visible in the MLS ledger filter." />
            <MetricCard label="Disbursed" value={formatCurrency(ledgerQuery.data?.summary.totalLoanDisbursed ?? 0)} description="Loan principal released through invoice and standalone MLS creation." />
            <MetricCard label="Collections" value={formatCurrency(ledgerQuery.data?.summary.totalCollections ?? 0)} description="Payments posted back into the MLS finance ledger." />
            <MetricCard label="Running balance" value={formatCurrency(ledgerQuery.data?.summary.currentRunningBalance ?? 0)} description="Latest customer-ledger running balance across the tenant finance workspace." />
          </WorkspaceMetricGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader
              eyebrow="Filters"
              title="Ledger query"
              actions={(
                <WorkspaceActionButton onClick={() => setTransactionType("")}>
                  Clear filter
                </WorkspaceActionButton>
              )}
            />

            <WorkspaceFieldGrid>
              <WorkspaceField label="Transaction type">
                <WorkspaceInput
                  value={transactionType}
                  onChange={(event) => setTransactionType(event.target.value)}
                  placeholder="LoanPayment, LoanCreation, StandaloneLoanCreation"
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspacePanel>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Entries" title="Finance transaction history" />

            {ledgerQuery.data?.entries.length ? (
              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Loan</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerQuery.data.entries.map((entry) => (
                      <tr key={entry.transactionId}>
                        <td>{entry.transactionDateUtc.slice(0, 10)}</td>
                        <td>{entry.transactionType}</td>
                        <td>{entry.referenceNumber}</td>
                        <td>{entry.customerName}</td>
                        <td>{entry.loanLabel}</td>
                        <td>{formatCurrency(entry.debitAmount)}</td>
                        <td>{formatCurrency(entry.creditAmount)}</td>
                        <td>{formatCurrency(entry.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            ) : (
              <WorkspaceEmptyState>
                No ledger entries match the current MLS filter. Create or pay a loan to populate the finance ledger.
              </WorkspaceEmptyState>
            )}
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
