import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";

interface MyTasksProps {
  assignments: TenantDispatchAssignmentRow[];
  isLoading: boolean;
  isError: boolean;
  viewMode: string;
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
}

export function SmsDispatchMyTasks({
  assignments,
  isLoading,
  isError,
  viewMode,
  onSelectAssignment,
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
              {viewMode === "all" ? "No dispatch assignments yet." : "No assignments are currently assigned to your account."}
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
                <RecordTableActionButton onClick={() => onSelectAssignment(assignment)}>
                  View
                </RecordTableActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
