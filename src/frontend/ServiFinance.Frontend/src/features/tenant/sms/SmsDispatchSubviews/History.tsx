import { useMemo, useState } from "react";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import { WorkspaceModalButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

interface SmsDispatchHistoryProps {
  assignments: TenantDispatchAssignmentRow[];
  onSelectAssignment: (assignment: TenantDispatchAssignmentRow | null) => void;
  selectedAssignmentId: string | null;
  activeAssignment?: TenantDispatchAssignmentRow | null;
}

export function SmsDispatchHistory({
  assignments,
  onSelectAssignment,
  selectedAssignmentId,
  activeAssignment,
}: SmsDispatchHistoryProps) {
   const assignmentDetails = useMemo(() => {
     if (!activeAssignment) return [];
     return [
       {
         title: "Assignment record",
         items: [
           { label: "Request number", value: activeAssignment.requestNumber },
           { label: "Customer", value: activeAssignment.customerName },
           { label: "Assigned staff", value: activeAssignment.assignedUserName },
           {
             label: "Scheduled end",
             value: activeAssignment.scheduledEndUtc
               ? new Date(activeAssignment.scheduledEndUtc).toLocaleString()
               : "—"
           },
           { label: "Finance status", value: activeAssignment.financeHandoffStatus },
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
                <th>Scheduled End</th>
                <th>Finance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <RecordTableStateRow colSpan={6}>No completed assignments found.</RecordTableStateRow>
              ) : null}
               {assignments.map((assignment) => (
                 <tr key={assignment.id}>
                   <td>{assignment.requestNumber}</td>
                   <td>{assignment.customerName}</td>
                   <td>{assignment.assignedUserName}</td>
                   <td>
                     {assignment.scheduledEndUtc
                       ? new Date(assignment.scheduledEndUtc).toLocaleString()
                       : "—"}
                   </td>
                   <td>{assignment.financeHandoffStatus}</td>
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
      </RecordScrollRegion>

      <RecordDetailsModal
        open={selectedAssignmentId !== null}
        eyebrow="Assignment record"
        title={activeAssignment?.requestNumber ?? ""}
        sections={assignmentDetails}
        actions={
          <>
            <WorkspaceModalButton onClick={() => onSelectAssignment(null)}>Close</WorkspaceModalButton>
          </>
        }
        onClose={() => onSelectAssignment(null)}
      />
    </>
  );
}
