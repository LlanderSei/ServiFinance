import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RecordSurfaceModal } from "@/shared/records/RecordSurfaceModal";
import { WorkspaceModalButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import { ImagePreviewModal } from "@/shared/uploads/ImagePreviewModal";
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
  currentUserId: string | undefined;
  canAddEvidenceAction: boolean;
  canRescheduleAction: boolean;
  canUpdateStatusAction: boolean;
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

type ActionReadiness = {
  allowed: boolean;
  reason: string | null;
};

type AssignmentDetailTab = "summary" | "finance" | "evidence" | "history" | "schedule";

type DetailSection = {
  title: string;
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
};

const assignmentDetailTabs: Array<{ key: AssignmentDetailTab; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "finance", label: "Finance" },
  { key: "evidence", label: "Evidence" },
  { key: "history", label: "History" },
  { key: "schedule", label: "Schedule" }
];

export function AssignmentDetailsModal({
  open,
  onClose,
  assignment,
  detailData,
  isLoadingDetail,
  currentUserId,
  canAddEvidenceAction,
  canRescheduleAction,
  canUpdateStatusAction,
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
  const [activeTab, setActiveTab] = useState<AssignmentDetailTab>("summary");
  const [previewEvidence, setPreviewEvidence] = useState<TenantDispatchAssignmentEvidenceRow | null>(null);
  const activeAssignment = useMemo(() => {
    return detailData?.assignment ?? assignment;
  }, [detailData?.assignment, assignment]);

  useEffect(() => {
    if (open) {
      setActiveTab("summary");
      setPreviewEvidence(null);
    }
  }, [open, activeAssignment?.id]);

  const isTerminalAssignment = activeAssignment ? isTerminalDispatchAssignment(activeAssignment) : false;
  const evidenceReadiness = activeAssignment
    ? getEvidenceReadiness(activeAssignment, canAddEvidenceAction, currentUserId)
    : unavailableAction("Select an assignment first.");
  const rescheduleReadiness = activeAssignment
    ? getRescheduleReadiness(activeAssignment, canRescheduleAction)
    : unavailableAction("Select an assignment first.");
  const startWorkReadiness = activeAssignment
    ? getStatusReadiness(activeAssignment, canUpdateStatusAction, "start work")
    : unavailableAction("Select an assignment first.");
  const holdReadiness = activeAssignment
    ? getStatusReadiness(activeAssignment, canUpdateStatusAction, "put work on hold")
    : unavailableAction("Select an assignment first.");
  const completeReadiness = activeAssignment
    ? getStatusReadiness(activeAssignment, canUpdateStatusAction, "mark work completed")
    : unavailableAction("Select an assignment first.");
  const cancelReadiness = activeAssignment
    ? getCancelReadiness(activeAssignment, canCancel(activeAssignment))
    : unavailableAction("Select an assignment first.");
  const handoverReadiness = activeAssignment
    ? getHandoverReadiness(activeAssignment, canHandover(activeAssignment))
    : unavailableAction("Select an assignment first.");
  const abandonReadiness = activeAssignment
    ? getAbandonReadiness(activeAssignment, canAbandon(activeAssignment))
    : unavailableAction("Select an assignment first.");

  const detailSectionsByTab = useMemo<Record<AssignmentDetailTab, DetailSection[]>>(() => {
    if (!activeAssignment) {
      return {
        summary: [],
        finance: [],
        evidence: [],
        history: [],
        schedule: []
      };
    }

    return {
      summary: [
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
            { label: "Assignment status", value: activeAssignment.assignmentStatus }
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
                : isLoadingDetail ? "Loading technician evidence..." : "No technician evidence yet"
            }
          ]
        }
      ],
      finance: [
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
        }
      ],
      evidence: [
        {
          title: "Technician evidence",
          items: [
            {
              label: "Evidence log",
              value: detailData?.evidence.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {detailData.evidence.map((entry) => (
                    <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <strong className="text-base-content">{entry.originalFileName ?? "Note entry"}</strong>
                      <span className="text-base-content/70">{entry.note || "No note provided."}</span>
                      {entry.relativeUrl ? (
                        <button
                          type="button"
                          className="link link-primary w-fit bg-transparent p-0 text-left text-xs"
                          onClick={() => setPreviewEvidence(entry)}
                        >
                          Open attachment
                        </button>
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
        }
      ],
      history: [
        {
          title: "Assignment history",
          items: [
            {
              label: "Event log",
              value: detailData?.events.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
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
          title: "Service audit trail",
          items: [
            {
              label: "History",
              value: detailData?.auditTrail.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {detailData.auditTrail.map((entry) => (
                    <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                      <strong className="text-xs text-base-content">{entry.status}</strong>
                      <span className="text-xs text-base-content/70">{entry.remarks}</span>
                      <small className="text-[10px] text-base-content/60">
                        {entry.changedByUserName} - {formatDateTime(entry.changedAtUtc)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : isLoadingDetail ? "Loading history..." : "No audit entries yet."
            }
          ]
        }
      ],
      schedule: [
        {
          title: "Schedule conflicts",
          items: [
            {
              label: "Overlaps",
              value: detailData?.conflicts.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {detailData.conflicts.map((entry) => (
                    <li key={entry.assignmentId} className="grid gap-1 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
                      <strong className="text-base-content">
                        {entry.requestNumber} - {entry.customerName}
                      </strong>
                      <span className="text-xs text-base-content/70">
                        {formatDateTime(entry.scheduledStartUtc)} to {formatDateTime(entry.scheduledEndUtc)}
                      </span>
                      <small className="text-base-content/60">
                        {entry.assignedUserName} - {entry.assignmentStatus}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : isLoadingDetail ? "Checking schedule conflicts..." : "No schedule conflicts detected."
            },
            {
              label: "Current assignment",
              value: activeAssignment.scheduleConflictCount
                ? `${activeAssignment.scheduleConflictCount} overlap(s) detected`
                : "No overlapping assignments"
            }
          ]
        }
      ]
    };
  }, [
    activeAssignment,
    detailData,
    isLoadingDetail,
    formatDateTime,
    getFinanceTone,
    canManageEvidence,
    openEvidenceEditModal,
    handleEvidenceDelete
  ]);

  if (!activeAssignment) return null;

  const visibleSections = detailSectionsByTab[activeTab];

  return (
    <>
      <RecordSurfaceModal
        open={open}
        eyebrow="Dispatch assignment"
        title={activeAssignment.requestNumber}
        description="Review focused assignment details by summary, finance, evidence, history, and schedule context."
        tabs={assignmentDetailTabs}
        activeTabKey={activeTab}
        maxWidthClassName="max-w-[min(64rem,calc(100vw-2rem))]"
        actions={
          <>
            <WorkspaceModalButton onClick={onClose}>
              Close
            </WorkspaceModalButton>
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                onClick={onAddEvidence}
                disabled={!evidenceReadiness.allowed || isPendingEvidence}
                title={evidenceReadiness.reason ?? undefined}
              >
                Add evidence
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                onClick={onReschedule}
                disabled={!rescheduleReadiness.allowed || isPendingReschedule}
                title={rescheduleReadiness.reason ?? undefined}
              >
                Reschedule
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment && activeAssignment.assignmentStatus !== "In Progress" ? (
              <WorkspaceModalButton
                tone="primary"
                onClick={() => onStatusUpdate(activeAssignment, "In Progress", "In Service")}
                disabled={!startWorkReadiness.allowed || isPendingStatusUpdate}
                title={startWorkReadiness.reason ?? undefined}
              >
                Start work
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment && activeAssignment.assignmentStatus !== "On Hold" ? (
              <WorkspaceModalButton
                onClick={() => onStatusUpdate(activeAssignment, "On Hold")}
                disabled={!holdReadiness.allowed || isPendingStatusUpdate}
                title={holdReadiness.reason ?? undefined}
              >
                Put on hold
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                tone="primary"
                onClick={() => onStatusUpdate(activeAssignment, "Completed")}
                disabled={!completeReadiness.allowed || isPendingStatusUpdate}
                title={completeReadiness.reason ?? undefined}
              >
                Mark completed
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                tone="danger"
                onClick={() => onCancel(activeAssignment)}
                disabled={!cancelReadiness.allowed || isPendingCancel}
                title={cancelReadiness.reason ?? undefined}
              >
                Cancel assignment
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                onClick={() => onHandover(activeAssignment)}
                disabled={!handoverReadiness.allowed || isPendingHandover}
                title={handoverReadiness.reason ?? undefined}
              >
                Handover
              </WorkspaceModalButton>
            ) : null}
            {!isTerminalAssignment ? (
              <WorkspaceModalButton
                tone="danger"
                onClick={() => onAbandon(activeAssignment)}
                disabled={!abandonReadiness.allowed || isPendingAbandon}
                title={abandonReadiness.reason ?? undefined}
              >
                Abandon
              </WorkspaceModalButton>
            ) : null}
          </>
        }
        onClose={onClose}
        onTabChange={(tabKey) => setActiveTab(tabKey as AssignmentDetailTab)}
      >
        <div className="h-full overflow-y-auto pr-1">
          <DetailSections sections={visibleSections} fullWidthItems={activeTab === "evidence" || activeTab === "history"} />
        </div>
      </RecordSurfaceModal>

      <ImagePreviewModal
        open={Boolean(previewEvidence?.relativeUrl)}
        title={previewEvidence?.originalFileName ?? "Technician evidence"}
        imageUrl={previewEvidence?.relativeUrl ?? null}
        description={previewEvidence?.note || undefined}
        onClose={() => setPreviewEvidence(null)}
      />
    </>
  );
}

function DetailSections({ sections, fullWidthItems = false }: { sections: DetailSection[]; fullWidthItems?: boolean }) {
  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <section key={section.title} className="grid gap-3">
          <h3 className="m-0 text-[0.82rem] font-extrabold uppercase tracking-[0.1em] text-base-content/60">{section.title}</h3>

          <dl className={`grid grid-cols-1 gap-3 ${fullWidthItems ? "" : "md:grid-cols-2"}`}>
            {section.items.map((item) => (
              <div key={`${section.title}-${item.label}`} className="grid min-w-0 gap-1 rounded-box border border-base-300/70 bg-base-200/40 px-4 py-3">
                <dt className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{item.label}</dt>
                <dd className="m-0 min-w-0 break-words text-sm leading-6 text-base-content [overflow-wrap:anywhere]">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function unavailableAction(reason: string): ActionReadiness {
  return { allowed: false, reason };
}

function availableAction(): ActionReadiness {
  return { allowed: true, reason: null };
}

function isTerminalDispatchAssignment(assignment: TenantDispatchAssignmentRow) {
  return ["Completed", "Cancelled", "Abandoned"].includes(assignment.assignmentStatus);
}

function getEvidenceReadiness(
  assignment: TenantDispatchAssignmentRow,
  canAddEvidenceAction: boolean,
  currentUserId: string | undefined
): ActionReadiness {
  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction("Terminal assignments cannot receive new technician evidence.");
  }

  if (!canAddEvidenceAction) {
    return unavailableAction("Requires evidence management permission and full job update module access.");
  }

  if (assignment.assignedUserId !== currentUserId) {
    return unavailableAction("Only the assigned staff member can add technician evidence.");
  }

  return availableAction();
}

function getRescheduleReadiness(
  assignment: TenantDispatchAssignmentRow,
  canRescheduleAction: boolean
): ActionReadiness {
  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction("Terminal assignments cannot be rescheduled.");
  }

  if (!canRescheduleAction) {
    return unavailableAction("Requires dispatch scheduling permission and full scheduling module access.");
  }

  return availableAction();
}

function getStatusReadiness(
  assignment: TenantDispatchAssignmentRow,
  canUpdateStatusAction: boolean,
  actionLabel: string
): ActionReadiness {
  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction(`Terminal assignments cannot ${actionLabel}.`);
  }

  if (!canUpdateStatusAction) {
    return unavailableAction("Requires dispatch status update permission.");
  }

  return availableAction();
}

function getCancelReadiness(
  assignment: TenantDispatchAssignmentRow,
  canPerform: boolean
): ActionReadiness {
  if (canPerform) {
    return availableAction();
  }

  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction("Terminal assignments cannot be cancelled.");
  }

  if (assignment.assignmentStatus === "In Progress") {
    return unavailableAction("In-progress work must be put on hold before cancellation.");
  }

  return unavailableAction("Requires dispatch scheduling permission for an eligible assignment.");
}

function getHandoverReadiness(
  assignment: TenantDispatchAssignmentRow,
  canPerform: boolean
): ActionReadiness {
  if (canPerform) {
    return availableAction();
  }

  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction("Terminal assignments cannot be handed over.");
  }

  if (assignment.assignmentStatus === "In Progress") {
    return unavailableAction("In-progress work must be paused before handover.");
  }

  return unavailableAction("Requires dispatch scheduling permission and full scheduling module access.");
}

function getAbandonReadiness(
  assignment: TenantDispatchAssignmentRow,
  canPerform: boolean
): ActionReadiness {
  if (canPerform) {
    return availableAction();
  }

  if (isTerminalDispatchAssignment(assignment)) {
    return unavailableAction("Terminal assignments cannot be abandoned.");
  }

  if (assignment.assignmentStatus === "In Progress") {
    return unavailableAction("In-progress work must be paused before abandonment.");
  }

  return unavailableAction("Requires dispatch scheduling permission for an eligible assignment.");
}
