import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { TenantSmsSlaEscalationsResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import { WorkspaceKpiRailLayout, WorkspacePanel, WorkspacePanelHeader, WorkspaceTenantCell } from "@/shared/records/WorkspacePanel";

export function SmsSlaEscalationsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const slaQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-sla-escalations"],
    queryFn: () => httpGet<TenantSmsSlaEscalationsResponse>(`/api/tenants/${tenantDomainSlug}/sms/sla-escalations`)
  });

  const summary = slaQuery.data?.summary;
  const rows = slaQuery.data?.rows ?? [];

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / SMS / SLA Escalations`}
      title="SLA escalations"
      description="Track overdue service windows, due-today work, unscheduled requests, and escalation pressure for medium tenant operations."
      recordCount={summary?.overdueRequests ?? 0}
      singularLabel="overdue request"
    >
      <RecordContentStack>
        {slaQuery.isError ? (
          <WorkspaceNotice tone="error">Unable to load SLA escalation controls right now.</WorkspaceNotice>
        ) : null}

        <WorkspaceKpiRailLayout
          kpis={
            <>
              <MetricCard label="Active requests" value={summary?.activeRequests ?? 0} description="Open requests that can still breach service commitments." />
              <MetricCard label="Critical" value={summary?.criticalRequests ?? 0} description="Urgent priority or heavily overdue requests needing owner attention." />
              <MetricCard label="Overdue" value={summary?.overdueRequests ?? 0} description="Requests already past their target service date." />
              <MetricCard label="Due today" value={summary?.dueTodayRequests ?? 0} description="Requests that should be completed or scheduled today." />
              <MetricCard label="Unscheduled" value={summary?.unscheduledRequests ?? 0} description="Active requests without a current assignment record." />
            </>
          }
        >
          <WorkspacePanel className="min-h-0 flex-1">
            <WorkspacePanelHeader
              eyebrow="Escalation queue"
              title="Service windows that need intervention"
              actions={<WorkspaceStatusPill tone={summary?.criticalRequests ? "inactive" : "active"}>{summary?.criticalRequests ? "Action needed" : "Stable"}</WorkspaceStatusPill>}
            />

            <RecordTableShell>
              <RecordTable>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Priority</th>
                    <th>Target</th>
                    <th>Assignment</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {slaQuery.isLoading ? (
                    <RecordTableStateRow colSpan={5}>Loading SLA queue...</RecordTableStateRow>
                  ) : rows.length === 0 ? (
                    <RecordTableStateRow colSpan={5}>No SLA escalation pressure right now.</RecordTableStateRow>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <WorkspaceTenantCell
                            title={row.requestNumber}
                            subtitle={`${row.customerName} / ${row.itemType}`}
                          />
                        </td>
                        <td>{row.priority || "Normal"}</td>
                        <td>
                          <div className="grid gap-1">
                            <span>{formatDateTime(row.targetDateUtc)}</span>
                            <span className="text-xs text-base-content/60">{formatPastDue(row.minutesPastDue)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            <span>{row.assignedStaff ?? "Unassigned"}</span>
                            <span className="text-xs text-base-content/60">{row.latestAssignmentStatus ?? "No assignment"}</span>
                          </div>
                        </td>
                        <td>
                          <WorkspaceStatusPill tone={resolveSlaTone(row.severity)}>{row.severity}</WorkspaceStatusPill>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </RecordTable>
            </RecordTableShell>
          </WorkspacePanel>
        </WorkspaceKpiRailLayout>
      </RecordContentStack>
    </RecordWorkspace>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No target";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPastDue(minutesPastDue: number) {
  if (minutesPastDue <= 0) {
    return "Inside target window";
  }

  if (minutesPastDue < 60) {
    return `${minutesPastDue}m overdue`;
  }

  const hours = Math.floor(minutesPastDue / 60);
  if (hours < 24) {
    return `${hours}h overdue`;
  }

  return `${Math.floor(hours / 24)}d overdue`;
}

function resolveSlaTone(severity: string) {
  if (severity === "Critical" || severity === "Overdue") {
    return "inactive";
  }

  if (severity === "Due Today" || severity === "Watch") {
    return "warning";
  }

  return "active";
}

export default SmsSlaEscalationsPage;
