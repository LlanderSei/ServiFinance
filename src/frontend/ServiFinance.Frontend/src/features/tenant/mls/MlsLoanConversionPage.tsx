import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsLoanConversionCandidate,
  TenantMlsLoanConversionPreviewResponse,
  TenantMlsLoanConversionWorkspaceResponse,
  TenantMlsLoanCreatedResponse
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
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormatter.format(date);
}

function getDefaultLoanStartDate() {
  return new Date().toISOString().slice(0, 10);
}

export function MlsLoanConversionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [annualInterestRate, setAnnualInterestRate] = useState("18");
  const [termMonths, setTermMonths] = useState("6");
  const [loanStartDate, setLoanStartDate] = useState(getDefaultLoanStartDate());

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-conversion"],
    queryFn: () => httpGet<TenantMlsLoanConversionWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loan-conversion`),
    enabled: Boolean(tenantDomainSlug)
  });

  const selectedInvoice = useMemo(
    () => workspaceQuery.data?.candidates.find((candidate) => candidate.invoiceId === selectedInvoiceId) ?? null,
    [selectedInvoiceId, workspaceQuery.data]
  );

  const previewQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-preview", selectedInvoiceId, annualInterestRate, termMonths, loanStartDate],
    queryFn: () => httpGet<TenantMlsLoanConversionPreviewResponse>(
      `/api/tenants/${tenantDomainSlug}/mls/loan-conversion/${selectedInvoiceId}/preview?annualInterestRate=${encodeURIComponent(annualInterestRate)}&termMonths=${encodeURIComponent(termMonths)}&loanStartDate=${encodeURIComponent(loanStartDate)}`
    ),
    enabled: Boolean(isModalOpen && tenantDomainSlug && selectedInvoiceId && annualInterestRate && termMonths && loanStartDate)
  });

  const createMutation = useMutation({
    mutationFn: () => httpPostJson<TenantMlsLoanCreatedResponse, {
      invoiceId: string;
      annualInterestRate: number;
      termMonths: number;
      loanStartDate: string;
    }>(`/api/tenants/${tenantDomainSlug}/mls/loan-conversion`, {
      invoiceId: selectedInvoiceId,
      annualInterestRate: Number(annualInterestRate),
      termMonths: Number(termMonths),
      loanStartDate
    }),
    onSuccess: (payload) => {
      toast.success({
        title: "Micro-loan created",
        message: `${payload.customerName} is now enrolled under invoice ${payload.invoiceNumber}.`
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loan-conversion"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loans"] });
      setIsModalOpen(false);
      setSelectedInvoiceId("");
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to create micro-loan",
        message: error.message
      });
    }
  });

  const queueMetrics = useMemo(() => {
    const candidates = workspaceQuery.data?.candidates ?? [];
    const totalExposure = candidates.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const averageExposure = candidates.length ? totalExposure / candidates.length : 0;

    return {
      candidateCount: candidates.length,
      totalExposure,
      averageExposure
    };
  }, [workspaceQuery.data]);

  function openConversionModal(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
    setIsModalOpen(true);
  }

  function closeConversionModal() {
    setIsModalOpen(false);
  }

  function handleCreateLoan(event: FormEvent<HTMLFormElement>) {
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
        breadcrumbs={`${tenantDomainSlug} / MLS / Loan Conversion`}
        title="Invoice-to-loan conversion"
        description="Review finance-ready invoices, then open a conversion modal to configure loan terms and inspect the amortization schedule."
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {workspaceQuery.isLoading ? <WorkspaceNotice>Loading finance-ready invoices...</WorkspaceNotice> : null}
              {workspaceQuery.isError ? (
                <WorkspaceNotice tone="error">
                  {getApiErrorMessage(workspaceQuery.error, "Unable to load the loan-conversion workspace right now. Refresh the desktop session and try again.")}
                </WorkspaceNotice>
              ) : null}

              <MetricCard
                label="Finance-ready invoices"
                value={String(queueMetrics.candidateCount)}
                description="Finalized invoices that still qualify for MLS conversion."
              />
              <MetricCard
                label="Convertible exposure"
                value={formatCurrency(queueMetrics.totalExposure)}
                description="Outstanding invoice value currently available for micro-loan onboarding."
              />
              <MetricCard
                label="Average ticket"
                value={formatCurrency(queueMetrics.averageExposure)}
                description="Typical finance-ready invoice balance currently waiting in the queue."
              />
              <MetricCard
                label="Default term"
                value={`${termMonths || "0"} months`}
                description="The conversion modal starts from the configured loan term and rate."
              />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <WorkspacePanelHeader
                eyebrow="Finance queue"
                title="Convertible invoices"
              />

              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-3">
                  <div className="grid gap-0.5">
                    <strong className="text-sm text-base-content">Queue-first conversion workflow</strong>
                    <span className="text-sm text-base-content/65">
                      Open an invoice from the queue to configure terms and confirm loan conversion inside a dedicated modal.
                    </span>
                  </div>
                </div>

                <RecordTableShell className="min-h-0 flex-1">
                  <RecordTable className="min-w-[74rem]">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Request</th>
                        <th>Invoice date</th>
                        <th>Outstanding</th>
                        <th>Interestable</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.isLoading ? (
                      <RecordTableStateRow colSpan={7}>Loading finance-ready invoices...</RecordTableStateRow>
                    ) : workspaceQuery.isError ? (
                      <RecordTableStateRow colSpan={7} tone="error">
                          {getApiErrorMessage(workspaceQuery.error, "Unable to load finance-ready invoices right now.")}
                      </RecordTableStateRow>
                    ) : workspaceQuery.data?.candidates.length ? (
                        workspaceQuery.data.candidates.map((candidate) => (
                          <ConvertibleInvoiceRow
                            key={candidate.invoiceId}
                            candidate={candidate}
                            onConvert={openConversionModal}
                          />
                        ))
                      ) : (
                        <RecordTableStateRow colSpan={7}>
                          No invoices are currently ready for loan conversion. Finalize more service invoices in SMS to open the next MLS finance queue.
                        </RecordTableStateRow>
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </div>
            </WorkspacePanel>
          </section>
        </div>

        <LoanConversionModal
          open={isModalOpen}
          tenantDomainSlug={tenantDomainSlug}
          selectedInvoice={selectedInvoice}
          preview={previewQuery.data ?? null}
          annualInterestRate={annualInterestRate}
          termMonths={termMonths}
          loanStartDate={loanStartDate}
          isPreviewLoading={previewQuery.isLoading}
          isPreviewError={previewQuery.isError}
          previewErrorMessage={getApiErrorMessage(previewQuery.error, "The loan preview could not be generated for the current term setup.")}
          isSubmitting={createMutation.isPending}
          onAnnualInterestRateChange={setAnnualInterestRate}
          onTermMonthsChange={setTermMonths}
          onLoanStartDateChange={setLoanStartDate}
          onClose={closeConversionModal}
          onSubmit={handleCreateLoan}
        />
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

type ConvertibleInvoiceRowProps = {
  candidate: TenantMlsLoanConversionCandidate;
  onConvert: (invoiceId: string) => void;
};

function ConvertibleInvoiceRow({ candidate, onConvert }: ConvertibleInvoiceRowProps) {
  return (
    <tr>
      <td>
        <div className="grid gap-1">
          <strong>{candidate.invoiceNumber}</strong>
          <span className="text-xs text-base-content/60">{formatDate(candidate.invoiceDateUtc)}</span>
        </div>
      </td>
      <td>{candidate.customerName}</td>
      <td>{candidate.requestNumber}</td>
      <td>{formatDate(candidate.invoiceDateUtc)}</td>
      <td>{formatCurrency(candidate.outstandingAmount)}</td>
      <td>{formatCurrency(candidate.interestableAmount)}</td>
      <td>
        <RecordTableActionButton onClick={() => onConvert(candidate.invoiceId)}>
          Convert
        </RecordTableActionButton>
      </td>
    </tr>
  );
}

type LoanConversionModalProps = {
  open: boolean;
  tenantDomainSlug: string;
  selectedInvoice: TenantMlsLoanConversionCandidate | null;
  preview: TenantMlsLoanConversionPreviewResponse | null;
  annualInterestRate: string;
  termMonths: string;
  loanStartDate: string;
  isPreviewLoading: boolean;
  isPreviewError: boolean;
  previewErrorMessage?: string;
  isSubmitting: boolean;
  onAnnualInterestRateChange: (value: string) => void;
  onTermMonthsChange: (value: string) => void;
  onLoanStartDateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function LoanConversionModal({
  open,
  tenantDomainSlug,
  selectedInvoice,
  preview,
  annualInterestRate,
  termMonths,
  loanStartDate,
  isPreviewLoading,
  isPreviewError,
  previewErrorMessage,
  isSubmitting,
  onAnnualInterestRateChange,
  onTermMonthsChange,
  onLoanStartDateChange,
  onClose,
  onSubmit
}: LoanConversionModalProps) {
  return (
    <RecordSurfaceModal
      open={open}
      title={selectedInvoice ? `Convert ${selectedInvoice.invoiceNumber}` : "Loan conversion"}
      eyebrow={`${tenantDomainSlug} / MLS / Loan Conversion`}
      description={selectedInvoice ? `${selectedInvoice.customerName} • ${selectedInvoice.requestNumber}` : "Select a finance-ready invoice from the queue to start loan conversion."}
      maxWidthClassName="max-w-[min(96rem,calc(100vw-2rem))]"
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            tone="primary"
            type="submit"
            form="mls-loan-conversion-modal-form"
            disabled={!selectedInvoice || !preview || isSubmitting}
          >
            {isSubmitting ? "Confirming..." : "Confirm Conversion"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <form id="mls-loan-conversion-modal-form" className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]" onSubmit={onSubmit}>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <WorkspacePanel className="h-full min-h-0 overflow-hidden">
            <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
              <WorkspacePanelHeader eyebrow="Amortization" title="Installment schedule preview" />

              <div className="grid auto-rows-max gap-3">
                {isPreviewLoading ? <WorkspaceNotice>Generating amortization preview...</WorkspaceNotice> : null}
                {isPreviewError ? (
                  <WorkspaceNotice tone="error">
                    {previewErrorMessage ?? "The loan preview could not be generated for the current term setup."}
                  </WorkspaceNotice>
                ) : null}

                {!selectedInvoice && !isPreviewLoading && !isPreviewError ? (
                  <WorkspaceEmptyState>
                    Select an invoice from the finance queue to generate the amortization schedule.
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
              <WorkspacePanelHeader eyebrow="Loan setup" title="Conversion terms" />

              <WorkspaceForm className="gap-4">
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Annual interest rate (%)" wide>
                    <WorkspaceInput
                      type="number"
                      min="0"
                      max="120"
                      step="0.01"
                      value={annualInterestRate}
                      onChange={(event) => onAnnualInterestRateChange(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Term months" wide>
                    <WorkspaceInput
                      type="number"
                      min="1"
                      max="60"
                      step="1"
                      value={termMonths}
                      onChange={(event) => onTermMonthsChange(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Loan start date" wide>
                    <WorkspaceInput
                      type="date"
                      value={loanStartDate}
                      onChange={(event) => onLoanStartDateChange(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                </WorkspaceFieldGrid>
              </WorkspaceForm>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Invoice" title="Selected finance record" />

              {selectedInvoice ? (
                <div className="grid gap-4">
                  <div className="grid gap-1.5 rounded-box border border-base-300/65 bg-base-200/42 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <strong className="text-lg text-base-content">{selectedInvoice.invoiceNumber}</strong>
                        <span className="text-sm text-base-content/65">{selectedInvoice.customerName}</span>
                        <span className="text-sm text-base-content/60">{selectedInvoice.requestNumber}</span>
                      </div>
                      <WorkspaceStatusPill tone="warning">Ready to convert</WorkspaceStatusPill>
                    </div>
                    <div className="grid gap-1 text-sm text-base-content/70">
                      <span>Invoice date: {formatDate(selectedInvoice.invoiceDateUtc)}</span>
                      <span>Outstanding: {formatCurrency(selectedInvoice.outstandingAmount)}</span>
                      <span>Interestable: {formatCurrency(selectedInvoice.interestableAmount)}</span>
                    </div>
                  </div>

                  {preview ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <MetricCard label="Principal" value={formatCurrency(preview.summary.principalAmount)} description="Opening principal pulled from the invoice balance." />
                      <MetricCard label="Monthly installment" value={formatCurrency(preview.summary.monthlyInstallment)} description="Fixed monthly payment based on the selected term." />
                      <MetricCard label="Total interest" value={formatCurrency(preview.summary.totalInterestAmount)} description="Interest generated by the selected conversion terms." />
                      <MetricCard label="Maturity date" value={preview.summary.maturityDate} description="Final installment due date for the converted loan." />
                    </div>
                  ) : (
                    <WorkspaceEmptyState>
                      The conversion summary will appear here after the preview finishes loading.
                    </WorkspaceEmptyState>
                  )}
                </div>
              ) : (
                <WorkspaceEmptyState>
                  Select a finance-ready invoice from the queue to configure conversion terms.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>
          </div>
        </div>
      </form>
    </RecordSurfaceModal>
  );
}
