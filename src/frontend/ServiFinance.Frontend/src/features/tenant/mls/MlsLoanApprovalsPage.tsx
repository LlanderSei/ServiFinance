import { useQuery } from "@tanstack/react-query";
import type { TenantMlsLoanApprovalWorkspaceResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceKpiRailLayout, WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";
import { WorkspaceInlineNote, WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getApprovalTone(state: string) {
  switch (state) {
    case "Ready for approval":
      return "warning" as const;
    case "Payment review required":
      return "progress" as const;
    case "Blocked":
      return "inactive" as const;
    case "Released":
      return "active" as const;
    default:
      return "neutral" as const;
  }
}

export function MlsLoanApprovalsPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const approvalsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-approvals"],
    queryFn: () => httpGet<TenantMlsLoanApprovalWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loan-approvals`),
    enabled: Boolean(tenantDomainSlug)
  });
  const summary = approvalsQuery.data?.summary;
  const rows = approvalsQuery.data?.rows ?? [];

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.loan-approvals.view"
      requireModule={MlsModuleCodes.loanApprovalWorkflow}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Approvals`}
        title="Loan approvals"
        description="Review finance-ready service invoices, payment-review blockers, and released standalone loans before a future maker-checker approval workflow is persisted."
        recordCount={summary?.needsReview ?? 0}
        singularLabel="review item"
      >
        <RecordContentStack className="overflow-hidden">
          {approvalsQuery.isLoading ? <WorkspaceNotice>Loading loan approval readiness...</WorkspaceNotice> : null}
          {approvalsQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(approvalsQuery.error, "Unable to load loan approval controls right now.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceNotice>
            Approval persistence is intentionally not introduced in this slice. This page surfaces readiness, blockers, and release-control signals from the current invoice and loan model.
          </WorkspaceNotice>

          <WorkspaceKpiRailLayout
            contentClassName="overflow-hidden"
            kpis={(
              <>
                <MetricCard label="Ready candidates" value={summary?.serviceLinkedCandidates ?? 0} description="Service invoices ready for approval before loan conversion." />
                <MetricCard label="Needs review" value={summary?.needsReview ?? 0} description="Rows that need approval or payment-review attention." />
                <MetricCard label="Blocked" value={summary?.blockedCandidates ?? 0} description="Candidates blocked by checkout, settlement, status, or balance rules." />
                <MetricCard label="Standalone released" value={summary?.standaloneLoansCreated ?? 0} description="Recently released standalone loans in the desktop finance surface." />
                <MetricCard label="Average candidate" value={formatCurrency(summary?.averageCandidateAmount ?? 0)} description="Average amount across service-linked candidates currently ready for approval." />
              </>
            )}
          >
            <RecordScrollRegion>
              <WorkspacePanel className="min-h-[28rem]">
                <WorkspacePanelHeader
                  eyebrow="Approval queue"
                  title="Readiness and release-control review"
                  actions={<WorkspaceInlineNote>{rows.length} visible rows</WorkspaceInlineNote>}
                />

                <RecordTableShell>
                  <RecordTable>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Source</th>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>State</th>
                        <th>Risk flag</th>
                        <th>Reason</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalsQuery.isLoading ? (
                        <RecordTableStateRow colSpan={8}>Loading approval rows...</RecordTableStateRow>
                      ) : rows.length === 0 ? (
                        <RecordTableStateRow colSpan={8}>No approval readiness rows are available right now.</RecordTableStateRow>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.candidateId}>
                            <td>{row.customerName}</td>
                            <td>
                              <div className="grid gap-1">
                                <strong>{row.sourceType}</strong>
                                <span className="text-xs text-base-content/60">{row.serviceRequestNumber}</span>
                              </div>
                            </td>
                            <td>{row.invoiceNumber}</td>
                            <td>{formatCurrency(row.amount)}</td>
                            <td>
                              <WorkspaceStatusPill tone={getApprovalTone(row.readinessState)}>{row.readinessState}</WorkspaceStatusPill>
                            </td>
                            <td>{row.riskFlag}</td>
                            <td className="max-w-[22rem]">{row.reason}</td>
                            <td>{formatDate(row.createdAtUtc)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </WorkspacePanel>
            </RecordScrollRegion>
          </WorkspaceKpiRailLayout>
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

export default MlsLoanApprovalsPage;
