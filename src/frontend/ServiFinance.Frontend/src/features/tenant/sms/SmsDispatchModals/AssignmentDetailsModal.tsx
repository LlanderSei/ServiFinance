import { useMemo } from "react";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { WorkspaceModalButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import type { 
  TenantDispatchAssignmentRow, 
  TenantDispatchAssignmentDetailResponse,
  TenantDispatchAssignmentEvidenceRow
} from "@/shared/api/contracts";

interface AssignmentDetailsModalProps {
  open: boolean;
  onClose: () => void;
  assignment: TenantDispatchAssignmentRow | null;
  detailData: TenantDispatchAssignmentDetailResponse | undefined;
  isLoadingDetail: boolean;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onAddEvidence: () => void;
  onReschedule: () => void;
  onStatusUpdate: (assignment: TenantDispatchAssignmentRow, status: string, serviceStatus?: string) => void;
  onCancel: (assignment: TenantDispatchAssignmentRow) => void;
  onHandover: (assignment: TenantDispatchAssignmentRow) => void;
  onAbandon: (assignment: TenantDispatchAssignmentRow) => void;
  canCancel: (assignment: TenantDispatchAssignmentRow) => boolean;
  canHandover: (assignment: TenantDispatchAssignmentRow) => boolean;
  canAbandon: (assignment: TenantDispatchAssignmentRow) => boolean;
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
  isPendingStatusUpdate: boolean;
  isPendingCancel: boolean;
  isPendingHandover: boolean;
  isPendingAbandon: boolean;
  isPendingEvidence: boolean;
  isPendingReschedule: boolean;
  openEvidenceEditModal: (evidence: TenantDispatchAssignmentEvidenceRow) => void;
  handleEvidenceDelete: (evidence: TenantDispatchAssignmentEvidenceRow) => void;
  canManageEvidence: (evidence: TenantDispatchAssignmentEvidenceRow) => boolean;
}

export function AssignmentDetailsModal({
  open,
  onClose,
  assignment,
  detailData,
  isLoadingDetail,
  isAdmin,
  currentUserId,
  onAddEvidence,
  onReschedule,
  onStatusUpdate,
  onCancel,
  onHandover,
  onAbandon,
  canCancel,
  canHandover,
  canAbandon,
  formatDateTime,
  getFinanceTone,
  isPendingStatusUpdate,
  isPendingCancel,
  isPendingHandover,
  isPendingAbandon,
  isPendingEvidence,
  isPendingReschedule,
  openEvidenceEditModal,
  handleEvidenceDelete,
  canManageEvidence,
}: AssignmentDetailsModalProps) {
  const activeAssignment = useMemo(() => {
    return detailData?.assignment ?? assignment;
  }, [detailData?.assignment, assignment]);

  const sections = useMemo(() => {
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
          { label: "Scheduled start", value: formatDateTime(activeAssignment.scheduledStartUtc) },
          { label: "Scheduled end", value: formatDateTime(activeAssignment.scheduledEndUtc) },
          { label: "Assignment status", value: activeAssignment.assignmentStatus },
          {
            label: "Schedule conflicts",
            value: activeAssignment.scheduleConflictCount
              ? `${activeAssignment.scheduleConflictCount} overlap(s) detected`
              : "No overlapping assignments"
          }
        ]
      },
      {
        title: "Finance handoff",
        items: [
          { label: "Service status", value: activeAssignment.serviceStatus },
          {
            label: "Handoff state",
            value: (
              <WorkspaceStatusPill tone={getFinanceTone(activeAssignment.financeHandoffStatus)}>
                {activeAssignment.financeHandoffStatus}
              </WorkspaceStatusPill>
            )
          },
          {
            label: "Invoice",
            value: activeAssignment.invoiceNumber
              ? `${activeAssignment.invoiceNumber} (${activeAssignment.invoiceStatus ?? "Unknown"})`
              : "No finalized invoice yet"
          },
          {
            label: "Loan conversion",
            value: activeAssignment.hasMicroLoan
              ? "Converted to micro-loan in MLS."
              : activeAssignment.canConvertToLoan
                ? "Ready for desktop loan conversion."
                : "Not yet eligible for loan conversion."
          }
        ]
      },
      {
        title: "Execution context",
        items: [
          { label: "Assigned by", value: activeAssignment.assignedByUserName },
          { label: "Created", value: formatDateTime(activeAssignment.createdAtUtc) },
          {
            label: "Evidence",
            value: detailData?.evidence.length
              ? `${detailData.evidence.length} evidence item(s) submitted`
              : "No technician evidence yet"
          }
        ]
      },
      {
        title: "Assignment history",
        items: [
          {
            label: "Event log",
            value: detailData?.events.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {detailData.events.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.eventType}</strong>
                    <span className="text-base-content/70">{entry.remarks}</span>
                    <small className="text-base-content/60">
                      {entry.changedByUserName} - {formatDateTime(entry.createdAtUtc)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : isLoadingDetail ? "Loading assignment history..." : "No assignment history yet."
          }
        ]
      },
      {
        title: "Technician evidence",
        items: [
          {
            label: "Evidence log",
            value: detailData?.evidence.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {detailData.evidence.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.originalFileName ?? "Note entry"}</strong>
                    <span className="text-base-content/70">{entry.note || "No note provided."}</span>
                    {entry.relativeUrl ? (
                      <a
                        href={entry.relativeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary w-fit text-xs"
                      >
                        Open attachment
                      </a>
                    ) : null}
                    {canManageEvidence(entry) ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          className="btn btn-xs"
                          onClick={() => openEvidenceEditModal(entry)}
                        >
                          Edit note
                        </button>
                        <button
                          className="btn btn-xs border-error/30 text-error hover:bg-error/10"
                          onClick={() => handleEvidenceDelete(entry)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <small className="text-base-content/60">
                      {entry.submittedByUserName} - {formatDateTime(entry.createdAtUtc)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : isLoadingDetail ? "Loading technician evidence..." : "No technician evidence yet."
          }
        ]
      },
      {
        title: "Schedule conflicts",
        items: [
          {
            label: "Overlaps",
            value: detailData?.conflicts.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {detailData.conflicts.map((entry) => (
                  <li key={entry.assignmentId} className="grid gap-1 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
                    <strong className="text-base-content">
                      {entry.requestNumber} - {entry.customerName}
                    </strong>
                    <span className="text-base-content/70 text-xs">
                      {formatDateTime(entry.scheduledStartUtc)} to {formatDateTime(entry.scheduledEndUtc)}
                    </span>
                    <small className="text-base-content/60">
                      {entry.assignedUserName} - {entry.assignmentStatus}
                    </small>
                  </li>
                ))}
              </ul>
            ) : isLoadingDetail ? "Checking schedule conflicts..." : "No schedule conflicts detected."
          }
        ]
      },
      {
        title: "Service audit trail",
        items: [
          {
            label: "History",
            value: detailData?.auditTrail.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {detailData.auditTrail.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content text-xs">{entry.status}</strong>
                    <span className="text-base-content/70 text-xs">{entry.remarks}</span>
                    <small className="text-base-content/60 text-[10px]">{entry.changedByUserName} - {formatDateTime(entry.changedAtUtc)}</small>
                  </li>
                ))}
              </ul>
            ) : isLoadingDetail ? "Loading history..." : "No audit entries yet."
          }
        ]
      }
    ];
  }, [activeAssignment, detailData, isLoadingDetail, formatDateTime, getFinanceTone, canManageEvidence, openEvidenceEditModal, handleEvidenceDelete]);

  if (!activeAssignment) return null;

  return (
    <RecordDetailsModal
      open={open}
      eyebrow="Dispatch assignment"
      title={activeAssignment.requestNumber}
      sections={sections}
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>
            Close
          </WorkspaceModalButton>
          {(isAdmin || activeAssignment.assignedUserId === currentUserId) ? (
            <WorkspaceModalButton
              onClick={onAddEvidence}
              disabled={isPendingEvidence}
            >
              Add evidence
            </WorkspaceModalButton>
          ) : null}
          {isAdmin ? (
            <WorkspaceModalButton
              onClick={onReschedule}
              disabled={isPendingReschedule}
            >
              Reschedule
            </WorkspaceModalButton>
          ) : null}
          {activeAssignment.assignmentStatus !== "In Progress" ? (
            <WorkspaceModalButton
              tone="primary"
              onClick={() => onStatusUpdate(activeAssignment, "In Progress", "In Service")}
              disabled={isPendingStatusUpdate}
            >
              Start work
            </WorkspaceModalButton>
          ) : null}
          {activeAssignment.assignmentStatus !== "On Hold" ? (
            <WorkspaceModalButton
              onClick={() => onStatusUpdate(activeAssignment, "On Hold")}
              disabled={isPendingStatusUpdate}
            >
              Put on hold
            </WorkspaceModalButton>
          ) : null}
          {activeAssignment.assignmentStatus !== "Completed" ? (
            <WorkspaceModalButton
              tone="primary"
              onClick={() => onStatusUpdate(activeAssignment, "Completed")}
              disabled={isPendingStatusUpdate}
            >
              Mark completed
            </WorkspaceModalButton>
          ) : null}
          {canCancel(activeAssignment) && (
            <WorkspaceModalButton
              tone="danger"
              onClick={() => onCancel(activeAssignment)}
              disabled={isPendingCancel}
            >
              Cancel assignment
            </WorkspaceModalButton>
          )}
          {canHandover(activeAssignment) && (
            <WorkspaceModalButton
              onClick={() => onHandover(activeAssignment)}
              disabled={isPendingHandover}
            >
              Handover
            </WorkspaceModalButton>
          )}
          {canAbandon(activeAssignment) && (
            <WorkspaceModalButton
              tone="danger"
              onClick={() => onAbandon(activeAssignment)}
              disabled={isPendingAbandon}
            >
              Abandon
            </WorkspaceModalButton>
          )}
        </>
      }
      onClose={onClose}
    />
  );
}
