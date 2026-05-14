import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { DispatchAssignmentRow } from "./DispatchAssignmentRow";

interface PendingTasksProps {
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

export function SmsDispatchPendingTasks({
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
}: PendingTasksProps) {
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
              {viewMode === "all" ? "No pending dispatch tasks right now." : "No pending tasks are currently assigned to your account."}
            </RecordTableStateRow>
          ) : null}
          {assignments.map((assignment) => (
            <DispatchAssignmentRow
              key={assignment.id}
              assignment={assignment}
              onView={() => onSelectAssignment(assignment)}
              secondaryActions={canRespondToAssignment(assignment) ? [
                {
                  key: "accept",
                  label: "Accept",
                  tone: "success",
                  onClick: () => onAcceptAssignment(assignment),
                  disabled: isResponding
                },
                {
                  key: "reject",
                  label: "Reject",
                  tone: "danger",
                  onClick: () => onRejectAssignment(assignment),
                  disabled: isResponding
                }
              ] : []}
              formatDateTime={formatDateTime}
              getFinanceTone={getFinanceTone}
            />
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
