import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TenantMlsCustomerFinanceDetailResponse,
  TenantMlsCustomerFinanceRow,
  TenantMlsCustomerFinanceWorkspaceResponse
} from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordSurfaceModal } from "@/shared/records/RecordSurfaceModal";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionLink,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";

type CustomerFinanceTab = "profile" | "loans" | "ledger";

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

function formatShortDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-PH");
}

export function MlsCustomerFinancePage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerFinanceTab>("profile");

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

  function openCustomerModal(customerId: string, tab: CustomerFinanceTab) {
    setSelectedCustomerId(customerId);
    setActiveTab(tab);
    setIsModalOpen(true);
  }

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
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {workspaceQuery.isLoading ? <WorkspaceNotice>Loading MLS borrower records...</WorkspaceNotice> : null}
              {workspaceQuery.isError ? (
                <WorkspaceNotice tone="error">
                  Unable to load MLS customer finance records right now.
                </WorkspaceNotice>
              ) : null}

              <MetricCard label="Borrowers" value={String(summary?.totalBorrowers ?? 0)} description="Customers with at least one loan record or MLS ledger trail." />
              <MetricCard label="Active borrowers" value={String(summary?.activeBorrowers ?? 0)} description="Borrowers who still carry at least one unpaid or active loan account." />
              <MetricCard label="Outstanding portfolio" value={formatCurrency(summary?.outstandingPortfolioBalance ?? 0)} description="Remaining repayable balance across the tenant borrower portfolio." />
              <MetricCard label="Collected to date" value={formatCurrency(summary?.totalCollectedAmount ?? 0)} description="All loan-payment collections already posted inside MLS." />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <WorkspacePanelHeader
                eyebrow="Borrowers"
                title="Portfolio by customer"
                actions={selectedCustomer ? (
                  <WorkspaceActionLink to="/t/mls/loans">
                    Open Loan Accounts
                  </WorkspaceActionLink>
                ) : undefined}
              />

              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-3">
                  <div className="grid gap-0.5">
                    <strong className="text-sm text-base-content">Borrower workspace</strong>
                    <span className="text-sm text-base-content/65">
                      Profile, loans, and ledger detail open inside a borrower modal so the main workspace stays table-focused.
                    </span>
                  </div>
                </div>

                <RecordTableShell className="min-h-0 flex-1">
                  <RecordTable className="min-w-[78rem]">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Active</th>
                        <th>Settled</th>
                        <th>Outstanding</th>
                        <th>Collected</th>
                        <th>Next due</th>
                        <th>Last payment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.isLoading ? (
                        <RecordTableStateRow colSpan={8}>Loading borrower portfolio...</RecordTableStateRow>
                      ) : workspaceQuery.isError ? (
                        <RecordTableStateRow colSpan={8} tone="error">
                          Unable to load the borrower portfolio.
                        </RecordTableStateRow>
                      ) : workspaceQuery.data?.customers.length ? (
                        workspaceQuery.data.customers.map((customer) => (
                          <BorrowerTableRow
                            key={customer.customerId}
                            customer={customer}
                            isSelected={customer.customerId === selectedCustomerId}
                            onOpenTab={openCustomerModal}
                          />
                        ))
                      ) : (
                        <RecordTableStateRow colSpan={8}>
                          No MLS borrower records are available yet. Create a loan first to populate customer finance records.
                        </RecordTableStateRow>
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </div>
            </WorkspacePanel>
          </section>
        </div>

        <BorrowerFinanceModal
          open={isModalOpen}
          title={selectedCustomer?.customerName ?? "Borrower finance record"}
          eyebrow={`${tenantDomainSlug} / MLS / Customer Records`}
          activeTab={activeTab}
          selectedCustomer={selectedCustomer}
          latestLoanLabel={latestLoan ? `${latestLoan.invoiceNumber} with ${formatCurrency(latestLoan.outstandingBalance)} remaining.` : null}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          detail={detailQuery.data ?? null}
          onChangeTab={setActiveTab}
          onClose={() => setIsModalOpen(false)}
        />
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

type BorrowerTableRowProps = {
  customer: TenantMlsCustomerFinanceRow;
  isSelected: boolean;
  onOpenTab: (customerId: string, tab: CustomerFinanceTab) => void;
};

function BorrowerTableRow({ customer, isSelected, onOpenTab }: BorrowerTableRowProps) {
  return (
    <tr className={isSelected ? "bg-primary/7" : undefined}>
      <td>
        <div className="grid gap-1">
          <strong>{customer.customerName}</strong>
          <span className="text-xs text-base-content/60">{customer.customerCode}</span>
        </div>
      </td>
      <td>{customer.activeLoanCount}</td>
      <td>{customer.settledLoanCount}</td>
      <td>{formatCurrency(customer.outstandingBalance)}</td>
      <td>{formatCurrency(customer.totalCollectedAmount)}</td>
      <td>{customer.nextDueDate ?? "Settled"}</td>
      <td>{formatShortDate(customer.lastPaymentDateUtc)}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <RecordTableActionButton onClick={() => onOpenTab(customer.customerId, "profile")}>
            Profile
          </RecordTableActionButton>
          <RecordTableActionButton onClick={() => onOpenTab(customer.customerId, "loans")}>
            Loans
          </RecordTableActionButton>
          <RecordTableActionButton onClick={() => onOpenTab(customer.customerId, "ledger")}>
            Ledger
          </RecordTableActionButton>
        </div>
      </td>
    </tr>
  );
}

type BorrowerFinanceModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  activeTab: CustomerFinanceTab;
  selectedCustomer: TenantMlsCustomerFinanceRow | null | undefined;
  latestLoanLabel: string | null;
  isLoading: boolean;
  isError: boolean;
  detail: TenantMlsCustomerFinanceDetailResponse | null;
  onChangeTab: (tab: CustomerFinanceTab) => void;
  onClose: () => void;
};

function BorrowerFinanceModal({
  open,
  title,
  eyebrow,
  activeTab,
  selectedCustomer,
  latestLoanLabel,
  isLoading,
  isError,
  detail,
  onChangeTab,
  onClose
}: BorrowerFinanceModalProps) {
  const tabs: Array<{ key: CustomerFinanceTab; label: string }> = [
    { key: "profile", label: "Profile" },
    { key: "loans", label: "Loans" },
    { key: "ledger", label: "Ledger" }
  ];

  return (
    <RecordSurfaceModal
      open={open}
      title={title}
      eyebrow={eyebrow}
      description={selectedCustomer ? `${selectedCustomer.customerCode} • ${selectedCustomer.activeLoanCount > 0 ? "With active exposure" : "Settled borrower"}` : undefined}
      tabs={tabs}
      activeTabKey={activeTab}
      onTabChange={(tabKey) => onChangeTab(tabKey as CustomerFinanceTab)}
      maxWidthClassName="max-w-[min(82rem,calc(100vw-3rem))]"
      onClose={onClose}
    >
      {isLoading ? <WorkspaceNotice>Loading borrower detail...</WorkspaceNotice> : null}
      {isError ? (
        <WorkspaceNotice tone="error">
          Unable to load this borrower&apos;s finance detail right now.
        </WorkspaceNotice>
      ) : null}

      {!isLoading && !isError && !detail ? (
        <WorkspaceEmptyState>Select a borrower record to inspect profile, loans, or ledger detail.</WorkspaceEmptyState>
      ) : null}

      {!isLoading && !isError && detail ? (
        <div className="h-full min-h-0 overflow-y-auto pr-1">
          {activeTab === "profile" ? (
            <BorrowerProfileTab customer={detail.customer} latestLoanLabel={latestLoanLabel} />
          ) : null}
          {activeTab === "loans" ? <BorrowerLoansTab detail={detail} /> : null}
          {activeTab === "ledger" ? <BorrowerLedgerTab detail={detail} /> : null}
        </div>
      ) : null}
    </RecordSurfaceModal>
  );
}

type BorrowerProfileTabProps = {
  customer: TenantMlsCustomerFinanceRow;
  latestLoanLabel: string | null;
};

function BorrowerProfileTab({ customer, latestLoanLabel }: BorrowerProfileTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Profile" title="Borrower summary" />

          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-4">
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Borrower profile</p>
                <h3 className="mt-1 text-xl font-semibold text-base-content">{customer.customerName}</h3>
                <p className="text-sm text-base-content/65">{customer.customerCode}</p>
              </div>
              <WorkspaceStatusPill tone={customer.activeLoanCount > 0 ? "warning" : "active"}>
                {customer.activeLoanCount > 0 ? "With Active Exposure" : "Settled"}
              </WorkspaceStatusPill>
            </div>

            {latestLoanLabel ? (
              <WorkspaceNotice>
                Latest loan account: {latestLoanLabel}
              </WorkspaceNotice>
            ) : (
              <WorkspaceNotice>
                This borrower currently has no loan account rows, but MLS transaction history may still exist.
              </WorkspaceNotice>
            )}
          </div>
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Position" title="Collection posture" />

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Outstanding" value={formatCurrency(customer.outstandingBalance)} description="Current unpaid exposure across this borrower portfolio." />
            <MetricCard label="Collected" value={formatCurrency(customer.totalCollectedAmount)} description="All collections posted against this borrower." />
            <MetricCard label="Next due date" value={customer.nextDueDate ?? "Settled"} description="Next unpaid installment due for this borrower." />
            <MetricCard label="Last payment" value={formatDateTime(customer.lastPaymentDateUtc)} description="Most recent posted payment activity for this borrower." />
          </div>
        </WorkspacePanel>
      </div>
    </div>
  );
}

type BorrowerLoansTabProps = {
  detail: TenantMlsCustomerFinanceDetailResponse;
};

function BorrowerLoansTab({ detail }: BorrowerLoansTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Loans" title="Borrower loan accounts" />

        {detail.loans.length ? (
          <WorkspaceSubtableShell className="max-h-[min(56vh,34rem)]">
            <WorkspaceSubtable className="min-w-[58rem]">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Principal</th>
                  <th>Outstanding</th>
                  <th>Total paid</th>
                  <th>Pending installments</th>
                  <th>Next due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.loans.map((loan) => (
                  <tr key={loan.microLoanId}>
                    <td>{loan.invoiceNumber}</td>
                    <td>{formatCurrency(loan.principalAmount)}</td>
                    <td>{formatCurrency(loan.outstandingBalance)}</td>
                    <td>{formatCurrency(loan.totalPaidAmount)}</td>
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
    </div>
  );
}

type BorrowerLedgerTabProps = {
  detail: TenantMlsCustomerFinanceDetailResponse;
};

function BorrowerLedgerTab({ detail }: BorrowerLedgerTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Ledger" title="Borrower finance history" />

        {detail.ledger.length ? (
          <WorkspaceSubtableShell className="max-h-[min(56vh,34rem)]">
            <WorkspaceSubtable className="min-w-[62rem]">
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
                {detail.ledger.map((entry) => (
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
    </div>
  );
}
