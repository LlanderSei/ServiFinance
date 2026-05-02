import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsStandaloneLoanCreatedResponse,
  TenantMlsStandaloneLoanCustomer,
  TenantMlsStandaloneLoanPreviewResponse,
  TenantMlsStandaloneLoanWorkspaceResponse
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
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
  WorkspaceNotice
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

function getDefaultLoanStartDate() {
  return new Date().toISOString().slice(0, 10);
}

export function MlsStandaloneLoanPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [principalAmount, setPrincipalAmount] = useState("10000");
  const [annualInterestRate, setAnnualInterestRate] = useState("18");
  const [termMonths, setTermMonths] = useState("6");
  const [loanStartDate, setLoanStartDate] = useState(getDefaultLoanStartDate());
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-standalone-loans"],
    queryFn: () => httpGet<TenantMlsStandaloneLoanWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/standalone-loans`),
    enabled: Boolean(tenantDomainSlug)
  });

  const selectedCustomer = useMemo(
    () => workspaceQuery.data?.customers.find((customer) => customer.customerId === selectedCustomerId) ?? null,
    [selectedCustomerId, workspaceQuery.data]
  );

  const previewQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-standalone-preview", selectedCustomerId, principalAmount, annualInterestRate, termMonths, loanStartDate],
    queryFn: () => httpGet<TenantMlsStandaloneLoanPreviewResponse>(
      `/api/tenants/${tenantDomainSlug}/mls/standalone-loans/preview?customerId=${encodeURIComponent(selectedCustomerId)}&principalAmount=${encodeURIComponent(principalAmount)}&annualInterestRate=${encodeURIComponent(annualInterestRate)}&termMonths=${encodeURIComponent(termMonths)}&loanStartDate=${encodeURIComponent(loanStartDate)}`
    ),
    enabled: Boolean(isModalOpen && tenantDomainSlug && selectedCustomerId && principalAmount && annualInterestRate && termMonths && loanStartDate)
  });

  const createMutation = useMutation({
    mutationFn: () => httpPostJson<TenantMlsStandaloneLoanCreatedResponse, {
      customerId: string;
      principalAmount: number;
      annualInterestRate: number;
      termMonths: number;
      loanStartDate: string;
      referenceNumber: string | null;
      remarks: string | null;
    }>(`/api/tenants/${tenantDomainSlug}/mls/standalone-loans`, {
      customerId: selectedCustomerId,
      principalAmount: Number(principalAmount),
      annualInterestRate: Number(annualInterestRate),
      termMonths: Number(termMonths),
      loanStartDate,
      referenceNumber: referenceNumber.trim() || null,
      remarks: remarks.trim() || null
    }),
    onSuccess: (payload) => {
      toast.success({
        title: "Standalone loan created",
        message: `${payload.customerName} now has a standalone MLS loan record.`
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-standalone-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"] });
      setIsModalOpen(false);
      setSelectedCustomerId("");
      setReferenceNumber("");
      setRemarks("");
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to create standalone loan",
        message: error.message
      });
    }
  });

  const metrics = useMemo(() => {
    const customers = workspaceQuery.data?.customers ?? [];
    const proposedPrincipal = Number(principalAmount || "0");

    return {
      customerCount: customers.length,
      proposedPrincipal,
      proposedRepayable: previewQuery.data?.summary.totalRepayableAmount ?? 0,
      averagePrincipal: customers.length ? proposedPrincipal / customers.length : 0
    };
  }, [principalAmount, previewQuery.data, workspaceQuery.data]);

  function openLoanModal(customerId: string) {
    setSelectedCustomerId(customerId);
    setIsModalOpen(true);
  }

  function closeLoanModal() {
    setIsModalOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Standalone Loans`}
        title="Standalone loan processing"
        description="Review tenant borrowers, then open a standalone loan modal to configure terms and create a new MLS loan without an SMS invoice handoff."
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {workspaceQuery.isLoading ? <WorkspaceNotice>Loading standalone-loan borrowers...</WorkspaceNotice> : null}
              {workspaceQuery.isError ? (
                <WorkspaceNotice tone="error">
                  {getApiErrorMessage(workspaceQuery.error, "Unable to load tenant borrowers for standalone loan processing right now.")}
                </WorkspaceNotice>
              ) : null}

              <MetricCard label="Eligible customers" value={String(metrics.customerCount)} description="Existing tenant customers available for standalone loan onboarding." />
              <MetricCard label="Proposed principal" value={formatCurrency(metrics.proposedPrincipal)} description="Principal amount currently configured for the standalone-loan modal." />
              <MetricCard label="Projected repayable" value={formatCurrency(metrics.proposedRepayable)} description="Previewed total repayable amount for the current standalone terms." />
              <MetricCard label="Average principal" value={formatCurrency(metrics.averagePrincipal)} description="Current principal benchmark based on the configured standalone amount." />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <WorkspacePanelHeader eyebrow="Borrowers" title="Standalone loan candidates" />

              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-3">
                  <div className="grid gap-0.5">
                    <strong className="text-sm text-base-content">Borrower-first standalone flow</strong>
                    <span className="text-sm text-base-content/65">
                      Open a borrower from the table to configure standalone terms and review the amortization schedule inside a modal.
                    </span>
                  </div>
                </div>

                <RecordTableShell className="min-h-0 flex-1">
                  <RecordTable className="min-w-[54rem]">
                    <thead>
                      <tr>
                        <th>Customer code</th>
                        <th>Name</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.isLoading ? (
                      <RecordTableStateRow colSpan={3}>Loading tenant borrowers...</RecordTableStateRow>
                    ) : workspaceQuery.isError ? (
                      <RecordTableStateRow colSpan={3} tone="error">
                          {getApiErrorMessage(workspaceQuery.error, "Unable to load tenant borrowers right now.")}
                      </RecordTableStateRow>
                    ) : workspaceQuery.data?.customers.length ? (
                        workspaceQuery.data.customers.map((customer) => (
                          <BorrowerRow
                            key={customer.customerId}
                            customer={customer}
                            onOpen={openLoanModal}
                          />
                        ))
                      ) : (
                        <RecordTableStateRow colSpan={3}>
                          No tenant customers exist yet. Create a customer record in SMS first, then return here to issue a standalone loan.
                        </RecordTableStateRow>
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </div>
            </WorkspacePanel>
          </section>
        </div>

        <StandaloneLoanModal
          open={isModalOpen}
          tenantDomainSlug={tenantDomainSlug}
          selectedCustomer={selectedCustomer}
          preview={previewQuery.data ?? null}
          principalAmount={principalAmount}
          annualInterestRate={annualInterestRate}
          termMonths={termMonths}
          loanStartDate={loanStartDate}
          referenceNumber={referenceNumber}
          remarks={remarks}
          isPreviewLoading={previewQuery.isLoading}
          isPreviewError={previewQuery.isError}
          previewErrorMessage={getApiErrorMessage(previewQuery.error, "The standalone loan preview could not be generated for the current setup.")}
          isSubmitting={createMutation.isPending}
          onPrincipalAmountChange={setPrincipalAmount}
          onAnnualInterestRateChange={setAnnualInterestRate}
          onTermMonthsChange={setTermMonths}
          onLoanStartDateChange={setLoanStartDate}
          onReferenceNumberChange={setReferenceNumber}
          onRemarksChange={setRemarks}
          onClose={closeLoanModal}
          onSubmit={handleSubmit}
        />
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

type BorrowerRowProps = {
  customer: TenantMlsStandaloneLoanCustomer;
  onOpen: (customerId: string) => void;
};

function BorrowerRow({ customer, onOpen }: BorrowerRowProps) {
  return (
    <tr>
      <td>{customer.customerCode}</td>
      <td>{customer.customerName}</td>
      <td>
        <RecordTableActionButton onClick={() => onOpen(customer.customerId)}>
          Create Standalone Loan
        </RecordTableActionButton>
      </td>
    </tr>
  );
}

type StandaloneLoanModalProps = {
  open: boolean;
  tenantDomainSlug: string;
  selectedCustomer: TenantMlsStandaloneLoanCustomer | null;
  preview: TenantMlsStandaloneLoanPreviewResponse | null;
  principalAmount: string;
  annualInterestRate: string;
  termMonths: string;
  loanStartDate: string;
  referenceNumber: string;
  remarks: string;
  isPreviewLoading: boolean;
  isPreviewError: boolean;
  previewErrorMessage?: string;
  isSubmitting: boolean;
  onPrincipalAmountChange: (value: string) => void;
  onAnnualInterestRateChange: (value: string) => void;
  onTermMonthsChange: (value: string) => void;
  onLoanStartDateChange: (value: string) => void;
  onReferenceNumberChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function StandaloneLoanModal({
  open,
  tenantDomainSlug,
  selectedCustomer,
  preview,
  principalAmount,
  annualInterestRate,
  termMonths,
  loanStartDate,
  referenceNumber,
  remarks,
  isPreviewLoading,
  isPreviewError,
  previewErrorMessage,
  isSubmitting,
  onPrincipalAmountChange,
  onAnnualInterestRateChange,
  onTermMonthsChange,
  onLoanStartDateChange,
  onReferenceNumberChange,
  onRemarksChange,
  onClose,
  onSubmit
}: StandaloneLoanModalProps) {
  return (
    <RecordSurfaceModal
      open={open}
      title={selectedCustomer ? `Standalone loan for ${selectedCustomer.customerCode}` : "Standalone loan"}
      eyebrow={`${tenantDomainSlug} / MLS / Standalone Loans`}
      description={selectedCustomer ? `${selectedCustomer.customerName} / ${selectedCustomer.customerCode}` : "Select a borrower from the table to start a standalone loan."}
      maxWidthClassName="max-w-[min(96rem,calc(100vw-2rem))]"
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            tone="primary"
            type="submit"
            form="mls-standalone-loan-modal-form"
            disabled={!selectedCustomer || !preview || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Standalone Loan"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <form id="mls-standalone-loan-modal-form" className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]" onSubmit={onSubmit}>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <WorkspacePanel className="h-full min-h-0 overflow-hidden">
            <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
              <WorkspacePanelHeader eyebrow="Amortization" title="Standalone repayment schedule" />

              <div className="grid auto-rows-max gap-3">
                {isPreviewLoading ? <WorkspaceNotice>Generating standalone-loan preview...</WorkspaceNotice> : null}
                {isPreviewError ? (
                  <WorkspaceNotice tone="error">
                    {previewErrorMessage ?? "The standalone loan preview could not be generated for the current setup."}
                  </WorkspaceNotice>
                ) : null}

                {!selectedCustomer && !isPreviewLoading && !isPreviewError ? (
                  <WorkspaceEmptyState>
                    Select a borrower from the standalone loan table to generate the amortization schedule.
                  </WorkspaceEmptyState>
                ) : null}
              </div>

              {preview?.schedule.length ? (
                <WorkspaceSubtableShell className="min-h-0 !overflow-y-auto">
                  <WorkspaceSubtable className="min-w-[64rem]">
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
                      {preview.schedule.map((row) => (
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
                <div />
              )}
            </div>
          </WorkspacePanel>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid auto-rows-max gap-4">
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Standalone setup" title="Loan terms and preview" />

              <WorkspaceForm className="gap-4">
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Principal amount" wide>
                    <WorkspaceInput type="number" min="0.01" step="0.01" value={principalAmount} onChange={(event) => onPrincipalAmountChange(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Annual interest rate (%)" wide>
                    <WorkspaceInput type="number" min="0" max="120" step="0.01" value={annualInterestRate} onChange={(event) => onAnnualInterestRateChange(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Term months" wide>
                    <WorkspaceInput type="number" min="1" max="60" step="1" value={termMonths} onChange={(event) => onTermMonthsChange(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Loan start date" wide>
                    <WorkspaceInput type="date" value={loanStartDate} onChange={(event) => onLoanStartDateChange(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Reference number" wide>
                    <WorkspaceInput value={referenceNumber} onChange={(event) => onReferenceNumberChange(event.target.value)} />
                  </WorkspaceField>
                  <WorkspaceField label="Remarks" wide>
                    <WorkspaceInput value={remarks} onChange={(event) => onRemarksChange(event.target.value)} />
                  </WorkspaceField>
                </WorkspaceFieldGrid>
              </WorkspaceForm>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Borrower" title="Selected finance record" />

              {selectedCustomer ? (
                <div className="grid gap-4">
                  <div className="grid gap-1.5 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-4">
                    <div className="grid gap-1">
                      <strong className="text-lg text-base-content">{selectedCustomer.customerCode}</strong>
                      <span className="text-sm text-base-content/65">{selectedCustomer.customerName}</span>
                    </div>
                  </div>

                  {preview ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <MetricCard label="Principal" value={formatCurrency(preview.summary.principalAmount)} description="Standalone principal to be released to the borrower." />
                      <MetricCard label="Monthly installment" value={formatCurrency(preview.summary.monthlyInstallment)} description="Fixed monthly repayment amount for this standalone loan." />
                      <MetricCard label="Total interest" value={formatCurrency(preview.summary.totalInterestAmount)} description="Interest generated by the selected standalone term and rate." />
                      <MetricCard label="Maturity date" value={preview.summary.maturityDate} description="Last due date for the standalone schedule." />
                    </div>
                  ) : (
                    <WorkspaceEmptyState>
                      The standalone loan summary will appear here after the preview finishes loading.
                    </WorkspaceEmptyState>
                  )}
                </div>
              ) : (
                <WorkspaceEmptyState>
                  Select a borrower from the table to configure standalone loan terms.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </div>
        </div>
      </form>
    </RecordSurfaceModal>
  );
}
