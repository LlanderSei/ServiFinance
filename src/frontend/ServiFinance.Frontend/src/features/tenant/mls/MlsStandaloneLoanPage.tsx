import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsStandaloneLoanCreatedResponse,
  TenantMlsStandaloneLoanPreviewResponse,
  TenantMlsStandaloneLoanWorkspaceResponse
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

  const [customerId, setCustomerId] = useState("");
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

  useEffect(() => {
    if (!customerId && workspaceQuery.data?.customers[0]) {
      setCustomerId(workspaceQuery.data.customers[0].customerId);
    }
  }, [customerId, workspaceQuery.data]);

  const previewQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-standalone-preview", customerId, principalAmount, annualInterestRate, termMonths, loanStartDate],
    queryFn: () => httpGet<TenantMlsStandaloneLoanPreviewResponse>(
      `/api/tenants/${tenantDomainSlug}/mls/standalone-loans/preview?customerId=${encodeURIComponent(customerId)}&principalAmount=${encodeURIComponent(principalAmount)}&annualInterestRate=${encodeURIComponent(annualInterestRate)}&termMonths=${encodeURIComponent(termMonths)}&loanStartDate=${encodeURIComponent(loanStartDate)}`
    ),
    enabled: Boolean(tenantDomainSlug && customerId && principalAmount && annualInterestRate && termMonths && loanStartDate)
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
      customerId,
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

  const metrics = useMemo(() => ({
    customerCount: workspaceQuery.data?.customers.length ?? 0,
    proposedPrincipal: Number(principalAmount || "0"),
    proposedRepayable: previewQuery.data?.summary.totalRepayableAmount ?? 0
  }), [principalAmount, previewQuery.data, workspaceQuery.data]);

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
        description="Create a micro-loan directly for a tenant customer without requiring an SMS invoice handoff."
      >
        <WorkspaceScrollStack>
          <WorkspaceMetricGrid className="2xl:grid-cols-3">
            <MetricCard label="Eligible customers" value={String(metrics.customerCount)} description="Existing tenant customers available for standalone loan onboarding." />
            <MetricCard label="Proposed principal" value={formatCurrency(metrics.proposedPrincipal)} description="Principal amount currently entered in the standalone loan setup form." />
            <MetricCard label="Projected repayable" value={formatCurrency(metrics.proposedRepayable)} description="Previewed total repayable amount for the current standalone terms." />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Borrower" title="Customer selection" />

              {workspaceQuery.data?.customers.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Customer code</th>
                        <th>Name</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceQuery.data.customers.map((customer) => (
                        <tr key={customer.customerId}>
                          <td>{customer.customerCode}</td>
                          <td>{customer.customerName}</td>
                          <td>
                            <WorkspaceActionButton onClick={() => setCustomerId(customer.customerId)}>
                              {customer.customerId === customerId ? "Selected" : "Use"}
                            </WorkspaceActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No tenant customers exist yet. Create a customer record in SMS first, then return here to issue a standalone loan.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Standalone setup" title="Loan terms and preview" />

              <WorkspaceForm onSubmit={handleSubmit}>
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Principal amount">
                    <WorkspaceInput type="number" min="0.01" step="0.01" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Annual interest rate (%)">
                    <WorkspaceInput type="number" min="0" max="120" step="0.01" value={annualInterestRate} onChange={(event) => setAnnualInterestRate(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Term months">
                    <WorkspaceInput type="number" min="1" max="60" step="1" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Loan start date">
                    <WorkspaceInput type="date" value={loanStartDate} onChange={(event) => setLoanStartDate(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Reference number">
                    <WorkspaceInput value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
                  </WorkspaceField>
                  <WorkspaceField label="Remarks">
                    <WorkspaceInput value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                  </WorkspaceField>
                </WorkspaceFieldGrid>

                {previewQuery.isLoading ? <WorkspaceNotice>Generating standalone-loan preview...</WorkspaceNotice> : null}
                {previewQuery.isError ? (
                  <WorkspaceNotice tone="error">
                    The standalone loan preview could not be generated for the current setup.
                  </WorkspaceNotice>
                ) : null}

                {previewQuery.data ? (
                  <div className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/30 px-4 py-4">
                    <p className="text-sm text-base-content/70">
                      Selected borrower: <strong>{previewQuery.data.customer.customerName}</strong> ({previewQuery.data.customer.customerCode})
                    </p>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Principal" value={formatCurrency(previewQuery.data.summary.principalAmount)} description="Standalone principal to be released to the borrower." />
                      <MetricCard label="Monthly installment" value={formatCurrency(previewQuery.data.summary.monthlyInstallment)} description="Fixed monthly repayment amount for this standalone loan." />
                      <MetricCard label="Total interest" value={formatCurrency(previewQuery.data.summary.totalInterestAmount)} description="Interest generated by the selected standalone term and rate." />
                      <MetricCard label="Maturity date" value={previewQuery.data.summary.maturityDate} description="Last due date for the standalone schedule." />
                    </div>

                    <div className="flex justify-end">
                      <WorkspaceActionButton type="submit" disabled={createMutation.isPending || !customerId}>
                        {createMutation.isPending ? "Creating standalone loan..." : "Create Standalone Loan"}
                      </WorkspaceActionButton>
                    </div>
                  </div>
                ) : (
                  <WorkspaceEmptyState>
                    Select a customer and enter the standalone loan terms to preview the amortization schedule.
                  </WorkspaceEmptyState>
                )}
              </WorkspaceForm>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Amortization" title="Standalone repayment schedule" />

            {previewQuery.data?.schedule.length ? (
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
                    {previewQuery.data.schedule.map((row) => (
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
                The standalone amortization schedule will appear here once a customer and term set are selected.
              </WorkspaceEmptyState>
            )}
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
