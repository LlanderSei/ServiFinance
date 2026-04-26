import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsLoanAccountRow,
  TenantMlsLoanAccountsWorkspaceResponse,
  TenantMlsLoanDetailResponse,
  TenantMlsLoanPaymentPostedResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
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
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

type LoanAccountsTab = "payment-posting" | "amortization" | "ledger";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getDefaultPaymentDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "Settled";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-PH");
}

export function MlsLoanAccountsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";

  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LoanAccountsTab>("payment-posting");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getDefaultPaymentDate());
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loans"],
    queryFn: () => httpGet<TenantMlsLoanAccountsWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loans`),
    enabled: Boolean(tenantDomainSlug)
  });

  const detailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-detail", selectedLoanId],
    queryFn: () => httpGet<TenantMlsLoanDetailResponse>(`/api/tenants/${tenantDomainSlug}/mls/loans/${selectedLoanId}`),
    enabled: Boolean(tenantDomainSlug && selectedLoanId && isModalOpen)
  });

  useEffect(() => {
    if (!selectedLoanId || !workspaceQuery.data?.loans.some((loan) => loan.microLoanId === selectedLoanId)) {
      return;
    }

    setPaymentAmount("");
    setPaymentDate(getDefaultPaymentDate());
    setReferenceNumber("");
    setRemarks("");
  }, [selectedLoanId, workspaceQuery.data]);

  const paymentMutation = useMutation({
    mutationFn: () => httpPostJson<TenantMlsLoanPaymentPostedResponse, {
      amount: number;
      paymentDate: string;
      referenceNumber: string | null;
      remarks: string | null;
    }>(`/api/tenants/${tenantDomainSlug}/mls/loans/${selectedLoanId}/payments`, {
      amount: Number(paymentAmount),
      paymentDate,
      referenceNumber: referenceNumber.trim() || null,
      remarks: remarks.trim() || null
    }),
    onSuccess: (payload) => {
      toast.success({
        title: "Payment posted",
        message: `Applied ${formatCurrency(payload.amountApplied)}. Outstanding balance is now ${formatCurrency(payload.outstandingBalance)}.`
      });
      setPaymentAmount("");
      setReferenceNumber("");
      setRemarks("");
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loan-detail", selectedLoanId] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customers"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"] });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to post payment",
        message: error.message
      });
    }
  });

  const metrics = useMemo(() => ({
    loanCount: workspaceQuery.data?.loans.length ?? 0,
    outstandingBalance: workspaceQuery.data?.loans.reduce((sum, item) => sum + item.outstandingBalance, 0) ?? 0,
    paidBalance: workspaceQuery.data?.loans.reduce((sum, item) => sum + item.totalPaidAmount, 0) ?? 0,
    activeLoanCount: workspaceQuery.data?.loans.filter((item) => item.loanStatus !== "Paid").length ?? 0
  }), [workspaceQuery.data]);

  function openLoanModal(loanId: string, tab: LoanAccountsTab) {
    setSelectedLoanId(loanId);
    setActiveTab(tab);
    setIsModalOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    paymentMutation.mutate();
  }

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Loan Accounts`}
        title="Loan accounts and payment posting"
        description="Review loan balances, open account detail in-place, and post MLS payments from the desktop terminal."
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {workspaceQuery.isLoading ? <WorkspaceNotice>Loading MLS loan accounts...</WorkspaceNotice> : null}
              {workspaceQuery.isError ? (
                <WorkspaceNotice tone="error">
                  Unable to load MLS loan accounts right now.
                </WorkspaceNotice>
              ) : null}

              <MetricCard label="Loan accounts" value={String(metrics.loanCount)} description="Loan records currently managed from the MLS desktop workspace." />
              <MetricCard label="Active loans" value={String(metrics.activeLoanCount)} description="Loan accounts that still require collection or balance monitoring." />
              <MetricCard label="Outstanding balance" value={formatCurrency(metrics.outstandingBalance)} description="Remaining repayable balance across all tenant loan accounts." />
              <MetricCard label="Collected to date" value={formatCurrency(metrics.paidBalance)} description="Payments already posted against the current MLS loan portfolio." />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <WorkspacePanelHeader eyebrow="Loan portfolio" title="Customer loan accounts" />

              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-3">
                  <div className="grid gap-0.5">
                    <strong className="text-sm text-base-content">Loan account workspace</strong>
                    <span className="text-sm text-base-content/65">
                      Payment posting, amortization review, and ledger inspection open inside a loan modal so the main workspace stays portfolio-focused.
                    </span>
                  </div>
                </div>

                <RecordTableShell className="min-h-0 flex-1">
                  <RecordTable className="min-w-[78rem]">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Loan</th>
                        <th>Principal</th>
                        <th>Outstanding</th>
                        <th>Total paid</th>
                        <th>Next due</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.isLoading ? (
                        <RecordTableStateRow colSpan={8}>Loading MLS loan portfolio...</RecordTableStateRow>
                      ) : workspaceQuery.isError ? (
                        <RecordTableStateRow colSpan={8} tone="error">
                          Unable to load the MLS loan portfolio.
                        </RecordTableStateRow>
                      ) : workspaceQuery.data?.loans.length ? (
                        workspaceQuery.data.loans.map((loan) => (
                          <LoanPortfolioRow
                            key={loan.microLoanId}
                            loan={loan}
                            isSelected={loan.microLoanId === selectedLoanId && isModalOpen}
                            onOpenTab={openLoanModal}
                          />
                        ))
                      ) : (
                        <RecordTableStateRow colSpan={8}>
                          No loan accounts are available yet. Create a micro-loan first to populate this portfolio.
                        </RecordTableStateRow>
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </div>
            </WorkspacePanel>
          </section>
        </div>

        <LoanAccountModal
          open={isModalOpen}
          tenantDomainSlug={tenantDomainSlug}
          activeTab={activeTab}
          selectedLoan={workspaceQuery.data?.loans.find((loan) => loan.microLoanId === selectedLoanId) ?? null}
          detail={detailQuery.data ?? null}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          paymentAmount={paymentAmount}
          paymentDate={paymentDate}
          referenceNumber={referenceNumber}
          remarks={remarks}
          isPosting={paymentMutation.isPending}
          onChangeTab={(tabKey) => setActiveTab(tabKey)}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          onPaymentAmountChange={setPaymentAmount}
          onPaymentDateChange={setPaymentDate}
          onReferenceNumberChange={setReferenceNumber}
          onRemarksChange={setRemarks}
        />
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

type LoanPortfolioRowProps = {
  loan: TenantMlsLoanAccountRow;
  isSelected: boolean;
  onOpenTab: (loanId: string, tab: LoanAccountsTab) => void;
};

function LoanPortfolioRow({ loan, isSelected, onOpenTab }: LoanPortfolioRowProps) {
  return (
    <tr className={isSelected ? "bg-primary/7" : undefined}>
      <td>{loan.customerName}</td>
      <td>{loan.invoiceNumber}</td>
      <td>{formatCurrency(loan.principalAmount)}</td>
      <td>{formatCurrency(loan.outstandingBalance)}</td>
      <td>{formatCurrency(loan.totalPaidAmount)}</td>
      <td>{loan.nextDueDate ?? "Settled"}</td>
      <td>
        <WorkspaceStatusPill tone={loan.loanStatus === "Paid" ? "active" : "warning"}>
          {loan.loanStatus}
        </WorkspaceStatusPill>
      </td>
      <td>
        <div className="flex flex-wrap gap-2">
          <RecordTableActionButton onClick={() => onOpenTab(loan.microLoanId, "payment-posting")}>
            Payment Posting
          </RecordTableActionButton>
          <RecordTableActionButton onClick={() => onOpenTab(loan.microLoanId, "amortization")}>
            Amortization
          </RecordTableActionButton>
          <RecordTableActionButton onClick={() => onOpenTab(loan.microLoanId, "ledger")}>
            Ledger
          </RecordTableActionButton>
        </div>
      </td>
    </tr>
  );
}

type LoanAccountModalProps = {
  open: boolean;
  tenantDomainSlug: string;
  activeTab: LoanAccountsTab;
  selectedLoan: TenantMlsLoanAccountRow | null;
  detail: TenantMlsLoanDetailResponse | null;
  isLoading: boolean;
  isError: boolean;
  paymentAmount: string;
  paymentDate: string;
  referenceNumber: string;
  remarks: string;
  isPosting: boolean;
  onChangeTab: (tab: LoanAccountsTab) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentDateChange: (value: string) => void;
  onReferenceNumberChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
};

function LoanAccountModal({
  open,
  tenantDomainSlug,
  activeTab,
  selectedLoan,
  detail,
  isLoading,
  isError,
  paymentAmount,
  paymentDate,
  referenceNumber,
  remarks,
  isPosting,
  onChangeTab,
  onClose,
  onSubmit,
  onPaymentAmountChange,
  onPaymentDateChange,
  onReferenceNumberChange,
  onRemarksChange
}: LoanAccountModalProps) {
  const tabs: Array<{ key: LoanAccountsTab; label: string }> = [
    { key: "payment-posting", label: "Payment Posting" },
    { key: "amortization", label: "Amortization" },
    { key: "ledger", label: "Ledger" }
  ];

  return (
    <RecordSurfaceModal
      open={open}
      title={selectedLoan ? selectedLoan.invoiceNumber : "Loan account"}
      eyebrow={`${tenantDomainSlug} / MLS / Loan Accounts`}
      description={selectedLoan ? `${selectedLoan.customerName} • ${selectedLoan.loanStatus}` : "Select a loan account from the portfolio to inspect and post activity."}
      tabs={tabs}
      activeTabKey={activeTab}
      onTabChange={(tabKey) => onChangeTab(tabKey as LoanAccountsTab)}
      maxWidthClassName="max-w-[min(80rem,calc(100vw-3rem))]"
      actions={activeTab === "payment-posting" ? (
        <WorkspaceModalButton
          type="submit"
          form="mls-loan-payment-form"
          tone="primary"
          disabled={isPosting || !selectedLoan}
        >
          {isPosting ? "Posting Payment..." : "Post Payment"}
        </WorkspaceModalButton>
      ) : undefined}
      onClose={onClose}
    >
      {isLoading ? <WorkspaceNotice>Loading loan account detail...</WorkspaceNotice> : null}
      {isError ? (
        <WorkspaceNotice tone="error">
          Unable to load this loan account right now.
        </WorkspaceNotice>
      ) : null}

      {!isLoading && !isError && !detail ? (
        <WorkspaceEmptyState>
          Select a loan account from the portfolio to inspect payment posting, amortization, or ledger detail.
        </WorkspaceEmptyState>
      ) : null}

      {!isLoading && !isError && detail ? (
        <div className="h-full min-h-0 overflow-y-auto pr-1">
          {activeTab === "payment-posting" ? (
            <LoanPaymentPostingTab
              detail={detail}
              paymentAmount={paymentAmount}
              paymentDate={paymentDate}
              referenceNumber={referenceNumber}
              remarks={remarks}
              onSubmit={onSubmit}
              onPaymentAmountChange={onPaymentAmountChange}
              onPaymentDateChange={onPaymentDateChange}
              onReferenceNumberChange={onReferenceNumberChange}
              onRemarksChange={onRemarksChange}
            />
          ) : null}
          {activeTab === "amortization" ? <LoanAmortizationTab detail={detail} /> : null}
          {activeTab === "ledger" ? <LoanLedgerTab detail={detail} /> : null}
        </div>
      ) : null}
    </RecordSurfaceModal>
  );
}

type LoanPaymentPostingTabProps = {
  detail: TenantMlsLoanDetailResponse;
  paymentAmount: string;
  paymentDate: string;
  referenceNumber: string;
  remarks: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentDateChange: (value: string) => void;
  onReferenceNumberChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
};

function LoanPaymentPostingTab({
  detail,
  paymentAmount,
  paymentDate,
  referenceNumber,
  remarks,
  onSubmit,
  onPaymentAmountChange,
  onPaymentDateChange,
  onReferenceNumberChange,
  onRemarksChange
}: LoanPaymentPostingTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Selected loan" title="Account summary" />

          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-4">
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Borrower</p>
                <h3 className="mt-1 text-xl font-semibold text-base-content">{detail.loan.customerName}</h3>
                <p className="text-sm text-base-content/65">{detail.loan.invoiceNumber}</p>
              </div>
              <WorkspaceStatusPill tone={detail.loan.loanStatus === "Paid" ? "active" : "warning"}>
                {detail.loan.loanStatus}
              </WorkspaceStatusPill>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Outstanding" value={formatCurrency(detail.loan.outstandingBalance)} description="Remaining balance after posted payments." />
              <MetricCard label="Total paid" value={formatCurrency(detail.loan.totalPaidAmount)} description="Cumulative posted payment amount for this loan." />
              <MetricCard label="Pending installments" value={String(detail.loan.pendingInstallments)} description="Installments still awaiting payment allocation." />
              <MetricCard label="Next due date" value={detail.loan.nextDueDate ?? "Settled"} description="Upcoming installment due date for this account." />
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Payment posting" title="Apply payment" />

          <WorkspaceForm id="mls-loan-payment-form" onSubmit={onSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Amount">
                <WorkspaceInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => onPaymentAmountChange(event.target.value)}
                  required
                />
              </WorkspaceField>
              <WorkspaceField label="Payment date">
                <WorkspaceInput
                  type="date"
                  value={paymentDate}
                  onChange={(event) => onPaymentDateChange(event.target.value)}
                  required
                />
              </WorkspaceField>
              <WorkspaceField label="Reference number">
                <WorkspaceInput
                  value={referenceNumber}
                  onChange={(event) => onReferenceNumberChange(event.target.value)}
                />
              </WorkspaceField>
              <WorkspaceField label="Remarks">
                <WorkspaceInput
                  value={remarks}
                  onChange={(event) => onRemarksChange(event.target.value)}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>

            <WorkspaceNotice>
              Payment posting allocates against unpaid installments in order and refreshes remaining balance immediately after save.
            </WorkspaceNotice>
          </WorkspaceForm>
        </WorkspacePanel>
      </div>
    </div>
  );
}

type LoanAmortizationTabProps = {
  detail: TenantMlsLoanDetailResponse;
};

function LoanAmortizationTab({ detail }: LoanAmortizationTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Amortization" title="Installment progress" />

        {detail.schedule.length ? (
          <WorkspaceSubtableShell className="max-h-[min(56vh,34rem)]">
            <WorkspaceSubtable className="min-w-[62rem]">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Due date</th>
                  <th>Beginning</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Installment</th>
                  <th>Ending</th>
                </tr>
              </thead>
              <tbody>
                {detail.schedule.map((row) => (
                  <tr key={row.installmentNumber}>
                    <td>{row.installmentNumber}</td>
                    <td>{row.dueDate}</td>
                    <td>{formatCurrency(row.beginningBalance)}</td>
                    <td>{formatCurrency(row.principalPortion)}</td>
                    <td>{formatCurrency(row.interestPortion)}</td>
                    <td>{formatCurrency(row.installmentAmount)}</td>
                    <td>{formatCurrency(row.endingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </WorkspaceSubtable>
          </WorkspaceSubtableShell>
        ) : (
          <WorkspaceEmptyState>
            No amortization schedule rows are available for this loan account yet.
          </WorkspaceEmptyState>
        )}
      </WorkspacePanel>
    </div>
  );
}

type LoanLedgerTabProps = {
  detail: TenantMlsLoanDetailResponse;
};

function LoanLedgerTab({ detail }: LoanLedgerTabProps) {
  return (
    <div className="grid auto-rows-max gap-4">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Ledger" title="Recent loan transactions" />

        {detail.ledger.length ? (
          <WorkspaceSubtableShell className="max-h-[min(56vh,34rem)]">
            <WorkspaceSubtable className="min-w-[62rem]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {detail.ledger.map((row) => (
                  <tr key={row.transactionId}>
                    <td>{row.transactionDateUtc.slice(0, 10)}</td>
                    <td>{row.transactionType}</td>
                    <td>{row.referenceNumber}</td>
                    <td>{formatCurrency(row.debitAmount)}</td>
                    <td>{formatCurrency(row.creditAmount)}</td>
                    <td>{formatCurrency(row.runningBalance)}</td>
                    <td>{row.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </WorkspaceSubtable>
          </WorkspaceSubtableShell>
        ) : (
          <WorkspaceEmptyState>
            Loan creation and payment ledger entries will appear here for this account.
          </WorkspaceEmptyState>
        )}
      </WorkspacePanel>
    </div>
  );
}
