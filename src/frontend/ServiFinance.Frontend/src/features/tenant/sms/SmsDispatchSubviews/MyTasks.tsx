import { useMemo } from "react";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

interface SmsDispatchMyTasksProps {
  assignments: TenantDispatchAssignmentRow[];
}

export function SmsDispatchMyTasks({ assignments }: SmsDispatchMyTasksProps) {
  const currentUser = getCurrentSession()?.user;
  const currentUserId = currentUser?.userId ?? null;

  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return assignments.filter((a) => a.assignedUserId === currentUserId);
  }, [assignments, currentUserId]);

  return (
    <RecordScrollRegion>
      <RecordTableShell>
        <RecordTable>
          <thead>
            <tr>
              <th>Request No.</th>
              <th>Customer</th>
              <th>Scheduled Start</th>
              <th>Scheduled End</th>
              <th>Status</th>
              <th>Service</th>
              <th>Finance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {myTasks.length === 0 ? (
              <RecordTableStateRow colSpan={8}>No tasks assigned to you yet.</RecordTableStateRow>
            ) : null}
            {myTasks.map((assignment) => (
              <tr key={assignment.id}>
                <td>{assignment.requestNumber}</td>
                <td>{assignment.customerName}</td>
                <td>
                  {assignment.scheduledStartUtc
                    ? new Date(assignment.scheduledStartUtc).toLocaleString()
                    : "—"}
                </td>
                <td>
                  {assignment.scheduledEndUtc
                    ? new Date(assignment.scheduledEndUtc).toLocaleString()
                    : "—"}
                </td>
                <td>
                  <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                </td>
                <td>{assignment.serviceStatus}</td>
                <td>{assignment.financeHandoffStatus}</td>
                <td>
                  <RecordTableActionButton>{/* TODO: open details */}View</RecordTableActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      </RecordTableShell>
    </RecordScrollRegion>
  );
}

