import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TenantMlsCustomerFinanceDetailResponse,
  TenantMlsCustomerFinanceWorkspaceResponse
} from "@/shared/api/contracts";
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
  WorkspaceActionLink,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No payments yet";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("en-PH");
}

export function MlsCustomerFinancePage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"],
    queryFn: () => httpGet<TenantMlsCustomerFinanceWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/customers`),
    enabled: Boolean(tenantDomainSlug)
  });

  useEffect(() => {
    const firstCustomer = workspaceQuery.data?.customers[0];
    if (!firstCustomer) {
      setSelectedCustomerId("");
      return;
    }

    if (!selectedCustomerId || !workspaceQuery.data?.customers.some((customer) => customer.customerId === selectedCustomerId)) {
      setSelectedCustomerId(firstCustomer.customerId);
    }
  }, [selectedCustomerId, workspaceQuery.data]);

  const detailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance-detail", selectedCustomerId],
    queryFn: () => httpGet<TenantMlsCustomerFinanceDetailResponse>(`/api/tenants/${tenantDomainSlug}/mls/customers/${selectedCustomerId}`),
    enabled: Boolean(tenantDomainSlug && selectedCustomerId)
  });

  const summary = workspaceQuery.data?.summary;
  const selectedCustomer = detailQuery.data?.customer;
  const latestLoan = useMemo(
    () => detailQuery.data?.loans[0] ?? null,
    [detailQuery.data]
  );

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Customer Records`}
        title="Customer financial records"
        description="Review borrower-level balances, due position, loan accounts, and finance transaction history from the MLS desktop workspace."
      >
        <WorkspaceScrollStack>
          {workspaceQuery.isLoading ? <WorkspaceNotice>Loading MLS borrower records...</WorkspaceNotice> : null}
          {workspaceQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load MLS customer finance records right now.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-4">
            <MetricCard label="Borrowers" value={String(summary?.totalBorrowers ?? 0)} description="Customers with at least one loan record or MLS ledger trail." />
            <MetricCard label="Active borrowers" value={String(summary?.activeBorrowers ?? 0)} description="Borrowers who still carry at least one unpaid or active loan account." />
            <MetricCard label="Outstanding portfolio" value={formatCurrency(summary?.outstandingPortfolioBalance ?? 0)} description="Remaining repayable balance across the tenant borrower portfolio." />
            <MetricCard label="Collected to date" value={formatCurrency(summary?.totalCollectedAmount ?? 0)} description="All loan-payment collections already posted inside MLS." />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Borrowers" title="Portfolio by customer" />

              {workspaceQuery.data?.customers.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Active</th>
                        <th>Settled</th>
                        <th>Outstanding</th>
                        <th>Next due</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.data.customers.map((customer) => (
                        <tr key={customer.customerId}>
                          <td>
                            <div className="grid gap-1">
                              <strong>{customer.customerName}</strong>
                              <span className="text-xs text-base-content/60">{customer.customerCode}</span>
                            </div>
                          </td>
                          <td>{customer.activeLoanCount}</td>
                          <td>{customer.settledLoanCount}</td>
                          <td>{formatCurrency(customer.outstandingBalance)}</td>
                          <td>{customer.nextDueDate ?? "Settled"}</td>
                          <td>
                            <WorkspaceActionButton onClick={() => setSelectedCustomerId(customer.customerId)}>
                              {customer.customerId === selectedCustomerId ? "Selected" : "Open"}
                            </WorkspaceActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No MLS borrower records are available yet. Create a loan first to populate customer finance records.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Profile"
                title="Selected borrower summary"
                actions={selectedCustomer ? (
                  <WorkspaceActionLink to="/t/mls/loans">
                    Open Loan Accounts
                  </WorkspaceActionLink>
                ) : undefined}
              />

              {detailQuery.isLoading ? <WorkspaceNotice>Loading borrower profile...</WorkspaceNotice> : null}
              {detailQuery.isError ? (
                <WorkspaceNotice tone="error">
                  Unable to load the selected borrower profile right now.
                </WorkspaceNotice>
              ) : null}

              {selectedCustomer ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300/70 bg-base-200/30 px-4 py-4">
                    <div>
                      <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Borrower profile</p>
                      <h3 className="mt-1 text-lg font-semibold text-base-content">{selectedCustomer.customerName}</h3>
                      <p className="text-sm text-base-content/65">{selectedCustomer.customerCode}</p>
                    </div>
                    <WorkspaceStatusPill tone={selectedCustomer.activeLoanCount > 0 ? "warning" : "active"}>
                      {selectedCustomer.activeLoanCount > 0 ? "With Active Exposure" : "Settled"}
                    </WorkspaceStatusPill>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Outstanding" value={formatCurrency(selectedCustomer.outstandingBalance)} description="Current unpaid exposure across this borrower portfolio." />
                    <MetricCard label="Collected" value={formatCurrency(selectedCustomer.totalCollectedAmount)} description="All collections posted against this borrower." />
                    <MetricCard label="Next due date" value={selectedCustomer.nextDueDate ?? "Settled"} description="Next unpaid installment due for this borrower." />
                    <MetricCard label="Last payment" value={formatDateTime(selectedCustomer.lastPaymentDateUtc)} description="Most recent posted payment activity for this borrower." />
                  </div>

                  {latestLoan ? (
                    <WorkspaceNotice>
                      Latest loan account: {latestLoan.invoiceNumber} with {formatCurrency(latestLoan.outstandingBalance)} remaining.
                    </WorkspaceNotice>
                  ) : (
                    <WorkspaceNotice>
                      This borrower currently has no loan account rows, but MLS transaction history may still exist.
                    </WorkspaceNotice>
                  )}
                </div>
              ) : (
                <WorkspaceEmptyState>
                  Select a borrower from the portfolio table to inspect that customer&apos;s finance record.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Loans" title="Borrower loan accounts" />

              {detailQuery.data?.loans.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Loan</th>
                        <th>Principal</th>
                        <th>Outstanding</th>
                        <th>Pending installments</th>
                        <th>Next due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.loans.map((loan) => (
                        <tr key={loan.microLoanId}>
                          <td>{loan.invoiceNumber}</td>
                          <td>{formatCurrency(loan.principalAmount)}</td>
                          <td>{formatCurrency(loan.outstandingBalance)}</td>
                          <td>{loan.pendingInstallments}</td>
                          <td>{loan.nextDueDate ?? "Settled"}</td>
                          <td>
                            <WorkspaceStatusPill tone={loan.loanStatus === "Paid" ? "active" : "warning"}>
                              {loan.loanStatus}
                            </WorkspaceStatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No loan rows are attached to the selected borrower yet.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Ledger" title="Borrower finance history" />

              {detailQuery.data?.ledger.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Loan</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.ledger.map((entry) => (
                        <tr key={entry.transactionId}>
                          <td>{entry.transactionDateUtc.slice(0, 10)}</td>
                          <td>{entry.transactionType}</td>
                          <td>{entry.referenceNumber}</td>
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
                  Finance transactions for the selected borrower will appear here after loan creation or payment posting.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
