import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TenantMlsLoanApprovalWorkspaceResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes, hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceKpiRailLayout, WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";
import { WorkspaceInlineNote, WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

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
    case "Approved for release":
      return "active" as const;
    case "Approval request needed":
      return "neutral" as const;
    case "Rejected":
      return "inactive" as const;
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const currentUser = (currentSession ?? data)?.user ?? null;
  const tenantDomainSlug = currentUser?.tenantDomainSlug ?? "";
  const canManageApprovals = hasPermission(currentUser, "mls.loan-approvals.manage");
  const approvalsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-loan-approvals"],
    queryFn: () => httpGet<TenantMlsLoanApprovalWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/loan-approvals`),
    enabled: Boolean(tenantDomainSlug)
  });
  const summary = approvalsQuery.data?.summary;
  const rows = approvalsQuery.data?.rows ?? [];
  const reviewMutation = useMutation({
    mutationFn: ({ row, decision, remarks }: {
      row: TenantMlsLoanApprovalWorkspaceResponse["rows"][number];
      decision: "approve" | "reject";
      remarks: string | null;
    }) => {
      const collectionSegment = row.candidateKind === "standalone-loan"
        ? "standalone-loans"
        : "service-invoices";
      return httpPostJson<void, { remarks: string | null }>(
        `/api/tenants/${tenantDomainSlug}/mls/loan-approvals/${collectionSegment}/${row.candidateId}/${decision}`,
        { remarks }
      );
    },
    onSuccess: (_, variables) => {
      toast.success({
        title: variables.decision === "approve" ? "Approval recorded" : "Rejection recorded",
        message: variables.decision === "approve"
          ? "The loan request is now approved for release."
          : "The loan request has been rejected with review remarks."
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loan-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loan-conversion"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-standalone-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"] });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to review request",
        message: error.message
      });
    }
  });

  function approveRow(row: TenantMlsLoanApprovalWorkspaceResponse["rows"][number]) {
    if (!canManageApprovals) {
      toast.warning({
        title: "Permission required",
        message: "Approval review requires mls.loan-approvals.manage."
      });
      return;
    }

    reviewMutation.mutate({ row, decision: "approve", remarks: null });
  }

  function rejectRow(row: TenantMlsLoanApprovalWorkspaceResponse["rows"][number]) {
    if (!canManageApprovals) {
      toast.warning({
        title: "Permission required",
        message: "Approval review requires mls.loan-approvals.manage."
      });
      return;
    }

    const remarks = window.prompt("Review remarks for rejection");
    if (!remarks?.trim()) {
      toast.warning({
        title: "Rejection remarks required",
        message: "Add a concise reason so the maker knows what to fix."
      });
      return;
    }

    reviewMutation.mutate({ row, decision: "reject", remarks: remarks.trim() });
  }

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
        description="Review maker-submitted service-linked and standalone loan requests, then approve or reject them before MLS release."
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

          {!canManageApprovals ? (
            <WorkspaceNotice>
              You can view the approval queue. Approve and reject actions require mls.loan-approvals.manage.
            </WorkspaceNotice>
          ) : null}

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
                        <th>Review</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalsQuery.isLoading ? (
                        <RecordTableStateRow colSpan={9}>Loading approval rows...</RecordTableStateRow>
                      ) : rows.length === 0 ? (
                        <RecordTableStateRow colSpan={9}>No approval readiness rows are available right now.</RecordTableStateRow>
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
                            <td>
                              {row.canApprove || row.canReject ? (
                                <div className="inline-flex min-w-[9rem] justify-end gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-xs rounded-full btn-primary"
                                    disabled={!canManageApprovals || reviewMutation.isPending}
                                    onClick={() => approveRow(row)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs rounded-full btn-error btn-soft"
                                    disabled={!canManageApprovals || reviewMutation.isPending}
                                    onClick={() => rejectRow(row)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-base-content/55">
                                  {row.reviewedByUserName ? `Reviewed by ${row.reviewedByUserName}` : "No action"}
                                </span>
                              )}
                            </td>
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
