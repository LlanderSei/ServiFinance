import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TenantMlsAuditWorkspaceResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";

function buildAuditQueryString(actionType: string) {
  return actionType ? `?actionType=${encodeURIComponent(actionType)}` : "";
}

function getAuditTone(actionType: string) {
  if (actionType === "LoanPayment") {
    return "active" as const;
  }

  if (actionType === "StandaloneLoanCreation") {
    return "progress" as const;
  }

  return "warning" as const;
}

export function MlsAuditPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const [actionType, setActionType] = useState("");

  const auditQueryString = useMemo(() => buildAuditQueryString(actionType), [actionType]);
  const auditQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-audit", actionType],
    queryFn: () => httpGet<TenantMlsAuditWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/audit${auditQueryString}`),
    enabled: Boolean(tenantDomainSlug)
  });

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Audit Review`}
        title="Finance audit review"
        description="Inspect recent MLS loan creation and payment activity with operator attribution and traceable finance references."
      >
        <WorkspaceScrollStack>
          {auditQuery.isLoading ? <WorkspaceNotice>Loading MLS audit activity...</WorkspaceNotice> : null}
          {auditQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load MLS audit events right now.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-4">
            <MetricCard label="Audit events" value={String(auditQuery.data?.summary.totalEvents ?? 0)} description="Recent MLS finance actions currently visible in the audit feed." />
            <MetricCard label="Invoice loan creation" value={String(auditQuery.data?.summary.loanCreationEvents ?? 0)} description="Loan records created from SMS invoice handoff." />
            <MetricCard label="Standalone loans" value={String(auditQuery.data?.summary.standaloneLoanEvents ?? 0)} description="Loans created directly in MLS without invoice linkage." />
            <MetricCard label="Payments posted" value={String(auditQuery.data?.summary.paymentEvents ?? 0)} description="Collection or payment actions posted back into the loan ledger." />
          </WorkspaceMetricGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader
              eyebrow="Filters"
              title="Audit action type"
              actions={(
                <WorkspaceActionButton onClick={() => setActionType("")}>
                  Clear filter
                </WorkspaceActionButton>
              )}
            />

            <WorkspaceFieldGrid>
              <WorkspaceField label="Action type">
                <WorkspaceSelect value={actionType} onChange={(event) => setActionType(event.target.value)}>
                  <option value="">All audit actions</option>
                  <option value="LoanCreation">Loan creation</option>
                  <option value="StandaloneLoanCreation">Standalone loan creation</option>
                  <option value="LoanPayment">Loan payment</option>
                </WorkspaceSelect>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspacePanel>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Timeline" title="Recent MLS finance events" />

            {auditQuery.data?.events.length ? (
              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Borrower</th>
                      <th>Subject</th>
                      <th>Reference</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQuery.data.events.map((event) => (
                      <tr key={event.eventId}>
                        <td>{new Date(event.occurredAtUtc).toLocaleString("en-PH")}</td>
                        <td>
                          <WorkspaceStatusPill tone={getAuditTone(event.actionType)}>
                            {event.actionType}
                          </WorkspaceStatusPill>
                        </td>
                        <td>{event.actorName}</td>
                        <td>{event.customerName}</td>
                        <td>{event.subjectLabel}</td>
                        <td>{event.referenceLabel}</td>
                        <td>{event.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            ) : (
              <WorkspaceEmptyState>
                No MLS audit events match the current filter.
              </WorkspaceEmptyState>
            )}
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
