import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { DispatchAssignmentRow } from "./DispatchAssignmentRow";

interface HistoryProps {
  assignments: TenantDispatchAssignmentRow[];
  isLoading: boolean;
  isError: boolean;
  viewMode: string;
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
}

export function SmsDispatchHistory({
  assignments,
  isLoading,
  isError,
  viewMode,
  onSelectAssignment,
  formatDateTime,
  getFinanceTone
}: HistoryProps) {
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
              {viewMode === "all" ? "No archived assignments yet." : "No archived assignments are currently assigned to your account."}
            </RecordTableStateRow>
          ) : null}
          {assignments.map((assignment) => (
            <DispatchAssignmentRow
              key={assignment.id}
              assignment={assignment}
              onView={() => onSelectAssignment(assignment)}
              formatDateTime={formatDateTime}
              getFinanceTone={getFinanceTone}
            />
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
