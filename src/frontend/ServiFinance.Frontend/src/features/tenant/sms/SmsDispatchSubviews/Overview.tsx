import { useMemo } from "react";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceMetricGrid } from "@/shared/records/WorkspacePanel";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceStatusPill, WorkspaceActionButton } from "@/shared/records/WorkspaceControls";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";

interface OverviewProps {
  assignments: TenantDispatchAssignmentRow[];
  isLoading: boolean;
  isError: boolean;
  currentUserId: string | null;
  viewMode: string;
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  canCancelAssignment: (assignment: TenantDispatchAssignmentRow) => boolean;
  canHandoverAssignment: (assignment: TenantDispatchAssignmentRow) => boolean;
  canAbandonAssignment: (assignment: TenantDispatchAssignmentRow) => boolean;
  openCancelModal: (assignment: TenantDispatchAssignmentRow) => void;
  openHandoverModal: (assignment: TenantDispatchAssignmentRow) => void;
  openAbandonModal: (assignment: TenantDispatchAssignmentRow) => void;
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
}

export function SmsDispatchOverview({
  assignments,
  isLoading,
  isError,
  currentUserId,
  viewMode,
  onSelectAssignment,
  canCancelAssignment,
  canHandoverAssignment,
  canAbandonAssignment,
  openCancelModal,
  openHandoverModal,
  openAbandonModal,
  formatDateTime,
  getFinanceTone
}: OverviewProps) {
  const summary = useMemo(() => {
    return {
      pendingAcceptance: assignments.filter((a) => a.assignmentStatus === "Pending Acceptance").length,
      scheduled: assignments.filter((a) => a.assignmentStatus === "Scheduled").length,
      inProgress: assignments.filter((a) => a.assignmentStatus === "In Progress").length,
      conflicts: assignments.filter((a) => a.scheduleConflictCount > 0).length,
      mine: currentUserId ? assignments.filter((a) => a.assignedUserId === currentUserId).length : 0,
    };
  }, [assignments, currentUserId]);

  const visibleAssignments = useMemo(() => {
    if (viewMode === "mine" && currentUserId) {
      return assignments.filter((assignment) => assignment.assignedUserId === currentUserId);
    }
    return assignments;
  }, [assignments, viewMode, currentUserId]);

  const filteredAssignments = useMemo(() => {
    return visibleAssignments.filter(a => !["Completed", "Cancelled", "Abandoned"].includes(a.assignmentStatus));
  }, [visibleAssignments]);

  return (
    <>
      <WorkspaceMetricGrid className="2xl:grid-cols-5">
        <MetricCard
          label="Pending acceptance"
          value={summary.pendingAcceptance}
          description="Handover assignments waiting for the assigned staff response."
        />
        <MetricCard
          label="Scheduled"
          value={summary.scheduled}
          description="Assignments queued with a planned technician or staff owner."
        />
        <MetricCard
          label="In progress"
          value={summary.inProgress}
          description="Jobs currently being worked from the tenant dispatch workflow."
        />
        <MetricCard
          label="My tasks"
          value={summary.mine}
          description="Assignments currently owned by the signed-in operator."
        />
        <MetricCard
          label="Conflicts"
          value={summary.conflicts}
          description="Active assignments with overlapping schedule visibility."
        />
      </WorkspaceMetricGrid>

      <RecordTableShell>
        <RecordTable>
          <thead>
            <tr>
              <th>Request No.</th>
              <th>Customer</th>
              <th>Assigned Staff</th>
              <th>Scheduled Start</th>
              <th>Scheduled End</th>
              <th>Assignment Status</th>
              <th>Service Status</th>
              <th>Finance</th>
              <th>Conflicts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <RecordTableStateRow colSpan={10}>Loading dispatch assignments...</RecordTableStateRow>
            ) : null}
            {isError ? (
              <RecordTableStateRow colSpan={10} tone="error">
                Unable to load dispatch assignments.
              </RecordTableStateRow>
            ) : null}
            {!isLoading && !isError && !filteredAssignments.length ? (
              <RecordTableStateRow colSpan={10}>
                {viewMode === "all" ? "No active dispatch assignments right now." : "No active assignments are currently assigned to your account."}
              </RecordTableStateRow>
            ) : null}
            {filteredAssignments.map((assignment) => (
              <tr key={assignment.id}>
                <td>{assignment.requestNumber}</td>
                <td>{assignment.customerName}</td>
                <td>{assignment.assignedUserName}</td>
                <td>{formatDateTime(assignment.scheduledStartUtc)}</td>
                <td>{formatDateTime(assignment.scheduledEndUtc)}</td>
                <td>
                  <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                </td>
                <td>{assignment.serviceStatus}</td>
                <td>
                  <WorkspaceStatusPill tone={getFinanceTone(assignment.financeHandoffStatus)}>
                    {assignment.financeHandoffStatus}
                  </WorkspaceStatusPill>
                </td>
                <td>
                  <WorkspaceStatusPill tone={assignment.scheduleConflictCount > 0 ? "warning" : "neutral"}>
                    {assignment.scheduleConflictCount > 0 ? `${assignment.scheduleConflictCount} overlap(s)` : "Clear"}
                  </WorkspaceStatusPill>
                </td>
                <td>
                  <div className="flex gap-1">
                    <RecordTableActionButton onClick={() => onSelectAssignment(assignment)}>
                      View
                    </RecordTableActionButton>
                    {canCancelAssignment(assignment) && (
                      <WorkspaceActionButton
                        className="btn-xs text-error hover:bg-error/10"
                        onClick={() => openCancelModal(assignment)}
                      >
                        Cancel
                      </WorkspaceActionButton>
                    )}
                    {canHandoverAssignment(assignment) && (
                      <WorkspaceActionButton
                        className="btn-xs text-warning hover:bg-warning/10"
                        onClick={() => openHandoverModal(assignment)}
                      >
                        Handover
                      </WorkspaceActionButton>
                    )}
                    {canAbandonAssignment(assignment) && (
                      <WorkspaceActionButton
                        className="btn-xs text-error hover:bg-error/10"
                        onClick={() => openAbandonModal(assignment)}
                      >
                        Abandon
                      </WorkspaceActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      </RecordTableShell>
    </>
  );
}
