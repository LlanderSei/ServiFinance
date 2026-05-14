import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { httpDelete, httpGet, httpPostFormDataWithProgress, httpPostJson } from "@/shared/api/http";
import type { UploadProgressHandler } from "@/shared/api/http";
import { SmsModuleCodes, hasFullModuleAccess } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceInput,
  WorkspaceSelect,
  WorkspaceStatusPill,
  WorkspaceToggleButton
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

import { useDispatchPage } from "./useDispatchPage";
import { 
  SmsDispatchOverview, 
  SmsDispatchPendingTasks, 
  SmsDispatchAssignments, 
  SmsDispatchMyTasks, 
  SmsDispatchHistory, 
  SmsDispatchTimeline 
} from "./SmsDispatchSubviews";
import { 
  CancelAssignmentModal, 
  HandoverAssignmentModal, 
  AbandonAssignmentModal,
  ScheduleAssignmentModal,
  RescheduleAssignmentModal,
  EvidenceModal,
  EvidenceEditModal,
  AssignmentDetailsModal
} from "./SmsDispatchModals";

interface DispatchFilterState {
  assignedUserId: string;
  assignmentStatus: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
}

export function SmsDispatchPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const permissionKeys = new Set(currentUser?.permissionKeys ?? []);
  const canUseAdvancedScheduling = hasFullModuleAccess(currentUser, SmsModuleCodes.scheduling);
  const canUseFullEvidence = hasFullModuleAccess(currentUser, SmsModuleCodes.jobUpdates);
  const canViewDispatchRegister = permissionKeys.has("sms.dispatch.view");
  const canScheduleAssignments = permissionKeys.has("sms.dispatch.schedule");
  const canUpdateAssignments = permissionKeys.has("sms.dispatch.update-status");
  const canManageDispatchEvidence = permissionKeys.has("sms.dispatch.evidence.manage") && canUseFullEvidence;
  const canViewAllAssignments = canUserSeeAllDispatchAssignments(permissionKeys);
  const canViewDispatchOverview = canViewDispatchRegister && canViewAllAssignments;
  
  const [selectedAssignment, setSelectedAssignment] = useState<TenantDispatchAssignmentRow | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isEvidenceEditModalOpen, setIsEvidenceEditModalOpen] = useState(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { viewMode, setViewMode } = useDispatchPage();
  const [editingEvidence, setEditingEvidence] = useState<TenantDispatchAssignmentEvidenceRow | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isAbandonModalOpen, setIsAbandonModalOpen] = useState(false);

  const [filters, setFilters] = useState<DispatchFilterState>({
    assignedUserId: "",
    assignmentStatus: "",
    priority: "",
    dateFrom: "",
    dateTo: ""
  });

  const dispatchQueryString = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (filters.assignedUserId) searchParams.set("assignedUserId", filters.assignedUserId);
    if (filters.assignmentStatus) searchParams.set("assignmentStatus", filters.assignmentStatus);
    if (filters.priority) searchParams.set("priority", filters.priority);
    if (filters.dateFrom) searchParams.set("dateFrom", new Date(filters.dateFrom).toISOString());
    if (filters.dateTo) searchParams.set("dateTo", new Date(filters.dateTo).toISOString());
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
    enabled: canScheduleAssignments
  });

  const scheduleAssignmentReadiness = getScheduleAssignmentReadiness(
    canScheduleAssignments,
    dispatchMetaQuery.isLoading,
    dispatchMetaQuery.data?.assignableUsers.length ?? 0,
    dispatchMetaQuery.data?.serviceRequests.length ?? 0
  );

  const assignmentDetailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment?.id],
    queryFn: () =>
      httpGet<TenantDispatchAssignmentDetailResponse>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${selectedAssignment?.id}/details`
      ),
    enabled: selectedAssignment !== null
  });

  const createAssignmentMutation = useMutation<TenantDispatchAssignmentRow, Error, CreateTenantAssignmentRequest>({
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
      toast.error({ title: "Unable to create dispatch assignment", message: mutationError.message });
    }
  });

  const updateAssignmentStatusMutation = useMutation<TenantDispatchAssignmentRow, Error, { assignmentId: string; payload: UpdateTenantAssignmentStatusRequest; }>({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: UpdateTenantAssignmentStatusRequest; }) =>
      httpPostJson<TenantDispatchAssignmentRow, UpdateTenantAssignmentStatusRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/status`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", assignment.id] });
      setSelectedAssignment(assignment);
      toast.success({
        title: "Dispatch assignment updated",
        message: `Assignment ${assignment.requestNumber} moved to ${assignment.assignmentStatus}.`
      });
    },
    onError: (mutationError: Error) => {
      toast.error({ title: "Unable to update dispatch assignment", message: mutationError.message });
    }
  });

  const rescheduleAssignmentMutation = useMutation<TenantDispatchAssignmentRow, Error, { assignmentId: string; payload: RescheduleTenantAssignmentRequest; }>({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: RescheduleTenantAssignmentRequest; }) =>
      httpPostJson<TenantDispatchAssignmentRow, RescheduleTenantAssignmentRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/reschedule`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", assignment.id] });
      setSelectedAssignment(assignment);
      setIsRescheduleModalOpen(false);
      toast.success({
        title: "Assignment rescheduled",
        message: `Request ${assignment.requestNumber} was updated for ${assignment.assignedUserName}.`
      });
    },
    onError: (mutationError: Error) => {
      toast.error({ title: "Unable to reschedule assignment", message: mutationError.message });
    }
  });

  const submitEvidenceMutation = useMutation<any, Error, { assignmentId: string; payload: FormData; onProgress?: UploadProgressHandler }>({
    mutationFn: ({ assignmentId, payload, onProgress }: { assignmentId: string; payload: FormData; onProgress?: UploadProgressHandler }) =>
      httpPostFormDataWithProgress(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence`, payload, onProgress),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      setIsEvidenceModalOpen(false);
      toast.success({ title: "Evidence submitted", message: "Technician completion evidence is now attached to the assignment." });
    },
    onError: (mutationError: Error) => {
      toast.error({ title: "Unable to submit evidence", message: mutationError.message });
    },
    onSettled: () => {
      setEvidenceUploadProgress(null);
    }
  });

  const updateEvidenceMutation = useMutation<TenantDispatchAssignmentEvidenceRow, Error, { assignmentId: string; evidenceId: string; payload: UpdateTenantAssignmentEvidenceRequest; }>({
    mutationFn: ({ assignmentId, evidenceId, payload }: { assignmentId: string; evidenceId: string; payload: UpdateTenantAssignmentEvidenceRequest; }) =>
      httpPostJson<TenantDispatchAssignmentEvidenceRow, UpdateTenantAssignmentEvidenceRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence/${evidenceId}/note`,
        payload
      ),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      setIsEvidenceEditModalOpen(false);
      setEditingEvidence(null);
      toast.success({ title: "Evidence updated", message: "The technician evidence note was updated successfully." });
    },
    onError: (mutationError: Error) => {
      toast.error({ title: "Unable to update evidence", message: mutationError.message });
    }
  });

  const deleteEvidenceMutation = useMutation<void, Error, { assignmentId: string; evidenceId: string }>({
    mutationFn: ({ assignmentId, evidenceId }: { assignmentId: string; evidenceId: string }) =>
      httpDelete(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/evidence/${evidenceId}`),
    onSuccess: async () => {
      if (selectedAssignment) {
        await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      toast.success({ title: "Evidence removed", message: "The selected technician proof entry was removed." });
    },
    onError: (mutationError: Error) => {
      toast.error({ title: "Unable to remove evidence", message: mutationError.message });
    }
  });

  const cancelAssignmentMutation = useMutation<void, Error, { assignmentId: string; reason: string }>({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      httpPostJson(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/cancel`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      if (selectedAssignment) {
        void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      setIsCancelModalOpen(false);
      setSelectedAssignment(null);
      toast.success({ title: "Assignment cancelled", message: "The assignment has been cancelled." });
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to cancel assignment", message: error.message });
    }
  });

  const handoverAssignmentMutation = useMutation<void, Error, { assignmentId: string; newAssigneeUserId: string; reason: string }>({
    mutationFn: ({ assignmentId, newAssigneeUserId, reason }: { assignmentId: string; newAssigneeUserId: string; reason: string }) =>
      httpPostJson(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/handover`, { newAssigneeUserId, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      if (selectedAssignment) {
        void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      setIsHandoverModalOpen(false);
      setSelectedAssignment(null);
      toast.success({ title: "Assignment handed over", message: "The assignment has been reassigned." });
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to handover assignment", message: error.message });
    }
  });

  const abandonAssignmentMutation = useMutation<void, Error, { assignmentId: string; reason: string }>({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      httpPostJson(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/abandon`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      if (selectedAssignment) {
        void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-detail", selectedAssignment.id] });
      }
      setIsAbandonModalOpen(false);
      setSelectedAssignment(null);
      toast.success({ title: "Assignment abandoned", message: "The assignment has been moved back to pending tasks." });
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to abandon assignment", message: error.message });
    }
  });

  const acceptAssignmentMutation = useMutation<void, Error, { assignmentId: string }>({
    mutationFn: ({ assignmentId }: { assignmentId: string }) =>
      httpPostJson(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/accept`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      toast.success({ title: "Assignment accepted", message: "The handover task is now scheduled for execution." });
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to accept assignment", message: error.message });
    }
  });

  const rejectAssignmentMutation = useMutation<void, Error, { assignmentId: string; reason: string }>({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      httpPostJson(`/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/reject`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      toast.success({ title: "Assignment rejected", message: "The rejected handover was moved out of the active queue." });
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to reject assignment", message: error.message });
    }
  });

  const effectiveViewMode = canViewAllAssignments ? viewMode : "mine";

  const visibleAssignments = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    if (effectiveViewMode === "mine" && currentUser?.userId) {
      return assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId);
    }
    return assignments;
  }, [currentUser?.userId, dispatchQuery.data, effectiveViewMode]);

  const myAssignments = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    if (!currentUser?.userId) {
      return [];
    }

    return assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId);
  }, [currentUser?.userId, dispatchQuery.data]);

  const pendingAssignments = useMemo(
    () => visibleAssignments.filter((assignment) => isPendingDispatchAssignment(assignment)),
    [visibleAssignments]
  );

  const archivedAssignments = useMemo(
    () => visibleAssignments.filter((assignment) => isArchivedDispatchAssignment(assignment)),
    [visibleAssignments]
  );
  const dispatchTabs = useMemo(
    () => getDispatchTabs(canViewDispatchOverview, canViewDispatchRegister, canScheduleAssignments, canUseAdvancedScheduling),
    [canViewDispatchOverview, canViewDispatchRegister, canScheduleAssignments, canUseAdvancedScheduling]
  );
  const fallbackDispatchTab = dispatchTabs[0]?.key ?? "mytasks";
  const visibleActiveTab = dispatchTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : fallbackDispatchTab;
  const viewModeControls = canViewAllAssignments ? (
    <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-base-300/70 bg-base-100/88 p-1">
      <WorkspaceToggleButton className="min-w-0 justify-center px-3" active={effectiveViewMode === "all"} onClick={() => setViewMode("all")}>
        All assignments
      </WorkspaceToggleButton>
      <WorkspaceToggleButton className="min-w-0 justify-center px-3" active={effectiveViewMode === "mine"} onClick={() => setViewMode("mine")}>
        My assignments
      </WorkspaceToggleButton>
    </div>
  ) : (
    <WorkspaceStatusPill tone="neutral">My assignments only</WorkspaceStatusPill>
  );

  function handleStatusUpdate(assignment: TenantDispatchAssignmentRow, assignmentStatus: string, serviceStatus?: string) {
    if (!canUpdateAssignments) {
      toast.warning({
        title: "Permission required",
        message: "Your role cannot update dispatch assignment status."
      });
      return;
    }

    updateAssignmentStatusMutation.mutate({
      assignmentId: assignment.id,
      payload: {
        assignmentStatus,
        serviceStatus,
        remarks: `Dispatch status moved to ${assignmentStatus}.`
      }
    });
  }

  function canManageEvidence(evidence: TenantDispatchAssignmentEvidenceRow) {
    return canManageDispatchEvidence && (
      canScheduleAssignments ||
      evidence.submittedByUserId === currentUser?.userId
    );
  }

  function canCancelAssignment(assignment: TenantDispatchAssignmentRow): boolean {
    return canScheduleAssignments &&
      (assignment.assignedUserId === currentUser?.userId || canScheduleAssignments) &&
      !["Completed", "Cancelled", "Abandoned", "In Progress"].includes(assignment.assignmentStatus);
  }

  function canHandoverAssignment(assignment: TenantDispatchAssignmentRow): boolean {
    return canUseAdvancedScheduling &&
      canScheduleAssignments &&
      (assignment.assignedUserId === currentUser?.userId || canScheduleAssignments) &&
      !["Completed", "Cancelled", "In Progress"].includes(assignment.assignmentStatus);
  }

  function canAbandonAssignment(assignment: TenantDispatchAssignmentRow): boolean {
    return canScheduleAssignments &&
      (assignment.assignedUserId === currentUser?.userId || canScheduleAssignments) &&
      !["Completed", "Cancelled", "Abandoned", "In Progress"].includes(assignment.assignmentStatus);
  }

  function canRespondToAssignment(assignment: TenantDispatchAssignmentRow): boolean {
    return canUpdateAssignments &&
      assignment.assignmentStatus === "Pending Acceptance" &&
      (canScheduleAssignments || assignment.assignedUserId === currentUser?.userId);
  }

  function handleRejectAssignment(assignment: TenantDispatchAssignmentRow) {
    const reason = window.prompt(`Reason for rejecting ${assignment.requestNumber}`);
    if (!reason?.trim()) {
      return;
    }

    rejectAssignmentMutation.mutate({ assignmentId: assignment.id, reason: reason.trim() });
  }

  function renderTabContent() {
    const commonProps = {
      isLoading: dispatchQuery.isLoading,
      isError: dispatchQuery.isError,
      viewMode: effectiveViewMode,
      onSelectAssignment: setSelectedAssignment,
      formatDateTime,
      getFinanceTone
    };

    switch (visibleActiveTab) {
      case "overview":
        return (
          <SmsDispatchOverview 
            assignments={dispatchQuery.data ?? []} 
            currentUserId={currentUser?.userId ?? null}
            canCancelAssignment={canCancelAssignment}
            canHandoverAssignment={canHandoverAssignment}
            canAbandonAssignment={canAbandonAssignment}
            openCancelModal={(a) => { setSelectedAssignment(a); setIsCancelModalOpen(true); }}
            openHandoverModal={(a) => { setSelectedAssignment(a); setIsHandoverModalOpen(true); }}
            openAbandonModal={(a) => { setSelectedAssignment(a); setIsAbandonModalOpen(true); }}
            viewModeControls={viewModeControls}
            {...commonProps}
          />
        );
      case "pending":
        return (
          <SmsDispatchPendingTasks
            assignments={pendingAssignments}
            canRespondToAssignment={canRespondToAssignment}
            onAcceptAssignment={(assignment) => acceptAssignmentMutation.mutate({ assignmentId: assignment.id })}
            onRejectAssignment={handleRejectAssignment}
            isResponding={acceptAssignmentMutation.isPending || rejectAssignmentMutation.isPending}
            {...commonProps}
          />
        );
      case "assignments":
        return (
          <div className="grid gap-4">
            <WorkspacePanel className="shrink-0">
              <WorkspacePanelHeader eyebrow="Dispatch ledger" title="Assignment ledger" />
              <p className="text-sm text-base-content/68">
                Ledger keeps the flat assignment queue for filtered review. Use this tab for the broad dispatch board, while My Tasks stays scoped to the signed-in assignee.
              </p>
            </WorkspacePanel>
            <SmsDispatchAssignments assignments={visibleAssignments} {...commonProps} />
          </div>
        );
      case "mytasks":
        return (
          <SmsDispatchMyTasks
            assignments={myAssignments}
            canRespondToAssignment={canRespondToAssignment}
            onAcceptAssignment={(assignment) => acceptAssignmentMutation.mutate({ assignmentId: assignment.id })}
            onRejectAssignment={handleRejectAssignment}
            isResponding={acceptAssignmentMutation.isPending || rejectAssignmentMutation.isPending}
            {...commonProps}
          />
        );
      case "timeline":
        return (
          <SmsDispatchTimeline
            assignments={dispatchQuery.data ?? []}
            currentUserId={currentUser?.userId ?? null}
            viewMode={effectiveViewMode}
            setViewMode={(mode) => setViewMode(mode)}
          />
        );
      case "archive":
        return <SmsDispatchHistory assignments={archivedAssignments} {...commonProps} />;
      default:
        return null;
    }
  }

  return (
    <>
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / SMS / Dispatch`}
        title="Dispatch and assignments"
        description="Coordinate scheduled work, technician ownership, finance handoff state, and service execution from one tenant dispatch register."
        recordCount={visibleAssignments.length}
        singularLabel="assignment"
        headerBottom={
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <WorkspaceTopTabs tabs={dispatchTabs} activeTab={visibleActiveTab} onChange={setActiveTab} />
            <div className="hidden w-[min(24rem,38vw)] shrink-0 lg:block">
              {viewModeControls}
            </div>
          </div>
        }
      >
        <RecordContentStack>
          {visibleActiveTab === "assignments" ? (
            <DispatchFilterPanel
              filters={filters}
              setFilters={setFilters}
              meta={dispatchMetaQuery.data}
              canFilterStaff={canViewAllAssignments}
            />
          ) : null}
          {visibleActiveTab !== "overview" ? (
            <div className="flex w-full justify-end lg:hidden">
              {viewModeControls}
            </div>
          ) : null}
          {renderTabContent()}
          <WorkspaceFabDock
            actions={[
              {
                key: "refresh-dispatch",
                label: "Refresh dispatch workspace",
                icon: "refresh" as const,
                onClick: () => {
                  void dispatchQuery.refetch();
                  if (canScheduleAssignments) void dispatchMetaQuery.refetch();
                }
              },
              ...(canScheduleAssignments ? [{
                key: "schedule-dispatch",
                label: "Schedule assignment",
                icon: "calendar" as const,
                onClick: () => {
                  void dispatchMetaQuery.refetch().then((result) => {
                    if (result.error) {
                      toast.error({
                        title: "Unable to refresh dispatch options",
                        message: result.error.message
                      });
                      return;
                    }

                    if (!result.data?.assignableUsers.length) {
                      toast.warning({
                        title: "No active staff available",
                        message: "Activate or add an assignable tenant user before scheduling a dispatch assignment."
                      });
                      return;
                    }

                    if (!result.data?.serviceRequests.length) {
                      toast.warning({
                        title: "No schedulable service requests",
                        message: "Only live service requests can be scheduled into dispatch."
                      });
                      return;
                    }

                    setIsScheduleModalOpen(true);
                  });
                },
                disabled: !scheduleAssignmentReadiness.allowed,
                disabledReason: scheduleAssignmentReadiness.reason ?? undefined
              }] : [])
            ]}
          />
        </RecordContentStack>
      </RecordWorkspace>

      <ScheduleAssignmentModal
        open={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSubmit={(payload) => createAssignmentMutation.mutate(payload)}
        isPending={createAssignmentMutation.isPending}
        meta={dispatchMetaQuery.data}
        isLoadingMeta={dispatchMetaQuery.isLoading}
      />

      <RescheduleAssignmentModal
        open={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        onSubmit={(payload) => {
          if (selectedAssignment) rescheduleAssignmentMutation.mutate({ assignmentId: selectedAssignment.id, payload });
        }}
        isPending={rescheduleAssignmentMutation.isPending}
        meta={dispatchMetaQuery.data}
        isLoadingMeta={dispatchMetaQuery.isLoading}
        assignment={selectedAssignment}
      />

      <EvidenceModal
        open={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onSubmit={(payload) => {
          if (selectedAssignment) {
            setEvidenceUploadProgress(0);
            submitEvidenceMutation.mutate({
              assignmentId: selectedAssignment.id,
              payload,
              onProgress: setEvidenceUploadProgress
            });
          }
        }}
        isPending={submitEvidenceMutation.isPending}
        uploadProgress={evidenceUploadProgress}
      />

      <EvidenceEditModal
        open={isEvidenceEditModalOpen}
        onClose={() => setIsEvidenceEditModalOpen(false)}
        onSubmit={(note) => {
          if (selectedAssignment && editingEvidence) {
            updateEvidenceMutation.mutate({ 
              assignmentId: selectedAssignment.id, 
              evidenceId: editingEvidence.id, 
              payload: { note } 
            });
          }
        }}
        isPending={updateEvidenceMutation.isPending}
        evidence={editingEvidence}
      />

      <AssignmentDetailsModal
        open={selectedAssignment !== null}
        onClose={() => setSelectedAssignment(null)}
        assignment={selectedAssignment}
        detailData={assignmentDetailQuery.data}
        isLoadingDetail={assignmentDetailQuery.isLoading}
        currentUserId={currentUser?.userId}
        canAddEvidenceAction={canManageDispatchEvidence}
        canRescheduleAction={canScheduleAssignments && canUseAdvancedScheduling}
        canUpdateStatusAction={canUpdateAssignments}
        onAddEvidence={() => setIsEvidenceModalOpen(true)}
        onReschedule={() => setIsRescheduleModalOpen(true)}
        onStatusUpdate={handleStatusUpdate}
        onCancel={(a) => { setSelectedAssignment(a); setIsCancelModalOpen(true); }}
        onHandover={(a) => { setSelectedAssignment(a); setIsHandoverModalOpen(true); }}
        onAbandon={(a) => { setSelectedAssignment(a); setIsAbandonModalOpen(true); }}
        canCancel={canCancelAssignment}
        canHandover={canHandoverAssignment}
        canAbandon={canAbandonAssignment}
        formatDateTime={formatDateTime}
        getFinanceTone={getFinanceTone}
        isPendingStatusUpdate={updateAssignmentStatusMutation.isPending}
        isPendingCancel={cancelAssignmentMutation.isPending}
        isPendingHandover={handoverAssignmentMutation.isPending}
        isPendingAbandon={abandonAssignmentMutation.isPending}
        isPendingEvidence={submitEvidenceMutation.isPending}
        isPendingReschedule={rescheduleAssignmentMutation.isPending}
        openEvidenceEditModal={(e) => { setEditingEvidence(e); setIsEvidenceEditModalOpen(true); }}
        handleEvidenceDelete={(e) => {
          if (selectedAssignment && window.confirm(`Remove ${e.originalFileName ?? "this evidence note"}?`)) {
            deleteEvidenceMutation.mutate({ assignmentId: selectedAssignment.id, evidenceId: e.id });
          }
        }}
        canManageEvidence={canManageEvidence}
      />

      <CancelAssignmentModal
        open={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSubmit={(reason) => {
          if (selectedAssignment) cancelAssignmentMutation.mutate({ assignmentId: selectedAssignment.id, reason });
        }}
        isPending={cancelAssignmentMutation.isPending}
      />

      <HandoverAssignmentModal
        open={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        onSubmit={(newAssigneeUserId, reason) => {
          if (selectedAssignment) handoverAssignmentMutation.mutate({ assignmentId: selectedAssignment.id, newAssigneeUserId, reason });
        }}
        isPending={handoverAssignmentMutation.isPending}
        availableUsers={dispatchMetaQuery.data?.assignableUsers?.map(u => ({ id: u.id, fullName: u.fullName })) ?? []}
        currentAssigneeId={selectedAssignment?.assignedUserId ?? ""}
      />

      <AbandonAssignmentModal
        open={isAbandonModalOpen}
        onClose={() => setIsAbandonModalOpen(false)}
        onSubmit={(reason) => {
          if (selectedAssignment) abandonAssignmentMutation.mutate({ assignmentId: selectedAssignment.id, reason });
        }}
        isPending={abandonAssignmentMutation.isPending}
      />
    </>
  );
}

function getDispatchTabs(
  canViewOverview: boolean,
  canViewRegister: boolean,
  canScheduleAssignments: boolean,
  canUseAdvancedScheduling: boolean
) {
  return [
    ...(canViewOverview ? [{ key: "overview", label: "Overview" }] : []),
    { key: "pending", label: "Acceptance Queue" },
    ...(canViewRegister ? [{ key: "assignments", label: "Ledger" }] : []),
    { key: "mytasks", label: "My Tasks" },
    ...(canUseAdvancedScheduling ? [{ key: "timeline", label: "Timeline" }] : []),
    ...(canScheduleAssignments ? [{ key: "archive", label: "Archive" }] : []),
  ];
}

function canUserSeeAllDispatchAssignments(permissionKeys: Set<string>) {
  return permissionKeys.has("sms.dispatch.schedule") ||
    permissionKeys.has("sms.customers.view") ||
    permissionKeys.has("sms.reports.view") ||
    permissionKeys.has("sms.sla-escalations.view") ||
    permissionKeys.has("sms.feedback-crm.view") ||
    permissionKeys.has("sms.cost-control.view") ||
    permissionKeys.has("sms.users.manage") ||
    permissionKeys.has("sms.roles-permissions.manage") ||
    permissionKeys.has("sms.audits.view");
}

function getScheduleAssignmentReadiness(
  hasActionPermission: boolean,
  isLoadingMeta: boolean,
  assignableUserCount: number,
  schedulableRequestCount: number
) {
  if (!hasActionPermission) {
    return { allowed: false, reason: "Your role cannot schedule dispatch assignments." };
  }

  if (isLoadingMeta) {
    return { allowed: false, reason: "Dispatch options are still loading." };
  }

  if (assignableUserCount <= 0) {
    return { allowed: false, reason: "Add or activate an assignable tenant user before scheduling work." };
  }

  if (schedulableRequestCount <= 0) {
    return { allowed: false, reason: "Only live service requests can be scheduled into dispatch." };
  }

  return { allowed: true, reason: null };
}

function DispatchFilterPanel({
  filters,
  setFilters,
  meta,
  canFilterStaff
}: {
  filters: DispatchFilterState;
  setFilters: (filters: DispatchFilterState) => void;
  meta?: TenantDispatchMetaResponse;
  canFilterStaff: boolean;
}) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const clearFilters = () => setFilters({
    assignedUserId: "",
    assignmentStatus: "",
    priority: "",
    dateFrom: "",
    dateTo: ""
  });

  return (
    <>
      <WorkspacePanel className="shrink-0">
        <WorkspacePanelHeader
          eyebrow="Filters"
          title="Assignment ledger filters"
          actions={(
            <>
              <WorkspaceActionButton className="lg:hidden" onClick={() => setIsMobileFiltersOpen(true)}>
                Options
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={clearFilters}>
                Clear filters
              </WorkspaceActionButton>
            </>
          )}
        />
        <div className="hidden min-w-0 overflow-x-auto overflow-y-hidden pb-1 lg:block">
          <div className="grid w-full grid-cols-5 items-end gap-4">
            <DispatchFilterFields
              filters={filters}
              setFilters={setFilters}
              meta={meta}
              canFilterStaff={canFilterStaff}
            />
          </div>
        </div>
      </WorkspacePanel>

      {isMobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileFiltersOpen(false)}
          role="presentation"
        >
          <section
            className="grid max-h-[86dvh] w-full grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.5rem] border border-base-300/70 bg-base-100 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-base-300/70 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Filters</p>
                <h3 className="mt-1 text-lg font-black tracking-[-0.04em] text-base-content">Assignment options</h3>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-sm border-base-300/70 bg-base-100 text-base-content shadow-none"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close dispatch filters"
              >
                x
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="grid gap-4">
                <DispatchFilterFields
                  filters={filters}
                  setFilters={setFilters}
                  meta={meta}
                  canFilterStaff={canFilterStaff}
                />
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-base-300/70 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <WorkspaceActionButton onClick={clearFilters}>
                Clear filters
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => setIsMobileFiltersOpen(false)}>
                Apply
              </WorkspaceActionButton>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function DispatchFilterFields({
  filters,
  setFilters,
  meta,
  canFilterStaff
}: {
  filters: DispatchFilterState;
  setFilters: (filters: DispatchFilterState) => void;
  meta?: TenantDispatchMetaResponse;
  canFilterStaff: boolean;
}) {
  return (
    <>
      {canFilterStaff ? (
        <WorkspaceField label="Assigned staff">
          <WorkspaceSelect
            value={filters.assignedUserId}
            onChange={(event) => setFilters({ ...filters, assignedUserId: event.target.value })}
          >
            <option value="">All staff</option>
            {(meta?.assignableUsers ?? []).map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </WorkspaceSelect>
        </WorkspaceField>
      ) : null}
      <WorkspaceField label="Assignment status">
        <WorkspaceSelect
          value={filters.assignmentStatus}
          onChange={(event) => setFilters({ ...filters, assignmentStatus: event.target.value })}
        >
          <option value="">All statuses</option>
          <option value="Pending Acceptance">Pending Acceptance</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Abandoned">Abandoned</option>
        </WorkspaceSelect>
      </WorkspaceField>
      <WorkspaceField label="Priority">
        <WorkspaceSelect
          value={filters.priority}
          onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
        >
          <option value="">All priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </WorkspaceSelect>
      </WorkspaceField>
      <WorkspaceField label="Date from">
        <WorkspaceInput
          type="date"
          value={filters.dateFrom}
          onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
        />
      </WorkspaceField>
      <WorkspaceField label="Date to">
        <WorkspaceInput
          type="date"
          value={filters.dateTo}
          onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
        />
      </WorkspaceField>
    </>
  );
}

function isPendingDispatchAssignment(assignment: TenantDispatchAssignmentRow) {
  return ["Pending Acceptance", "Scheduled", "On Hold"].includes(assignment.assignmentStatus);
}

function isArchivedDispatchAssignment(assignment: TenantDispatchAssignmentRow) {
  return ["Completed", "Cancelled", "Abandoned"].includes(assignment.assignmentStatus);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function getFinanceTone(status: string): "active" | "warning" | "progress" | "neutral" {
  switch (status) {
    case "Loan created":
    case "Direct settlement completed":
      return "active";
    case "Ready for loan conversion":
    case "Ready for invoicing":
      return "warning";
    case "Invoice finalized":
    case "Customer checkout in progress":
    case "Direct settlement under review":
    case "Direct settlement in progress":
      return "progress";
    default:
      return "neutral";
  }
}
