import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsLoanAccountsWorkspaceResponse,
  TenantMlsLoanDetailResponse,
  TenantMlsLoanPaymentPostedResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
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
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

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

export function MlsLoanAccountsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";

  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getDefaultPaymentDate());
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loans"],
    queryFn: () => httpGet<TenantMlsLoanAccountsWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loans`),
    enabled: Boolean(tenantDomainSlug)
  });

  useEffect(() => {
    if (!selectedLoanId && workspaceQuery.data?.loans[0]) {
      setSelectedLoanId(workspaceQuery.data.loans[0].microLoanId);
    }
  }, [selectedLoanId, workspaceQuery.data]);

  const detailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-detail", selectedLoanId],
    queryFn: () => httpGet<TenantMlsLoanDetailResponse>(`/api/tenants/${tenantDomainSlug}/mls/loans/${selectedLoanId}`),
    enabled: Boolean(tenantDomainSlug && selectedLoanId)
  });

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
    paidBalance: workspaceQuery.data?.loans.reduce((sum, item) => sum + item.totalPaidAmount, 0) ?? 0
  }), [workspaceQuery.data]);

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
        description="Review customer loan balances, inspect amortization status, and post loan payments from the desktop MLS terminal."
      >
        <WorkspaceScrollStack>
          <WorkspaceMetricGrid className="2xl:grid-cols-3">
            <MetricCard label="Active loan accounts" value={String(metrics.loanCount)} description="Loan records currently managed from the MLS desktop workspace." />
            <MetricCard label="Outstanding balance" value={formatCurrency(metrics.outstandingBalance)} description="Remaining repayable balance across all tenant loan accounts." />
            <MetricCard label="Collected to date" value={formatCurrency(metrics.paidBalance)} description="Payments already posted against the current MLS loan portfolio." />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Loan portfolio" title="Customer financial records" />

              {workspaceQuery.data?.loans.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Invoice</th>
                        <th>Outstanding</th>
                        <th>Next due</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.data.loans.map((loan) => (
                        <tr key={loan.microLoanId}>
                          <td>{loan.customerName}</td>
                          <td>{loan.invoiceNumber}</td>
                          <td>{formatCurrency(loan.outstandingBalance)}</td>
                          <td>{loan.nextDueDate ?? "Settled"}</td>
                          <td>
                            <WorkspaceStatusPill tone={loan.loanStatus === "Paid" ? "active" : "warning"}>
                              {loan.loanStatus}
                            </WorkspaceStatusPill>
                          </td>
                          <td>
                            <WorkspaceActionButton onClick={() => setSelectedLoanId(loan.microLoanId)}>
                              {loan.microLoanId === selectedLoanId ? "Selected" : "Open"}
                            </WorkspaceActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No loan accounts are available yet. Create a micro-loan from the MLS loan-conversion workspace first.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Payment posting" title="Apply payment to selected loan" />

              <WorkspaceForm onSubmit={handleSubmit}>
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Amount">
                    <WorkspaceInput type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Payment date">
                    <WorkspaceInput type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Reference number">
                    <WorkspaceInput value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
                  </WorkspaceField>
                  <WorkspaceField label="Remarks">
                    <WorkspaceInput value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                  </WorkspaceField>
                </WorkspaceFieldGrid>

                {detailQuery.isLoading ? <WorkspaceNotice>Loading selected loan account...</WorkspaceNotice> : null}
                {detailQuery.isError ? (
                  <WorkspaceNotice tone="error">
                    Unable to load the selected loan account details right now.
                  </WorkspaceNotice>
                ) : null}

                {detailQuery.data ? (
                  <div className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/30 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Selected borrower</p>
                        <h3 className="mt-1 text-lg font-semibold text-base-content">{detailQuery.data.loan.customerName}</h3>
                        <p className="text-sm text-base-content/65">{detailQuery.data.loan.invoiceNumber}</p>
                      </div>
                      <WorkspaceStatusPill tone={detailQuery.data.loan.loanStatus === "Paid" ? "active" : "warning"}>
                        {detailQuery.data.loan.loanStatus}
                      </WorkspaceStatusPill>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Outstanding" value={formatCurrency(detailQuery.data.loan.outstandingBalance)} description="Remaining balance after posted payments." />
                      <MetricCard label="Total paid" value={formatCurrency(detailQuery.data.loan.totalPaidAmount)} description="Cumulative payment amount applied to this loan." />
                      <MetricCard label="Pending installments" value={String(detailQuery.data.loan.pendingInstallments)} description="Installments that still require payment allocation." />
                      <MetricCard label="Next due date" value={detailQuery.data.loan.nextDueDate ?? "Settled"} description="Upcoming installment due date for this loan account." />
                    </div>

                    <div className="flex justify-end">
                      <WorkspaceActionButton type="submit" disabled={paymentMutation.isPending || !selectedLoanId}>
                        {paymentMutation.isPending ? "Posting payment..." : "Post Payment"}
                      </WorkspaceActionButton>
                    </div>
                  </div>
                ) : (
                  <WorkspaceEmptyState>
                    Select a loan account from the portfolio table to review it and post a payment.
                  </WorkspaceEmptyState>
                )}
              </WorkspaceForm>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Amortization" title="Installment progress" />

              {detailQuery.data?.schedule.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
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
                      {detailQuery.data.schedule.map((row) => (
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
                  Installment rows will appear here once a loan account is selected.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Ledger" title="Recent loan transactions" />

              {detailQuery.data?.ledger.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.ledger.map((row) => (
                        <tr key={row.transactionId}>
                          <td>{row.transactionDateUtc.slice(0, 10)}</td>
                          <td>{row.transactionType}</td>
                          <td>{row.referenceNumber}</td>
                          <td>{formatCurrency(row.debitAmount)}</td>
                          <td>{formatCurrency(row.creditAmount)}</td>
                          <td>{formatCurrency(row.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  Loan creation and payment ledger entries will appear here for the selected record.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
