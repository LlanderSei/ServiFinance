import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ApproveTenantMlsInvoicePaymentSubmissionRequest,
  type RejectTenantMlsInvoicePaymentSubmissionRequest,
  type TenantMlsCustomerFinanceDetailResponse,
  type TenantMlsCustomerFinanceRow,
  type TenantMlsCustomerFinanceWorkspaceResponse,
  type TenantMlsCustomerServiceInvoiceRow,
  type TenantMlsInvoicePaymentSubmissionRow
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordSurfaceModal } from "@/shared/records/RecordSurfaceModal";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceActionButton,
  WorkspaceActionLink,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";

type CustomerFinanceTab = "profile" | "loans" | "settlements" | "ledger";
type SettlementAction = "approve" | "reject" | null;

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

function getFinanceTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("partial")) {
    return "warning" as const;
  }

  if (normalized.includes("paid") || normalized.includes("approved")) {
    return "active" as const;
  }

  if (normalized.includes("submitted") || normalized.includes("review") || normalized.includes("loan") || normalized.includes("checkout")) {
    return "progress" as const;
  }

  if (normalized.includes("active")) {
    return "warning" as const;
  }

  if (normalized.includes("reject")) {
    return "inactive" as const;
  }

  return "neutral" as const;
}

function buildSettlementActionKey(submissionId: string) {
  return submissionId;
}

function isManualSettlementPending(status: string) {
  return status === "Payment Submitted" || status === "Pending Review";
}

export function MlsCustomerFinancePage() {
  const queryClient = useQueryClient();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const currentUser = (currentSession ?? data)?.user ?? null;
  const tenantDomainSlug = currentUser?.tenantDomainSlug ?? "";
  const canManageSettlements = hasPermission(currentUser, "mls.settlements.manage");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerFinanceTab>("profile");
  const [activeSettlementActionKey, setActiveSettlementActionKey] = useState<string | null>(null);
  const [activeSettlementAction, setActiveSettlementAction] = useState<SettlementAction>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");

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

  function refreshFinanceQueries(customerId: string) {
    void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"] });
    void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance-detail", customerId] });
    void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-audit"] });
  }

  function resetSettlementAction() {
    setActiveSettlementActionKey(null);
    setActiveSettlementAction(null);
    setApprovedAmount("");
    setReviewRemarks("");
  }

  const approveSettlementMutation = useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: string; payload: ApproveTenantMlsInvoicePaymentSubmissionRequest }) =>
      httpPostJson<void, ApproveTenantMlsInvoicePaymentSubmissionRequest>(
        `/api/tenants/${tenantDomainSlug}/mls/invoice-settlements/${submissionId}/approve`,
        payload
      ),
    onSuccess: () => {
      resetSettlementAction();
      refreshFinanceQueries(selectedCustomerId);
    }
  });

  const rejectSettlementMutation = useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: string; payload: RejectTenantMlsInvoicePaymentSubmissionRequest }) =>
      httpPostJson<void, RejectTenantMlsInvoicePaymentSubmissionRequest>(
        `/api/tenants/${tenantDomainSlug}/mls/invoice-settlements/${submissionId}/reject`,
        payload
      ),
    onSuccess: () => {
      resetSettlementAction();
      refreshFinanceQueries(selectedCustomerId);
    }
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
    resetSettlementAction();
    setIsModalOpen(true);
  }

  function handleTabChange(tab: CustomerFinanceTab) {
    setActiveTab(tab);
    if (tab !== "settlements") {
      resetSettlementAction();
    }
  }

  function handleCloseModal() {
    resetSettlementAction();
    setIsModalOpen(false);
  }

  function startSettlementAction(submission: TenantMlsInvoicePaymentSubmissionRow, action: Exclude<SettlementAction, null>) {
    if (!canManageSettlements) {
      return;
    }

    setActiveSettlementActionKey(buildSettlementActionKey(submission.submissionId));
    setActiveSettlementAction(action);
    setApprovedAmount(submission.amountSubmitted.toFixed(2));
    setReviewRemarks("");
  }

  function handleApproveSettlementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSettlementActionKey) {
      return;
    }
    if (!canManageSettlements) {
      return;
    }

    approveSettlementMutation.mutate({
      submissionId: activeSettlementActionKey,
      payload: {
        approvedAmount: Number(approvedAmount),
        reviewRemarks: reviewRemarks.trim() || null
      }
    });
  }

  function handleRejectSettlementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSettlementActionKey) {
      return;
    }
    if (!canManageSettlements) {
      return;
    }

    rejectSettlementMutation.mutate({
      submissionId: activeSettlementActionKey,
      payload: {
        reviewRemarks: reviewRemarks.trim()
      }
    });
  }

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.customer-finance.view"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Customer Records`}
        title="Customer financial records"
        description="Review service invoices, loan exposure, settlement proofs, and finance transaction history from the MLS desktop workspace."
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {workspaceQuery.isLoading ? <WorkspaceNotice>Loading MLS customer finance records...</WorkspaceNotice> : null}
              {workspaceQuery.isError ? (
                <WorkspaceNotice tone="error">
                  {getApiErrorMessage(workspaceQuery.error, "Unable to load MLS customer finance records right now.")}
                </WorkspaceNotice>
              ) : null}

              <MetricCard label="Customers" value={String(summary?.totalBorrowers ?? 0)} description="Customers with service invoices, loan records, or MLS finance history." />
              <MetricCard label="Open balance" value={String(summary?.activeBorrowers ?? 0)} description="Customers who still carry unpaid service invoices or active loan exposure." />
              <MetricCard label="Outstanding portfolio" value={formatCurrency(summary?.outstandingPortfolioBalance ?? 0)} description="Remaining unpaid balance across service invoices and MLS loan accounts." />
              <MetricCard label="Collected to date" value={formatCurrency(summary?.totalCollectedAmount ?? 0)} description="Approved collections and confirmed settlement amounts retained in this workspace." />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <WorkspacePanelHeader
                eyebrow="Customers"
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
                    <strong className="text-sm text-base-content">Customer finance workspace</strong>
                    <span className="text-sm text-base-content/65">
                      Profile, loans, settlements, and ledger detail open inside a customer modal so the main workspace stays table-focused.
                    </span>
                  </div>
                </div>

                <RecordTableShell className="min-h-0 flex-1">
                  <RecordTable className="min-w-[78rem]">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Active loans</th>
                        <th>Settled loans</th>
                        <th>Outstanding</th>
                        <th>Collected</th>
                        <th>Next due</th>
                        <th>Last payment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.isLoading ? (
                        <RecordTableStateRow colSpan={8}>Loading customer finance portfolio...</RecordTableStateRow>
                      ) : workspaceQuery.isError ? (
                        <RecordTableStateRow colSpan={8} tone="error">
                          {getApiErrorMessage(workspaceQuery.error, "Unable to load the customer finance portfolio.")}
                        </RecordTableStateRow>
                      ) : workspaceQuery.data?.customers.length ? (
                        workspaceQuery.data.customers.map((customer) => (
                          <CustomerFinanceTableRow
                            key={customer.customerId}
                            customer={customer}
                            isSelected={customer.customerId === selectedCustomerId}
                            onOpenTab={openCustomerModal}
                          />
                        ))
                      ) : (
                        <RecordTableStateRow colSpan={8}>
                          No customer finance records are available yet. Finalize a service invoice or create a loan first to populate this workspace.
                        </RecordTableStateRow>
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </div>
            </WorkspacePanel>
          </section>
        </div>

        <CustomerFinanceModal
          open={isModalOpen}
          title={selectedCustomer?.customerName ?? "Customer finance record"}
          eyebrow={`${tenantDomainSlug} / MLS / Customer Records`}
          activeTab={activeTab}
          selectedCustomer={selectedCustomer}
          latestLoanLabel={latestLoan ? `${latestLoan.invoiceNumber} with ${formatCurrency(latestLoan.outstandingBalance)} remaining.` : null}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          errorMessage={getApiErrorMessage(detailQuery.error, "Unable to load this customer's finance detail right now.")}
          detail={detailQuery.data ?? null}
          settlementActionKey={activeSettlementActionKey}
          settlementAction={activeSettlementAction}
          approvedAmount={approvedAmount}
          reviewRemarks={reviewRemarks}
          approveErrorMessage={approveSettlementMutation.isError ? approveSettlementMutation.error.message : null}
          rejectErrorMessage={rejectSettlementMutation.isError ? rejectSettlementMutation.error.message : null}
          isSettlementSubmitting={approveSettlementMutation.isPending || rejectSettlementMutation.isPending}
          canManageSettlements={canManageSettlements}
          onChangeTab={handleTabChange}
          onStartSettlementAction={startSettlementAction}
          onCancelSettlementAction={resetSettlementAction}
          onApprovedAmountChange={setApprovedAmount}
          onReviewRemarksChange={setReviewRemarks}
          onSubmitApprove={handleApproveSettlementSubmit}
          onSubmitReject={handleRejectSettlementSubmit}
          onClose={handleCloseModal}
        />
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

type CustomerFinanceTableRowProps = {
  customer: TenantMlsCustomerFinanceRow;
  isSelected: boolean;
  onOpenTab: (customerId: string, tab: CustomerFinanceTab) => void;
};

function CustomerFinanceTableRow({ customer, isSelected, onOpenTab }: CustomerFinanceTableRowProps) {
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
          <RecordTableActionButton onClick={() => onOpenTab(customer.customerId, "settlements")}>
            Settlements
          </RecordTableActionButton>
          <RecordTableActionButton onClick={() => onOpenTab(customer.customerId, "ledger")}>
            Ledger
          </RecordTableActionButton>
        </div>
      </td>
    </tr>
  );
}

type CustomerFinanceModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  activeTab: CustomerFinanceTab;
  selectedCustomer: TenantMlsCustomerFinanceRow | null | undefined;
  latestLoanLabel: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  detail: TenantMlsCustomerFinanceDetailResponse | null;
  settlementActionKey: string | null;
  settlementAction: SettlementAction;
  approvedAmount: string;
  reviewRemarks: string;
  approveErrorMessage: string | null;
  rejectErrorMessage: string | null;
  isSettlementSubmitting: boolean;
  canManageSettlements: boolean;
  onChangeTab: (tab: CustomerFinanceTab) => void;
  onStartSettlementAction: (submission: TenantMlsInvoicePaymentSubmissionRow, action: Exclude<SettlementAction, null>) => void;
  onCancelSettlementAction: () => void;
  onApprovedAmountChange: (value: string) => void;
  onReviewRemarksChange: (value: string) => void;
  onSubmitApprove: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitReject: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

function CustomerFinanceModal({
  open,
  title,
  eyebrow,
  activeTab,
  selectedCustomer,
  latestLoanLabel,
  isLoading,
  isError,
  errorMessage,
  detail,
  settlementActionKey,
  settlementAction,
  approvedAmount,
  reviewRemarks,
  approveErrorMessage,
  rejectErrorMessage,
  isSettlementSubmitting,
  canManageSettlements,
  onChangeTab,
  onStartSettlementAction,
  onCancelSettlementAction,
  onApprovedAmountChange,
  onReviewRemarksChange,
  onSubmitApprove,
  onSubmitReject,
  onClose
}: CustomerFinanceModalProps) {
  const tabs: Array<{ key: CustomerFinanceTab; label: string }> = [
    { key: "profile", label: "Profile" },
    { key: "loans", label: "Loans" },
    { key: "settlements", label: "Settlements" },
    { key: "ledger", label: "Ledger" }
  ];

  return (
    <RecordSurfaceModal
      open={open}
      title={title}
      eyebrow={eyebrow}
      description={selectedCustomer ? `${selectedCustomer.customerCode} / ${selectedCustomer.outstandingBalance > 0 ? "With open balance" : "Settled customer"}` : undefined}
      tabs={tabs}
      activeTabKey={activeTab}
      onTabChange={(tabKey) => onChangeTab(tabKey as CustomerFinanceTab)}
      maxWidthClassName="max-w-[min(88rem,calc(100vw-3rem))]"
      onClose={onClose}
    >
      {isLoading ? <WorkspaceNotice>Loading customer finance detail...</WorkspaceNotice> : null}
      {isError ? (
        <WorkspaceNotice tone="error">
          {errorMessage ?? "Unable to load this customer's finance detail right now."}
        </WorkspaceNotice>
      ) : null}

      {!isLoading && !isError && !detail ? (
        <WorkspaceEmptyState>Select a customer record to inspect profile, loans, settlements, or ledger detail.</WorkspaceEmptyState>
      ) : null}

      {!isLoading && !isError && detail ? (
        <div className="h-full min-h-0 overflow-y-auto pr-1">
          {activeTab === "profile" ? (
            <CustomerProfileTab customer={detail.customer} latestLoanLabel={latestLoanLabel} serviceInvoices={detail.serviceInvoices} />
          ) : null}
          {activeTab === "loans" ? <CustomerLoansTab detail={detail} /> : null}
          {activeTab === "settlements" ? (
            <CustomerSettlementsTab
              detail={detail}
              settlementActionKey={settlementActionKey}
              settlementAction={settlementAction}
              approvedAmount={approvedAmount}
              reviewRemarks={reviewRemarks}
              approveErrorMessage={approveErrorMessage}
              rejectErrorMessage={rejectErrorMessage}
              isSettlementSubmitting={isSettlementSubmitting}
              canManageSettlements={canManageSettlements}
              onStartSettlementAction={onStartSettlementAction}
              onCancelSettlementAction={onCancelSettlementAction}
              onApprovedAmountChange={onApprovedAmountChange}
              onReviewRemarksChange={onReviewRemarksChange}
              onSubmitApprove={onSubmitApprove}
              onSubmitReject={onSubmitReject}
            />
          ) : null}
          {activeTab === "ledger" ? <CustomerLedgerTab detail={detail} /> : null}
        </div>
      ) : null}
    </RecordSurfaceModal>
  );
}

type CustomerProfileTabProps = {
  customer: TenantMlsCustomerFinanceRow;
  latestLoanLabel: string | null;
  serviceInvoices: TenantMlsCustomerServiceInvoiceRow[];
};

function CustomerProfileTab({ customer, latestLoanLabel, serviceInvoices }: CustomerProfileTabProps) {
  const openInvoiceCount = serviceInvoices.filter((invoice) => invoice.outstandingAmount > 0).length;
  const pendingReviewCount = serviceInvoices
    .flatMap((invoice) => invoice.paymentSubmissions)
    .filter((submission) => isManualSettlementPending(submission.status))
    .length;

  return (
    <div className="grid auto-rows-max gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Profile" title="Customer finance summary" />

          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-4">
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Customer profile</p>
                <h3 className="mt-1 text-xl font-semibold text-base-content">{customer.customerName}</h3>
                <p className="text-sm text-base-content/65">{customer.customerCode}</p>
              </div>
              <WorkspaceStatusPill tone={customer.outstandingBalance > 0 ? "warning" : "active"}>
                {customer.outstandingBalance > 0 ? "With Open Balance" : "Settled"}
              </WorkspaceStatusPill>
            </div>

            {latestLoanLabel ? (
              <WorkspaceNotice>
                Latest loan account: {latestLoanLabel}
              </WorkspaceNotice>
            ) : (
              <WorkspaceNotice>
                This customer currently has no loan account rows. Service invoice settlements may still be active.
              </WorkspaceNotice>
            )}
          </div>
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Position" title="Collection posture" />

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Outstanding" value={formatCurrency(customer.outstandingBalance)} description="Current unpaid exposure across service invoices and loan accounts." />
            <MetricCard label="Collected" value={formatCurrency(customer.totalCollectedAmount)} description="Approved collections currently retained against this customer." />
            <MetricCard label="Open invoices" value={String(openInvoiceCount)} description="Service invoices that still have a balance awaiting settlement or finance action." />
            <MetricCard label="Pending reviews" value={String(pendingReviewCount)} description="Customer-submitted settlement proofs waiting for MLS finance review." />
          </div>
        </WorkspacePanel>
      </div>
    </div>
  );
}

type CustomerLoansTabProps = {
  detail: TenantMlsCustomerFinanceDetailResponse;
};

function CustomerLoansTab({ detail }: CustomerLoansTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Loans" title="Customer loan accounts" />

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
            No loan rows are attached to the selected customer yet.
          </WorkspaceEmptyState>
        )}
      </WorkspacePanel>
    </div>
  );
}

type CustomerSettlementsTabProps = {
  detail: TenantMlsCustomerFinanceDetailResponse;
  settlementActionKey: string | null;
  settlementAction: SettlementAction;
  approvedAmount: string;
  reviewRemarks: string;
  approveErrorMessage: string | null;
  rejectErrorMessage: string | null;
  isSettlementSubmitting: boolean;
  canManageSettlements: boolean;
  onStartSettlementAction: (submission: TenantMlsInvoicePaymentSubmissionRow, action: Exclude<SettlementAction, null>) => void;
  onCancelSettlementAction: () => void;
  onApprovedAmountChange: (value: string) => void;
  onReviewRemarksChange: (value: string) => void;
  onSubmitApprove: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitReject: (event: FormEvent<HTMLFormElement>) => void;
};

function CustomerSettlementsTab({
  detail,
  settlementActionKey,
  settlementAction,
  approvedAmount,
  reviewRemarks,
  approveErrorMessage,
  rejectErrorMessage,
  isSettlementSubmitting,
  canManageSettlements,
  onStartSettlementAction,
  onCancelSettlementAction,
  onApprovedAmountChange,
  onReviewRemarksChange,
  onSubmitApprove,
  onSubmitReject
}: CustomerSettlementsTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Settlements" title="Service invoice settlement review" />

        {detail.serviceInvoices.length ? (
          <div className="grid gap-4">
            {detail.serviceInvoices.map((invoice) => (
              <article key={invoice.invoiceId} className="grid gap-4 rounded-box border border-base-300/70 bg-base-100 px-4 py-4 shadow-[0_10px_24px_rgba(35,46,76,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{invoice.invoiceNumber}</p>
                    <h3 className="mt-1 text-lg font-semibold text-base-content">
                      {invoice.serviceRequestNumber ?? "Standalone service invoice"}
                    </h3>
                    <p className="text-sm text-base-content/65">
                      Issued {formatDateTime(invoice.invoiceDateUtc)}
                    </p>
                  </div>
                  <WorkspaceStatusPill tone={getFinanceTone(invoice.invoiceStatus)}>
                    {invoice.invoiceStatus}
                  </WorkspaceStatusPill>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Total" value={formatCurrency(invoice.totalAmount)} description="Finalized invoice total for this service work." />
                  <MetricCard label="Outstanding" value={formatCurrency(invoice.outstandingAmount)} description="Remaining balance after approved settlements." />
                  <MetricCard label="Finance mode" value={invoice.hasMicroLoan ? "MLS loan" : "Direct settlement"} description={invoice.hasMicroLoan ? `Loan status: ${invoice.microLoanStatus ?? "In review"}` : "Customer proof submissions and finance approval happen here."} />
                </div>

                {invoice.paymentSubmissions.length ? (
                  <div className="grid gap-3">
                    {invoice.paymentSubmissions.map((submission) => {
                      const submissionActionKey = buildSettlementActionKey(submission.submissionId);
                      const isActiveApproval = settlementActionKey === submissionActionKey && settlementAction === "approve";
                      const isActiveRejection = settlementActionKey === submissionActionKey && settlementAction === "reject";

                      return (
                        <article key={submission.submissionId} className="rounded-box border border-base-300/70 bg-base-200/28 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-base-content">{formatCurrency(submission.amountSubmitted)} submitted</p>
                              <p className="mt-1 text-sm text-base-content/65">
                                {submission.paymentMethod} / {submission.referenceNumber}
                              </p>
                            </div>
                            <WorkspaceStatusPill tone={getFinanceTone(submission.status)}>
                              {submission.status}
                            </WorkspaceStatusPill>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-base-content/70">
                            <p>Submitted {formatDateTime(submission.submittedAtUtc)}</p>
                            {submission.approvedAmount != null ? (
                              <p className="text-base-content">Approved amount: {formatCurrency(submission.approvedAmount)}</p>
                            ) : null}
                            {submission.reviewedAtUtc ? (
                              <p>Reviewed {formatDateTime(submission.reviewedAtUtc)}{submission.reviewedByUserName ? ` by ${submission.reviewedByUserName}` : ""}</p>
                            ) : null}
                            {submission.note ? <p>{submission.note}</p> : null}
                            {submission.reviewRemarks ? (
                              <p className="rounded-box border border-base-300/70 bg-base-100 px-3 py-3 text-base-content/78">
                                {submission.reviewRemarks}
                              </p>
                            ) : null}
                            {submission.proofRelativeUrl ? (
                              <a
                                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                                href={submission.proofRelativeUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open {submission.proofOriginalFileName ?? "payment proof"}
                              </a>
                            ) : null}
                          </div>

                          {isManualSettlementPending(submission.status) && !invoice.hasMicroLoan ? (
                            <div className="mt-4 grid gap-3">
                              {!isActiveApproval && !isActiveRejection ? (
                                <div className="flex flex-wrap gap-2">
                                  <WorkspaceActionButton
                                    onClick={() => onStartSettlementAction(submission, "approve")}
                                    disabled={!canManageSettlements}
                                    title={!canManageSettlements ? "Requires mls.settlements.manage." : undefined}
                                  >
                                    Approve
                                  </WorkspaceActionButton>
                                  <WorkspaceActionButton
                                    onClick={() => onStartSettlementAction(submission, "reject")}
                                    disabled={!canManageSettlements}
                                    title={!canManageSettlements ? "Requires mls.settlements.manage." : undefined}
                                  >
                                    Reject
                                  </WorkspaceActionButton>
                                </div>
                              ) : null}

                              {isActiveApproval ? (
                                <WorkspaceForm onSubmit={onSubmitApprove} className="rounded-box border border-base-300/70 bg-base-100 px-4 py-4">
                                  <WorkspaceNotice>
                                    Approve the amount that should be applied to this invoice. Add remarks when approving less than the submitted amount.
                                  </WorkspaceNotice>

                                  <WorkspaceFieldGrid>
                                    <WorkspaceField label="Approved amount">
                                      <WorkspaceInput
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={approvedAmount}
                                        onChange={(event) => onApprovedAmountChange(event.target.value)}
                                        required
                                      />
                                    </WorkspaceField>
                                    <WorkspaceField label="Review remarks">
                                      <WorkspaceInput
                                        value={reviewRemarks}
                                        onChange={(event) => onReviewRemarksChange(event.target.value)}
                                        placeholder="Optional unless amount differs from the submitted amount"
                                      />
                                    </WorkspaceField>
                                  </WorkspaceFieldGrid>

                                  {approveErrorMessage ? (
                                    <p className="text-sm text-error">{approveErrorMessage}</p>
                                  ) : null}

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <WorkspaceModalButton onClick={onCancelSettlementAction} disabled={isSettlementSubmitting}>
                                      Cancel
                                    </WorkspaceModalButton>
                                    <WorkspaceModalButton type="submit" tone="primary" disabled={isSettlementSubmitting || !canManageSettlements}>
                                      {isSettlementSubmitting ? "Approving..." : "Approve settlement"}
                                    </WorkspaceModalButton>
                                  </div>
                                </WorkspaceForm>
                              ) : null}

                              {isActiveRejection ? (
                                <WorkspaceForm onSubmit={onSubmitReject} className="rounded-box border border-base-300/70 bg-base-100 px-4 py-4">
                                  <WorkspaceNotice>
                                    Explain why this proof is being rejected so the customer can resubmit with the correct evidence.
                                  </WorkspaceNotice>

                                  <WorkspaceFieldGrid className="md:grid-cols-1">
                                    <WorkspaceField label="Review remarks" wide={true}>
                                      <WorkspaceInput
                                        value={reviewRemarks}
                                        onChange={(event) => onReviewRemarksChange(event.target.value)}
                                        placeholder="Reason for rejection"
                                        required
                                      />
                                    </WorkspaceField>
                                  </WorkspaceFieldGrid>

                                  {rejectErrorMessage ? (
                                    <p className="text-sm text-error">{rejectErrorMessage}</p>
                                  ) : null}

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <WorkspaceModalButton onClick={onCancelSettlementAction} disabled={isSettlementSubmitting}>
                                      Cancel
                                    </WorkspaceModalButton>
                                    <WorkspaceModalButton type="submit" tone="danger" disabled={isSettlementSubmitting || !canManageSettlements}>
                                      {isSettlementSubmitting ? "Rejecting..." : "Reject settlement"}
                                    </WorkspaceModalButton>
                                  </div>
                                </WorkspaceForm>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <WorkspaceEmptyState>
                    No customer settlement proofs have been submitted for this invoice yet.
                  </WorkspaceEmptyState>
                )}
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceEmptyState>
            No service invoices are attached to this customer yet.
          </WorkspaceEmptyState>
        )}
      </WorkspacePanel>
    </div>
  );
}

type CustomerLedgerTabProps = {
  detail: TenantMlsCustomerFinanceDetailResponse;
};

function CustomerLedgerTab({ detail }: CustomerLedgerTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Ledger" title="Customer finance history" />

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
            Finance transactions for the selected customer will appear here after loan creation or payment posting.
          </WorkspaceEmptyState>
        )}
      </WorkspacePanel>
    </div>
  );
}
