import { useMemo, useState } from "react";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import { WorkspaceModalButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

interface SmsDispatchAssignmentsProps {
  assignments: TenantDispatchAssignmentRow[];
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow) => void;
  selectedAssignmentId: string | null;
  activeAssignment?: TenantDispatchAssignmentRow | null;
}

export function SmsDispatchAssignments({
  assignments,
  onSelectAssignment,
  selectedAssignmentId,
  activeAssignment,
}: SmsDispatchAssignmentsProps) {
  const assignmentDetails = useMemo(() => {
    if (!activeAssignment) return [];
    return [
      {
        title: "Assignment summary",
        items: [
          { label: "Request number", value: activeAssignment.requestNumber },
          { label: "Customer", value: activeAssignment.customerName },
          { label: "Item type", value: activeAssignment.itemType },
          { label: "Priority", value: activeAssignment.priority }
        ]
      },
      {
        title: "Dispatch timing",
        items: [
          { label: "Assigned staff", value: activeAssignment.assignedUserName },
          {
            label: "Scheduled start",
            value: activeAssignment.scheduledStartUtc
              ? new Date(activeAssignment.scheduledStartUtc).toLocaleString()
              : "—"
          },
          {
            label: "Scheduled end",
            value: activeAssignment.scheduledEndUtc
              ? new Date(activeAssignment.scheduledEndUtc).toLocaleString()
              : "—"
          },
          { label: "Assignment status", value: activeAssignment.assignmentStatus },
        ]
      }
    ];
  }, [activeAssignment]);

  return (
    <>
      <RecordScrollRegion>
        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Request No.</th>
                <th>Customer</th>
                <th>Assigned Staff</th>
                <th>Scheduled Start</th>
                <th>Scheduled End</th>
                <th>Status</th>
                <th>Service</th>
                <th>Finance</th>
                <th>Conflicts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <RecordTableStateRow colSpan={10}>No assignments found.</RecordTableStateRow>
              ) : null}
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.requestNumber}</td>
                  <td>{assignment.customerName}</td>
                  <td>{assignment.assignedUserName}</td>
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
                    <WorkspaceStatusPill tone={assignment.scheduleConflictCount > 0 ? "warning" : "neutral"}>
                      {assignment.scheduleConflictCount > 0 ? `${assignment.scheduleConflictCount} overlap(s)` : "Clear"}
                    </WorkspaceStatusPill>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <RecordTableActionButton onClick={() => onSelectAssignment(assignment)}>
                        View
                      </RecordTableActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </RecordScrollRegion>

      <RecordDetailsModal
        open={selectedAssignmentId !== null}
        eyebrow="Dispatch assignment"
        title={activeAssignment?.requestNumber ?? ""}
        sections={assignmentDetails}
        actions={
          <>
            <WorkspaceModalButton onClick={() => onSelectAssignment(null as any)}>Close</WorkspaceModalButton>
          </>
        }
        onClose={() => onSelectAssignment(null as any)}
      />
    </>
  );
}
