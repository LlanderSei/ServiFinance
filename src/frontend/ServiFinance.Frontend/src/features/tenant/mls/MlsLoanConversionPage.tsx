import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsLoanConversionPreviewResponse,
  TenantMlsLoanConversionWorkspaceResponse,
  TenantMlsLoanCreatedResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
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
import { MetricCard } from "@/shared/records/MetricCard";
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
  const [annualInterestRate, setAnnualInterestRate] = useState("18");
  const [termMonths, setTermMonths] = useState("6");
  const [loanStartDate, setLoanStartDate] = useState(getDefaultLoanStartDate());

  const workspaceQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-conversion"],
    queryFn: () => httpGet<TenantMlsLoanConversionWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loan-conversion`),
    enabled: Boolean(tenantDomainSlug)
  });

  useEffect(() => {
    if (!selectedInvoiceId && workspaceQuery.data?.candidates[0]) {
      setSelectedInvoiceId(workspaceQuery.data.candidates[0].invoiceId);
    }
  }, [selectedInvoiceId, workspaceQuery.data]);

  const previewQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-preview", selectedInvoiceId, annualInterestRate, termMonths, loanStartDate],
    queryFn: () => httpGet<TenantMlsLoanConversionPreviewResponse>(
      `/api/tenants/${tenantDomainSlug}/mls/loan-conversion/${selectedInvoiceId}/preview?annualInterestRate=${encodeURIComponent(annualInterestRate)}&termMonths=${encodeURIComponent(termMonths)}&loanStartDate=${encodeURIComponent(loanStartDate)}`
    ),
    enabled: Boolean(tenantDomainSlug && selectedInvoiceId && annualInterestRate && termMonths && loanStartDate)
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
      setSelectedInvoiceId("");
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to create micro-loan",
        message: error.message
      });
    }
  });

  const preview = previewQuery.data;
  const queueMetrics = useMemo(() => ({
    candidateCount: workspaceQuery.data?.candidates.length ?? 0,
    totalExposure: workspaceQuery.data?.candidates.reduce((sum, item) => sum + item.outstandingAmount, 0) ?? 0
  }), [workspaceQuery.data]);

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
        description="Select a finance-ready invoice, preview the amortization schedule, and create a micro-loan inside the desktop MLS workspace."
      >
        <WorkspaceScrollStack>
          {workspaceQuery.isLoading ? <WorkspaceNotice>Loading finance-ready invoices...</WorkspaceNotice> : null}
          {workspaceQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load the loan-conversion workspace right now. Refresh the desktop session and try again.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-3">
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
              label="Default term"
              value={`${termMonths || "0"} months`}
              description="The active amortization preview uses the term configured in the loan setup panel."
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Finance queue" title="Convertible invoices" />

              {workspaceQuery.data?.candidates.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Request</th>
                        <th>Outstanding</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.data.candidates.map((candidate) => {
                        const isSelected = candidate.invoiceId === selectedInvoiceId;
                        return (
                          <tr key={candidate.invoiceId}>
                            <td>
                              <div className="grid gap-1">
                                <strong>{candidate.invoiceNumber}</strong>
                                <span className="text-xs text-base-content/60">{formatDate(candidate.invoiceDateUtc)}</span>
                              </div>
                            </td>
                            <td>{candidate.customerName}</td>
                            <td>{candidate.requestNumber}</td>
                            <td>
                              <div className="grid gap-1">
                                <strong>{formatCurrency(candidate.outstandingAmount)}</strong>
                                <span className="text-xs text-base-content/60">
                                  Interestable {formatCurrency(candidate.interestableAmount)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <WorkspaceActionButton onClick={() => setSelectedInvoiceId(candidate.invoiceId)}>
                                {isSelected ? "Selected" : "Preview"}
                              </WorkspaceActionButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No invoices are currently ready for loan conversion. Finalize more service invoices in SMS to open the next MLS finance queue.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Loan setup" title="Conversion preview" />

              <WorkspaceForm onSubmit={handleCreateLoan}>
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Annual interest rate (%)">
                    <WorkspaceInput
                      type="number"
                      min="0"
                      max="120"
                      step="0.01"
                      value={annualInterestRate}
                      onChange={(event) => setAnnualInterestRate(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Term months">
                    <WorkspaceInput
                      type="number"
                      min="1"
                      max="60"
                      step="1"
                      value={termMonths}
                      onChange={(event) => setTermMonths(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Loan start date" wide>
                    <WorkspaceInput
                      type="date"
                      value={loanStartDate}
                      onChange={(event) => setLoanStartDate(event.target.value)}
                      required
                    />
                  </WorkspaceField>
                </WorkspaceFieldGrid>

                {previewQuery.isLoading ? <WorkspaceNotice>Generating amortization preview...</WorkspaceNotice> : null}
                {previewQuery.isError ? (
                  <WorkspaceNotice tone="error">
                    The loan preview could not be generated for the current term setup.
                  </WorkspaceNotice>
                ) : null}

                {preview ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/30 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Selected invoice</p>
                          <h3 className="mt-1 text-lg font-semibold text-base-content">{preview.invoice.invoiceNumber}</h3>
                          <p className="text-sm text-base-content/65">{preview.invoice.customerName} / {preview.invoice.requestNumber}</p>
                        </div>
                        <WorkspaceStatusPill tone="warning">Ready to convert</WorkspaceStatusPill>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Principal" value={formatCurrency(preview.summary.principalAmount)} description="Opening loan principal pulled from invoice outstanding amount." />
                        <MetricCard label="Monthly installment" value={formatCurrency(preview.summary.monthlyInstallment)} description="Fixed installment amount with last-row rounding adjustment." />
                        <MetricCard label="Total interest" value={formatCurrency(preview.summary.totalInterestAmount)} description="Interest produced by the selected rate and term combination." />
                        <MetricCard label="Maturity date" value={preview.summary.maturityDate} description="Last expected installment due date." />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <WorkspaceActionButton type="submit" disabled={createMutation.isPending || !selectedInvoiceId}>
                        {createMutation.isPending ? "Creating loan..." : "Create Micro-Loan"}
                      </WorkspaceActionButton>
                    </div>
                  </div>
                ) : (
                  <WorkspaceEmptyState>
                    Select an invoice from the finance queue to generate a loan preview and amortization schedule.
                  </WorkspaceEmptyState>
                )}
              </WorkspaceForm>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Amortization" title="Installment schedule preview" />

            {preview?.schedule.length ? (
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
              <WorkspaceEmptyState>
                The amortization schedule will appear here after a finance-ready invoice is selected.
              </WorkspaceEmptyState>
            )}
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
