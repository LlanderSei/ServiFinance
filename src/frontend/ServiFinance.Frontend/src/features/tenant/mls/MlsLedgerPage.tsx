import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TenantMlsLedgerWorkspaceResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell,
  WorkspaceToolbar
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceInput,
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

function buildLedgerQueryString(transactionType: string, searchTerm: string, dateFrom: string, dateTo: string) {
  const searchParams = new URLSearchParams();
  if (transactionType) {
    searchParams.set("transactionType", transactionType);
  }
  if (searchTerm) {
    searchParams.set("searchTerm", searchTerm);
  }
  if (dateFrom) {
    searchParams.set("dateFrom", dateFrom);
  }
  if (dateTo) {
    searchParams.set("dateTo", dateTo);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function MlsLedgerPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [transactionType, setTransactionType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const isWindowInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const ledgerQueryString = useMemo(
    () => buildLedgerQueryString(transactionType, searchTerm, dateFrom, dateTo),
    [transactionType, searchTerm, dateFrom, dateTo]
  );
  const ledgerQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-ledger", transactionType, searchTerm, dateFrom, dateTo],
    queryFn: () => httpGet<TenantMlsLedgerWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/ledger${ledgerQueryString}`),
    enabled: Boolean(tenantDomainSlug) && !isWindowInvalid
  });

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.ledger.view"
      requireModule={MlsModuleCodes.ledgerReports}
      requireFullModule
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Ledger`}
        title="Finance ledger"
        description="Review loan disbursements, payment postings, correction entries, and running balances across the MLS desktop finance workspace."
      >
        <RecordContentStack className="overflow-hidden">
          {isWindowInvalid ? (
            <WorkspaceNotice tone="error">
              Ledger end date must be on or after the start date.
            </WorkspaceNotice>
          ) : null}
          {ledgerQuery.isLoading ? <WorkspaceNotice>Loading MLS ledger entries...</WorkspaceNotice> : null}
          {ledgerQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(ledgerQuery.error, "Unable to load the MLS finance ledger right now.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceKpiRailLayout
            contentClassName="overflow-hidden"
            kpis={(
              <>
                <MetricCard label="Ledger entries" value={String(ledgerQuery.data?.summary.totalEntries ?? 0)} description="Transaction rows currently visible in the MLS ledger filter." />
                <MetricCard label="Disbursed" value={formatCurrency(ledgerQuery.data?.summary.totalLoanDisbursed ?? 0)} description="Loan principal released through invoice and standalone MLS creation." />
                <MetricCard label="Net collections" value={formatCurrency(ledgerQuery.data?.summary.totalCollections ?? 0)} description="Payments minus posted reversals inside the current MLS ledger filter." />
                <MetricCard label="Running balance" value={formatCurrency(ledgerQuery.data?.summary.currentRunningBalance ?? 0)} description="Most recent running balance inside the current ledger review filter." />
              </>
            )}
          >
            <WorkspacePanel className="shrink-0">
              <WorkspacePanelHeader
                eyebrow="Filters"
                title="Ledger review filters"
                actions={(
                  <WorkspaceActionButton onClick={() => {
                    setTransactionType("");
                    setSearchTerm("");
                    setDateFrom("");
                    setDateTo("");
                  }}>
                    Clear filter
                  </WorkspaceActionButton>
                )}
              />

              <WorkspaceToolbar className="flex-nowrap overflow-x-auto pb-1">
                <div className="w-56 shrink-0">
                  <WorkspaceField label="Transaction type">
                    <WorkspaceSelect
                      value={transactionType}
                      onChange={(event) => setTransactionType(event.target.value)}
                    >
                      <option value="">All transaction types</option>
                      <option value="LoanPayment">Loan payment</option>
                      <option value="LoanPaymentReversal">Loan payment reversal</option>
                      <option value="LoanCreation">Invoice loan creation</option>
                      <option value="StandaloneLoanCreation">Standalone loan creation</option>
                    </WorkspaceSelect>
                  </WorkspaceField>
                </div>

                <div className="w-40 shrink-0">
                  <WorkspaceField label="Date from">
                    <WorkspaceInput
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </WorkspaceField>
                </div>

                <div className="w-40 shrink-0">
                  <WorkspaceField label="Date to">
                    <WorkspaceInput
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </WorkspaceField>
                </div>

                <div className="w-80 shrink-0">
                  <WorkspaceField label="Search borrower, reference, remarks">
                    <WorkspaceInput
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Borrower, invoice, payment reference, remarks"
                    />
                  </WorkspaceField>
                </div>
              </WorkspaceToolbar>
            </WorkspacePanel>

            <RecordScrollRegion>
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
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerQuery.data.entries.map((entry) => (
                          <tr key={entry.transactionId}>
                            <td>{new Date(entry.transactionDateUtc).toLocaleString("en-PH")}</td>
                            <td>{entry.transactionType}</td>
                            <td>{entry.referenceNumber}</td>
                            <td>{entry.customerName}</td>
                            <td>{entry.loanLabel}</td>
                            <td>{formatCurrency(entry.debitAmount)}</td>
                            <td>{formatCurrency(entry.creditAmount)}</td>
                            <td>{formatCurrency(entry.runningBalance)}</td>
                            <td>{entry.remarks || "No remarks recorded."}</td>
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
            </RecordScrollRegion>
          </WorkspaceKpiRailLayout>
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
