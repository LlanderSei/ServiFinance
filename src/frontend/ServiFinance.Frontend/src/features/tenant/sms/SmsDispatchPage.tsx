import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateTenantAssignmentRequest,
  TenantDispatchAssignmentRow,
  TenantDispatchAssignmentDetailResponse,
  TenantDispatchAssignmentEvidenceRow,
  TenantDispatchMetaResponse,
  RescheduleTenantAssignmentRequest,
  UpdateTenantAssignmentEvidenceRequest,
  UpdateTenantAssignmentStatusRequest
} from "@/shared/api/contracts";
import { httpDelete, httpGet, httpPostFormData, httpPostJson } from "@/shared/api/http";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { MetricCard } from "@/shared/records/MetricCard";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceFilter,
  WorkspaceFileInput,
  WorkspaceForm,
  WorkspaceActionButton,
  WorkspaceInlineNote,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceStatusPill,
  WorkspaceToggleGroup,
  WorkspaceToggleButton
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspaceToolbar,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

type DispatchViewMode = "workspace" | "mine";
type DispatchLayoutMode = "register" | "timeline";
type ScheduleFormState = {
  serviceRequestId: string;
  assignedUserId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  assignmentStatus: string;
};

type DispatchFilterState = {
  assignedUserId: string;
  assignmentStatus: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
};

type RescheduleFormState = {
  assignedUserId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  assignmentStatus: string;
  remarks: string;
};

const assignmentStatuses = ["Scheduled", "In Progress", "On Hold", "Completed"] as const;
const priorityOptions = ["Low", "Normal", "High", "Urgent"] as const;

export function SmsDispatchPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const isAdmin = currentUser?.roles.includes("Administrator") ?? false;
  const [selectedAssignment, setSelectedAssignment] = useState<TenantDispatchAssignmentRow | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isEvidenceEditModalOpen, setIsEvidenceEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<DispatchViewMode>(isAdmin ? "workspace" : "mine");
  const [layoutMode, setLayoutMode] = useState<DispatchLayoutMode>("register");
  const [editingEvidence, setEditingEvidence] = useState<TenantDispatchAssignmentEvidenceRow | null>(null);
  const [filters, setFilters] = useState<DispatchFilterState>({
    assignedUserId: "",
    assignmentStatus: "",
    priority: "",
    dateFrom: "",
    dateTo: ""
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    serviceRequestId: "",
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "Scheduled"
  });
  const [rescheduleForm, setRescheduleForm] = useState<RescheduleFormState>({
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "Scheduled",
    remarks: ""
  });
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [editingEvidenceNote, setEditingEvidenceNote] = useState("");

  const dispatchQueryString = useMemo(() => {
    const searchParams = new URLSearchParams();

    if (filters.assignedUserId) {
      searchParams.set("assignedUserId", filters.assignedUserId);
    }

    if (filters.assignmentStatus) {
      searchParams.set("assignmentStatus", filters.assignmentStatus);
    }

    if (filters.priority) {
      searchParams.set("priority", filters.priority);
    }

    if (filters.dateFrom) {
      searchParams.set("dateFrom", new Date(filters.dateFrom).toISOString());
    }

    if (filters.dateTo) {
      searchParams.set("dateTo", new Date(filters.dateTo).toISOString());
    }

    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }, [filters]);

  const dispatchQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch", filters],
    queryFn: () => httpGet<TenantDispatchAssignmentRow[]>(`/api/tenants/${tenantDomainSlug}/sms/dispatch${dispatchQueryString}`)
  });

  const dispatchMetaQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-meta"],
    queryFn: () => httpGet<TenantDispatchMetaResponse>(`/api/tenants/${tenantDomainSlug}/sms/dispatch/meta`),
    enabled: isAdmin
  });

  const assignmentDetailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment?.id],
    queryFn: () =>
      httpGet<TenantDispatchAssignmentDetailResponse>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${selectedAssignment?.id}/details`
      ),
    enabled: selectedAssignment !== null
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (payload: CreateTenantAssignmentRequest) =>
      httpPostJson<TenantDispatchAssignmentRow, CreateTenantAssignmentRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      setSelectedAssignment(assignment);
      setIsScheduleModalOpen(false);
      setScheduleForm({
        serviceRequestId: "",
        assignedUserId: "",
        scheduledStartUtc: "",
        scheduledEndUtc: "",
        assignmentStatus: "Scheduled"
      });
      toast.success({
        title: "Dispatch assignment created",
        message: `Request ${assignment.requestNumber} is now scheduled under ${assignment.assignedUserName}.`
      });
      if (assignment.scheduleConflictCount > 0) {
        toast.warning({
          title: "Schedule conflict detected",
          message: `${assignment.scheduleConflictCount} overlapping assignment(s) already exist for this staff member.`
        });
      }
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create dispatch assignment",
        message: mutationError.message
      });
    }
  });

  const updateAssignmentStatusMutation = useMutation({
    mutationFn: ({
      assignmentId,
      payload
    }: {
      assignmentId: string;
      payload: UpdateTenantAssignmentStatusRequest;
    }) =>
      httpPostJson<TenantDispatchAssignmentRow, UpdateTenantAssignmentStatusRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/status`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", assignment.id]
      });
      setSelectedAssignment(assignment);
      toast.success({
        title: "Dispatch assignment updated",
        message: `Assignment ${assignment.requestNumber} moved to ${assignment.assignmentStatus}.`
      });
      if (assignment.scheduleConflictCount > 0) {
        toast.warning({
          title: "Dispatch overlap still present",
          message: `${assignment.scheduleConflictCount} scheduling conflict(s) remain for this assignment.`
        });
      }
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update dispatch assignment",
        message: mutationError.message
      });
    }
  });

  const rescheduleAssignmentMutation = useMutation({
    mutationFn: ({
      assignmentId,
      payload
    }: {
      assignmentId: string;
      payload: RescheduleTenantAssignmentRequest;
    }) =>
      httpPostJson<TenantDispatchAssignmentRow, RescheduleTenantAssignmentRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/reschedule`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", assignment.id]
      });
      setSelectedAssignment(assignment);
      setIsRescheduleModalOpen(false);
      toast.success({
        title: "Assignment rescheduled",
        message: `Request ${assignment.requestNumber} was updated for ${assignment.assignedUserName}.`
      });
      if (assignment.scheduleConflictCount > 0) {
        toast.warning({
          title: "Schedule conflict detected",
          message: `${assignment.scheduleConflictCount} overlapping assignment(s) still exist for this staff member.`
        });
      }
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to reschedule assignment",
        message: mutationError.message
      });
    }
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: FormData }) =>
      httpPostFormData(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence`, payload),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({
          queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id]
        });
      }
      setIsEvidenceModalOpen(false);
      setEvidenceNote("");
      setEvidenceFiles([]);
      toast.success({
        title: "Evidence submitted",
        message: "Technician completion evidence is now attached to the assignment."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to submit evidence",
        message: mutationError.message
      });
    }
  });

  const updateEvidenceMutation = useMutation({
    mutationFn: ({
      assignmentId,
      evidenceId,
      payload
    }: {
      assignmentId: string;
      evidenceId: string;
      payload: UpdateTenantAssignmentEvidenceRequest;
    }) =>
      httpPostJson<TenantDispatchAssignmentEvidenceRow, UpdateTenantAssignmentEvidenceRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence/${evidenceId}/note`,
        payload
      ),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({
          queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id]
        });
      }
      setIsEvidenceEditModalOpen(false);
      setEditingEvidence(null);
      setEditingEvidenceNote("");
      toast.success({
        title: "Evidence updated",
        message: "The technician evidence note was updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update evidence",
        message: mutationError.message
      });
    }
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: ({ assignmentId, evidenceId }: { assignmentId: string; evidenceId: string }) =>
      httpDelete(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence/${evidenceId}`),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({
          queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id]
        });
      }
      toast.success({
        title: "Evidence removed",
        message: "The selected technician proof entry was removed."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to remove evidence",
        message: mutationError.message
      });
    }
  });

  const visibleAssignments = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    if (viewMode === "mine" && currentUser?.userId) {
      return assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId);
    }

    return assignments;
  }, [currentUser?.userId, dispatchQuery.data, viewMode]);

  const activeAssignment = useMemo(() => {
    if (!selectedAssignment) {
      return null;
    }

    return assignmentDetailQuery.data?.assignment ??
      dispatchQuery.data?.find((assignment) => assignment.id === selectedAssignment.id) ??
      selectedAssignment;
  }, [assignmentDetailQuery.data?.assignment, dispatchQuery.data, selectedAssignment]);

  const assignmentDetails = useMemo(() => {
    if (!activeAssignment) {
      return [];
    }

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
            value: assignmentDetailQuery.data?.evidence.length
              ? `${assignmentDetailQuery.data.evidence.length} evidence item(s) submitted`
              : "No technician evidence yet"
          }
        ]
      },
      {
        title: "Assignment history",
        items: [
          {
            label: "Event log",
            value: assignmentDetailQuery.data?.events.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {assignmentDetailQuery.data.events.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.eventType}</strong>
                    <span className="text-base-content/70">{entry.remarks}</span>
                    <small className="text-base-content/60">
                      {entry.changedByUserName} - {formatDateTime(entry.createdAtUtc)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : assignmentDetailQuery.isLoading ? "Loading assignment history..." : "No assignment history yet."
          }
        ]
      },
      {
        title: "Technician evidence",
        items: [
          {
            label: "Evidence log",
            value: assignmentDetailQuery.data?.evidence.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {assignmentDetailQuery.data.evidence.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.originalFileName ?? "Note entry"}</strong>
                    <span className="text-base-content/70">{entry.note || "No note provided."}</span>
                    {entry.relativeUrl ? (
                      <a
                        href={entry.relativeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary w-fit"
                      >
                        Open attachment
                      </a>
                    ) : null}
                    {canManageEvidence(entry) ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <WorkspaceActionButton
                          className="btn-xs"
                          onClick={() => openEvidenceEditModal(entry)}
                        >
                          Edit note
                        </WorkspaceActionButton>
                        <WorkspaceActionButton
                          className="btn-xs border-error/30 text-error hover:bg-error/10"
                          onClick={() => handleEvidenceDelete(entry)}
                          disabled={deleteEvidenceMutation.isPending}
                        >
                          Remove
                        </WorkspaceActionButton>
                      </div>
                    ) : null}
                    <small className="text-base-content/60">
                      {entry.submittedByUserName} - {formatDateTime(entry.createdAtUtc)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : assignmentDetailQuery.isLoading ? "Loading technician evidence..." : "No technician evidence yet."
          }
        ]
      },
      {
        title: "Schedule conflicts",
        items: [
          {
            label: "Overlaps",
            value: assignmentDetailQuery.data?.conflicts.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {assignmentDetailQuery.data.conflicts.map((entry) => (
                  <li key={entry.assignmentId} className="grid gap-1 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
                    <strong className="text-base-content">
                      {entry.requestNumber} - {entry.customerName}
                    </strong>
                    <span className="text-base-content/70">
                      {formatDateTime(entry.scheduledStartUtc)} to {formatDateTime(entry.scheduledEndUtc)}
                    </span>
                    <small className="text-base-content/60">
                      {entry.assignedUserName} - {entry.assignmentStatus}
                    </small>
                  </li>
                ))}
              </ul>
            ) : assignmentDetailQuery.isLoading ? "Checking schedule conflicts..." : "No schedule conflicts detected."
          }
        ]
      },
      {
        title: "Service audit trail",
        items: [
          {
            label: "History",
            value: assignmentDetailQuery.data?.auditTrail.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {assignmentDetailQuery.data.auditTrail.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.status}</strong>
                    <span className="text-base-content/70">{entry.remarks}</span>
                    <small className="text-base-content/60">{entry.changedByUserName} - {formatDateTime(entry.changedAtUtc)}</small>
                  </li>
                ))}
              </ul>
            ) : assignmentDetailQuery.isLoading ? "Loading history..." : "No audit entries yet."
          }
        ]
      }
    ];
  }, [
    activeAssignment,
    assignmentDetailQuery.data?.auditTrail,
    assignmentDetailQuery.data?.conflicts,
    assignmentDetailQuery.data?.evidence,
    assignmentDetailQuery.data?.events,
    assignmentDetailQuery.isLoading
  ]);

  const summary = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    return {
      scheduled: assignments.filter((assignment) => assignment.assignmentStatus === "Scheduled").length,
      inProgress: assignments.filter((assignment) => assignment.assignmentStatus === "In Progress").length,
      mine: currentUser?.userId
        ? assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId).length
      : 0
    };
  }, [currentUser?.userId, dispatchQuery.data]);

  const timelineGroups = useMemo(() => {
    const sortedAssignments = [...visibleAssignments].sort((left, right) => {
      const leftTicks = left.scheduledStartUtc ? new Date(left.scheduledStartUtc).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTicks = right.scheduledStartUtc ? new Date(right.scheduledStartUtc).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTicks - rightTicks || left.assignedUserName.localeCompare(right.assignedUserName);
    });

    const groups = new Map<string, { label: string; assignments: TenantDispatchAssignmentRow[] }>();
    for (const assignment of sortedAssignments) {
      const key = assignment.scheduledStartUtc
        ? new Date(assignment.scheduledStartUtc).toISOString().slice(0, 10)
        : "unscheduled";
      const label = assignment.scheduledStartUtc
        ? new Date(assignment.scheduledStartUtc).toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric"
        })
        : "Unscheduled assignments";

      const existing = groups.get(key);
      if (existing) {
        existing.assignments.push(assignment);
      } else {
        groups.set(key, { label, assignments: [assignment] });
      }
    }

    return Array.from(groups.values());
  }, [visibleAssignments]);

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createAssignmentMutation.mutate({
      serviceRequestId: scheduleForm.serviceRequestId,
      assignedUserId: scheduleForm.assignedUserId,
      scheduledStartUtc: toIsoString(scheduleForm.scheduledStartUtc),
      scheduledEndUtc: toIsoString(scheduleForm.scheduledEndUtc),
      assignmentStatus: scheduleForm.assignmentStatus
    });
  }

  function handleStatusUpdate(assignment: TenantDispatchAssignmentRow, assignmentStatus: string, serviceStatus?: string) {
    updateAssignmentStatusMutation.mutate({
      assignmentId: assignment.id,
      payload: {
        assignmentStatus,
        serviceStatus,
        remarks: `Dispatch status moved to ${assignmentStatus}.`
      }
    });
  }

  function openRescheduleModal() {
    if (!activeAssignment) {
      return;
    }

    setRescheduleForm({
      assignedUserId: activeAssignment.assignedUserId,
      scheduledStartUtc: toDateTimeLocalValue(activeAssignment.scheduledStartUtc),
      scheduledEndUtc: toDateTimeLocalValue(activeAssignment.scheduledEndUtc),
      assignmentStatus: activeAssignment.assignmentStatus,
      remarks: ""
    });
    setIsRescheduleModalOpen(true);
  }

  function handleRescheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment) {
      return;
    }

    rescheduleAssignmentMutation.mutate({
      assignmentId: activeAssignment.id,
      payload: {
        assignedUserId: rescheduleForm.assignedUserId,
        scheduledStartUtc: toIsoString(rescheduleForm.scheduledStartUtc),
        scheduledEndUtc: toIsoString(rescheduleForm.scheduledEndUtc),
        assignmentStatus: rescheduleForm.assignmentStatus,
        remarks: rescheduleForm.remarks || null
      }
    });
  }

  function handleEvidenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment) {
      return;
    }

    const formData = new FormData();
    formData.append("note", evidenceNote);
    evidenceFiles.forEach((file) => {
      formData.append("files", file);
    });

    submitEvidenceMutation.mutate({
      assignmentId: activeAssignment.id,
      payload: formData
    });
  }

  function openEvidenceEditModal(evidence: TenantDispatchAssignmentEvidenceRow) {
    setEditingEvidence(evidence);
    setEditingEvidenceNote(evidence.note);
    setIsEvidenceEditModalOpen(true);
  }

  function handleEvidenceEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment || !editingEvidence) {
      return;
    }

    updateEvidenceMutation.mutate({
      assignmentId: activeAssignment.id,
      evidenceId: editingEvidence.id,
      payload: {
        note: editingEvidenceNote
      }
    });
  }

  function handleEvidenceDelete(evidence: TenantDispatchAssignmentEvidenceRow) {
    if (!activeAssignment) {
      return;
    }

    const approved = window.confirm(
      `Remove ${evidence.originalFileName ?? "this evidence note"} from assignment ${activeAssignment.requestNumber}?`
    );
    if (!approved) {
      return;
    }

    deleteEvidenceMutation.mutate({
      assignmentId: activeAssignment.id,
      evidenceId: evidence.id
    });
  }

  function canManageEvidence(evidence: TenantDispatchAssignmentEvidenceRow) {
    return isAdmin || evidence.submittedByUserId === currentUser?.userId;
  }

  return (
    <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Dispatch`}
          title="Dispatch and assignments"
          description="Coordinate scheduled work, technician ownership, finance handoff state, and service execution from one tenant dispatch register."
          recordCount={visibleAssignments.length}
          singularLabel="assignment"
        >
          <RecordContentStack>
            <WorkspaceMetricGrid className="2xl:grid-cols-3">
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
            </WorkspaceMetricGrid>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Dispatch view"
                title="Assignment register"
                actions={(
                  <WorkspaceToolbar>
                    {isAdmin ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <WorkspaceToggleGroup>
                          <WorkspaceToggleButton active={viewMode === "workspace"} onClick={() => setViewMode("workspace")}>
                            Workspace
                          </WorkspaceToggleButton>
                          <WorkspaceToggleButton active={viewMode === "mine"} onClick={() => setViewMode("mine")}>
                            My tasks
                          </WorkspaceToggleButton>
                        </WorkspaceToggleGroup>

                        <WorkspaceToggleGroup>
                          <WorkspaceToggleButton active={layoutMode === "register"} onClick={() => setLayoutMode("register")}>
                            Register
                          </WorkspaceToggleButton>
                          <WorkspaceToggleButton active={layoutMode === "timeline"} onClick={() => setLayoutMode("timeline")}>
                            Timeline
                          </WorkspaceToggleButton>
                        </WorkspaceToggleGroup>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <WorkspaceInlineNote>Showing assignments currently owned by your account.</WorkspaceInlineNote>
                        <WorkspaceToggleGroup>
                          <WorkspaceToggleButton active={layoutMode === "register"} onClick={() => setLayoutMode("register")}>
                            Register
                          </WorkspaceToggleButton>
                          <WorkspaceToggleButton active={layoutMode === "timeline"} onClick={() => setLayoutMode("timeline")}>
                            Timeline
                          </WorkspaceToggleButton>
                        </WorkspaceToggleGroup>
                      </div>
                    )}
                  </WorkspaceToolbar>
                )}
              />
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Filters" title="Schedule intelligence" />
              <WorkspaceToolbar>
                {isAdmin ? (
                  <WorkspaceFilter label="Assigned staff">
                    <WorkspaceSelect
                      value={filters.assignedUserId}
                      onChange={(event) => setFilters((current) => ({ ...current, assignedUserId: event.target.value }))}
                    >
                      <option value="">All staff</option>
                      {dispatchMetaQuery.data?.assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.fullName}</option>
                      ))}
                    </WorkspaceSelect>
                  </WorkspaceFilter>
                ) : null}

                <WorkspaceFilter label="Assignment status">
                  <WorkspaceSelect
                    value={filters.assignmentStatus}
                    onChange={(event) => setFilters((current) => ({ ...current, assignmentStatus: event.target.value }))}
                  >
                    <option value="">All statuses</option>
                    {assignmentStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceFilter>

                <WorkspaceFilter label="Priority">
                  <WorkspaceSelect
                    value={filters.priority}
                    onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
                  >
                    <option value="">All priorities</option>
                    {priorityOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceFilter>

                <WorkspaceFilter label="Date from">
                  <WorkspaceInput
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                  />
                </WorkspaceFilter>

                <WorkspaceFilter label="Date to">
                  <WorkspaceInput
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                  />
                </WorkspaceFilter>
              </WorkspaceToolbar>
            </WorkspacePanel>

            {layoutMode === "register" ? (
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
                    {dispatchQuery.isLoading ? (
                      <RecordTableStateRow colSpan={10}>Loading dispatch assignments...</RecordTableStateRow>
                    ) : null}

                    {dispatchQuery.isError ? (
                      <RecordTableStateRow colSpan={10} tone="error">
                        Unable to load dispatch assignments.
                      </RecordTableStateRow>
                    ) : null}

                    {!dispatchQuery.isLoading && !dispatchQuery.isError && !visibleAssignments.length ? (
                      <RecordTableStateRow colSpan={10}>
                        {isAdmin ? "No dispatch assignments yet." : "No assignments are currently assigned to your account."}
                      </RecordTableStateRow>
                    ) : null}

                    {visibleAssignments.map((assignment) => (
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
                          <RecordTableActionButton onClick={() => setSelectedAssignment(assignment)}>
                            View
                          </RecordTableActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </RecordTable>
              </RecordTableShell>
            ) : (
              <WorkspacePanel>
                <WorkspacePanelHeader
                  eyebrow="Technician planning"
                  title="Timeline view"
                />
                <WorkspaceInlineNote>
                  Review scheduled work grouped by service day so dispatchers can spot collisions and handoff timing faster.
                </WorkspaceInlineNote>

                {dispatchQuery.isLoading ? (
                  <WorkspaceInlineNote>Loading dispatch timeline...</WorkspaceInlineNote>
                ) : null}

                {dispatchQuery.isError ? (
                  <WorkspaceInlineNote>Unable to load dispatch timeline.</WorkspaceInlineNote>
                ) : null}

                {!dispatchQuery.isLoading && !dispatchQuery.isError && !timelineGroups.length ? (
                  <WorkspaceInlineNote>No assignments are available for the current filters.</WorkspaceInlineNote>
                ) : null}

                <div className="grid gap-4">
                  {timelineGroups.map((group) => (
                    <div key={group.label} className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-base-content">{group.label}</p>
                          <p className="text-sm text-base-content/60">
                            {group.assignments.length} assignment{group.assignments.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        {group.assignments.map((assignment) => (
                          <button
                            key={assignment.id}
                            type="button"
                            className="grid gap-3 rounded-box border border-base-300/70 bg-base-100/70 p-4 text-left shadow-none transition hover:border-primary/30 hover:bg-base-100"
                            onClick={() => setSelectedAssignment(assignment)}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="grid gap-1">
                                <strong className="text-base-content">{assignment.requestNumber}</strong>
                                <span className="text-sm text-base-content/70">{assignment.customerName}</span>
                              </div>
                              <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                            </div>

                            <div className="grid gap-1 text-sm text-base-content/75">
                              <span>{assignment.assignedUserName}</span>
                              <span>
                                {formatDateTime(assignment.scheduledStartUtc)} to {formatDateTime(assignment.scheduledEndUtc)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <WorkspaceStatusPill tone={getFinanceTone(assignment.financeHandoffStatus)}>
                                {assignment.financeHandoffStatus}
                              </WorkspaceStatusPill>
                              <WorkspaceStatusPill tone={assignment.scheduleConflictCount > 0 ? "warning" : "neutral"}>
                                {assignment.scheduleConflictCount > 0 ? `${assignment.scheduleConflictCount} overlap(s)` : "Clear"}
                              </WorkspaceStatusPill>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </WorkspacePanel>
            )}

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Execution notes" title="Phase 6 rollout" />
              <WorkspaceNoteList
                items={[
                  "Assignment details now include schedule overlap visibility so admins can catch conflicts without leaving the register.",
                  "Dispatch history is now separated into assignment events and service audit trail instead of relying on service status changes alone.",
                  "Timeline mode now gives planners a day-grouped view, while hard overlaps on scheduled and in-progress work are blocked at save time."
                ]}
              />
            </WorkspacePanel>

            <WorkspaceFabDock
              actions={[
                {
                  key: "refresh-dispatch",
                  label: "Refresh dispatch workspace",
                  icon: "refresh",
                  onClick: () => {
                    void dispatchQuery.refetch();
                    if (isAdmin) {
                      void dispatchMetaQuery.refetch();
                    }
                  }
                },
                ...(isAdmin ? [{
                  key: "schedule-dispatch",
                  label: "Schedule assignment",
                  icon: "calendar" as const,
                  onClick: () => setIsScheduleModalOpen(true),
                  disabled: dispatchMetaQuery.isLoading ||
                    !dispatchMetaQuery.data?.assignableUsers.length ||
                    !dispatchMetaQuery.data?.serviceRequests.length
                }] : [])
              ]}
            />
          </RecordContentStack>
        </RecordWorkspace>

        <RecordFormModal
          open={isScheduleModalOpen}
          eyebrow="Dispatch planning"
          title="Schedule assignment"
          description="Assign a staff member to a live service request and set the expected service window."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsScheduleModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-dispatch-form"
                tone="primary"
                disabled={
                  createAssignmentMutation.isPending ||
                  dispatchMetaQuery.isLoading ||
                  !dispatchMetaQuery.data?.assignableUsers.length ||
                  !dispatchMetaQuery.data?.serviceRequests.length
                }
              >
                {createAssignmentMutation.isPending ? "Scheduling..." : "Schedule assignment"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsScheduleModalOpen(false)}
        >
          <WorkspaceForm id="tenant-dispatch-form" onSubmit={handleScheduleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Service request" wide>
                <WorkspaceSelect
                  value={scheduleForm.serviceRequestId}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, serviceRequestId: event.target.value }))}
                  required
                >
                  <option value="">Select service request</option>
                  {dispatchMetaQuery.data?.serviceRequests.map((serviceRequest) => (
                    <option key={serviceRequest.id} value={serviceRequest.id}>
                      {serviceRequest.requestNumber} - {serviceRequest.customerName} - {serviceRequest.itemType}
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Assigned staff">
                <WorkspaceSelect
                  value={scheduleForm.assignedUserId}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, assignedUserId: event.target.value }))}
                  required
                >
                  <option value="">Select staff member</option>
                  {dispatchMetaQuery.data?.assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.roles.join(", ")})
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Assignment status">
                <WorkspaceSelect
                  value={scheduleForm.assignmentStatus}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, assignmentStatus: event.target.value }))}
                >
                  {assignmentStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Scheduled start">
                <WorkspaceInput
                  type="datetime-local"
                  value={scheduleForm.scheduledStartUtc}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledStartUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Scheduled end">
                <WorkspaceInput
                  type="datetime-local"
                  value={scheduleForm.scheduledEndUtc}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledEndUtc: event.target.value }))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isRescheduleModalOpen}
          eyebrow="Dispatch reassignment"
          title="Reschedule assignment"
          description="Update assignment ownership, timing, and status while preserving a proper reassignment history."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsRescheduleModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-dispatch-reschedule-form"
                tone="primary"
                disabled={rescheduleAssignmentMutation.isPending || !dispatchMetaQuery.data?.assignableUsers.length}
              >
                {rescheduleAssignmentMutation.isPending ? "Saving..." : "Save reassignment"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsRescheduleModalOpen(false)}
        >
          <WorkspaceForm id="tenant-dispatch-reschedule-form" onSubmit={handleRescheduleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Assigned staff">
                <WorkspaceSelect
                  value={rescheduleForm.assignedUserId}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, assignedUserId: event.target.value }))}
                  required
                >
                  <option value="">Select staff member</option>
                  {dispatchMetaQuery.data?.assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.roles.join(", ")})
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Assignment status">
                <WorkspaceSelect
                  value={rescheduleForm.assignmentStatus}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, assignmentStatus: event.target.value }))}
                >
                  {assignmentStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Scheduled start">
                <WorkspaceInput
                  type="datetime-local"
                  value={rescheduleForm.scheduledStartUtc}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, scheduledStartUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Scheduled end">
                <WorkspaceInput
                  type="datetime-local"
                  value={rescheduleForm.scheduledEndUtc}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, scheduledEndUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Reason for change" wide>
                <WorkspaceInput
                  value={rescheduleForm.remarks}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, remarks: event.target.value }))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isEvidenceModalOpen}
          eyebrow="Technician evidence"
          title="Submit completion evidence"
          description="Attach job notes and supporting evidence for the selected assignment."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsEvidenceModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-dispatch-evidence-form"
                tone="primary"
                disabled={submitEvidenceMutation.isPending}
              >
                {submitEvidenceMutation.isPending ? "Uploading..." : "Submit evidence"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsEvidenceModalOpen(false)}
        >
          <WorkspaceForm id="tenant-dispatch-evidence-form" onSubmit={handleEvidenceSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Evidence note" wide>
                <WorkspaceInput
                  value={evidenceNote}
                  onChange={(event) => setEvidenceNote(event.target.value)}
                />
              </WorkspaceField>

              <WorkspaceField label="Photo attachments" wide>
                <WorkspaceFileInput
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isEvidenceEditModalOpen}
          eyebrow="Evidence review"
          title="Update evidence note"
          description="Refine or correct the note attached to the selected technician proof entry."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsEvidenceEditModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-dispatch-evidence-edit-form"
                tone="primary"
                disabled={updateEvidenceMutation.isPending}
              >
                {updateEvidenceMutation.isPending ? "Saving..." : "Save note"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsEvidenceEditModalOpen(false)}
        >
          <WorkspaceForm id="tenant-dispatch-evidence-edit-form" onSubmit={handleEvidenceEditSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Evidence note" wide>
                <WorkspaceInput
                  value={editingEvidenceNote}
                  onChange={(event) => setEditingEvidenceNote(event.target.value)}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordDetailsModal
          open={selectedAssignment !== null}
          eyebrow="Dispatch assignment"
          title={activeAssignment?.requestNumber ?? ""}
          sections={assignmentDetails}
          actions={activeAssignment ? (
            <>
              <WorkspaceModalButton onClick={() => setSelectedAssignment(null)}>
                Close
              </WorkspaceModalButton>
              {(isAdmin || activeAssignment.assignedUserId === currentUser?.userId) ? (
                <WorkspaceModalButton
                  onClick={() => setIsEvidenceModalOpen(true)}
                  disabled={submitEvidenceMutation.isPending}
                >
                  Add evidence
                </WorkspaceModalButton>
              ) : null}
              {isAdmin ? (
                <WorkspaceModalButton
                  onClick={openRescheduleModal}
                  disabled={rescheduleAssignmentMutation.isPending || dispatchMetaQuery.isLoading}
                >
                  Reschedule
                </WorkspaceModalButton>
              ) : null}
              {activeAssignment.assignmentStatus !== "In Progress" ? (
                <WorkspaceModalButton
                  tone="primary"
                  onClick={() => handleStatusUpdate(activeAssignment, "In Progress", "In Service")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Start work
                </WorkspaceModalButton>
              ) : null}
              {activeAssignment.assignmentStatus !== "On Hold" ? (
                <WorkspaceModalButton
                  onClick={() => handleStatusUpdate(activeAssignment, "On Hold")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Put on hold
                </WorkspaceModalButton>
              ) : null}
              {activeAssignment.assignmentStatus !== "Completed" ? (
                <WorkspaceModalButton
                  tone="primary"
                  onClick={() => handleStatusUpdate(activeAssignment, "Completed")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Mark completed
                </WorkspaceModalButton>
              ) : null}
            </>
          ) : null}
          onClose={() => setSelectedAssignment(null)}
        />
    </>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toIsoString(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset();
  const normalizedDate = new Date(date.getTime() - timezoneOffset * 60_000);
  return normalizedDate.toISOString().slice(0, 16);
}

function getFinanceTone(status: string) {
  switch (status) {
    case "Loan created":
      return "active";
    case "Ready for loan conversion":
    case "Ready for invoicing":
      return "warning";
    case "Invoice finalized":
      return "progress";
    default:
      return "neutral";
  }
}
