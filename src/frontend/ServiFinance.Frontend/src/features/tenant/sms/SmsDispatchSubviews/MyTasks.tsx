import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceActionButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";

interface MyTasksProps {
  assignments: TenantDispatchAssignmentRow[];
  isLoading: boolean;
  isError: boolean;
  viewMode: string;
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  canRespondToAssignment: (assignment: TenantDispatchAssignmentRow) => boolean;
  onAcceptAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  onRejectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  isResponding: boolean;
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
}

export function SmsDispatchMyTasks({
  assignments,
  isLoading,
  isError,
  viewMode,
  onSelectAssignment,
  canRespondToAssignment,
  onAcceptAssignment,
  onRejectAssignment,
  isResponding,
  formatDateTime,
  getFinanceTone
}: MyTasksProps) {
  return (
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
          {!isLoading && !isError && !assignments.length ? (
            <RecordTableStateRow colSpan={10}>
              {viewMode === "all" ? "No tasks are currently assigned to your account." : "No assignments are currently assigned to your account."}
            </RecordTableStateRow>
          ) : null}
          {assignments.map((assignment) => (
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
                <div className="flex flex-wrap gap-1">
                  <RecordTableActionButton onClick={() => onSelectAssignment(assignment)}>
                    View
                  </RecordTableActionButton>
                  {canRespondToAssignment(assignment) ? (
                    <>
                      <WorkspaceActionButton
                        className="btn-xs text-success hover:bg-success/10"
                        disabled={isResponding}
                        onClick={() => onAcceptAssignment(assignment)}
                      >
                        Accept
                      </WorkspaceActionButton>
                      <WorkspaceActionButton
                        className="btn-xs text-error hover:bg-error/10"
                        disabled={isResponding}
                        onClick={() => onRejectAssignment(assignment)}
                      >
                        Reject
                      </WorkspaceActionButton>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
