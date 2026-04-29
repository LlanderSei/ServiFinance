import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateTenantAssignmentRequest,
  TenantServiceRequestRow,
  TenantDispatchMetaResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceStatusPill,
} from "@/shared/records/WorkspaceControls";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { useToast } from "@/shared/toast/ToastProvider";

interface PendingTasksProps {
  tenantDomainSlug: string;
  onAssignmentCreated: () => void;
  isAdmin: boolean;
}

type ScheduleFormState = {
  serviceRequestId: string;
  assignedUserId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  assignmentStatus: string;
};

const assignmentStatuses = ["Scheduled", "In Progress", "On Hold", "Completed"] as const;

export function SmsDispatchPendingTasks({ tenantDomainSlug, onAssignmentCreated, isAdmin }: PendingTasksProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedRequest, setSelectedRequest] = useState<TenantServiceRequestRow | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    serviceRequestId: "",
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "Scheduled"
  });

   const serviceRequestsQuery = useQuery({
     queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"],
     queryFn: () => httpGet<TenantServiceRequestRow[]>(`/api/tenants/${tenantDomainSlug}/sms/service-requests`)
   });

   const metaQuery = useQuery({
     queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-meta"],
     queryFn: () => httpGet<TenantDispatchMetaResponse>(`/api/tenants/${tenantDomainSlug}/sms/dispatch/meta`),
     enabled: isAdmin
   });

   const createAssignmentMutation = useMutation({
    mutationFn: (payload: CreateTenantAssignmentRequest) =>
      httpPostJson<any, CreateTenantAssignmentRequest>(`/api/tenants/${tenantDomainSlug}/sms/dispatch`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      setIsScheduleModalOpen(false);
      setSelectedRequest(null);
      setScheduleForm({ serviceRequestId: "", assignedUserId: "", scheduledStartUtc: "", scheduledEndUtc: "", assignmentStatus: "Scheduled" });
      toast.success({ title: "Assignment created", message: "Service request has been scheduled." });
      onAssignmentCreated?.();
    },
    onError: (error: Error) => {
      toast.error({ title: "Unable to create assignment", message: error.message });
    }
  });

  function openScheduleModal(request: TenantServiceRequestRow) {
    setSelectedRequest(request);
    setScheduleForm(prev => ({ ...prev, serviceRequestId: request.id }));
    setIsScheduleModalOpen(true);
  }

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleForm.serviceRequestId || !scheduleForm.assignedUserId) return;
    createAssignmentMutation.mutate({
      serviceRequestId: scheduleForm.serviceRequestId,
      assignedUserId: scheduleForm.assignedUserId,
      scheduledStartUtc: scheduleForm.scheduledStartUtc || null,
      scheduledEndUtc: scheduleForm.scheduledEndUtc || null,
      assignmentStatus: scheduleForm.assignmentStatus
    });
  }

  const pendingRequests = useMemo(() => {
    const all = serviceRequestsQuery.data ?? [];
    // In a real app, you'd filter to unassigned requests.
    // For now, show all service requests as "pending" since they don't have assignments yet.
    return all;
  }, [serviceRequestsQuery.data]);

  return (
    <RecordScrollRegion>
      <RecordTableShell>
        <RecordTable>
          <thead>
            <tr>
              <th>Request No.</th>
              <th>Customer</th>
              <th>Item</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {serviceRequestsQuery.isLoading ? (
              <RecordTableStateRow colSpan={7}>Loading service requests...</RecordTableStateRow>
            ) : null}
            {serviceRequestsQuery.isError ? (
              <RecordTableStateRow colSpan={7} tone="error">Unable to load service requests.</RecordTableStateRow>
            ) : null}
            {!serviceRequestsQuery.isLoading && !serviceRequestsQuery.isError && pendingRequests.length === 0 ? (
              <RecordTableStateRow colSpan={7}>No pending service requests.</RecordTableStateRow>
            ) : null}
            {pendingRequests.map((req) => (
              <tr key={req.id}>
                <td>{req.requestNumber}</td>
                <td>{req.customerName}</td>
                <td>{req.itemType}</td>
                <td>
                  <WorkspaceStatusPill tone="active">{req.currentStatus}</WorkspaceStatusPill>
                </td>
                <td>{req.priority}</td>
                <td>{new Date(req.createdAtUtc).toLocaleDateString()}</td>
                <td>
                  {isAdmin ? (
                    <RecordTableActionButton onClick={() => openScheduleModal(req)}>
                      Schedule
                    </RecordTableActionButton>
                  ) : (
                    <span className="text-sm text-base-content/60">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      </RecordTableShell>

      {/* Schedule modal */}
      <RecordFormModal
        open={isScheduleModalOpen}
        eyebrow="Dispatch planning"
        title="Schedule assignment"
        description="Assign a staff member to this service request."
        actions={
          <>
            <WorkspaceModalButton onClick={() => setIsScheduleModalOpen(false)}>Cancel</WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="pending-schedule-form"
              tone="primary"
              disabled={createAssignmentMutation.isPending}
            >
              {createAssignmentMutation.isPending ? "Scheduling..." : "Schedule assignment"}
            </WorkspaceModalButton>
          </>
        }
        onClose={() => setIsScheduleModalOpen(false)}
      >
        <WorkspaceForm id="pending-schedule-form" onSubmit={handleScheduleSubmit}>
          <WorkspaceFieldGrid>
            <WorkspaceField label="Service request" wide>
              <div className="p-2 border rounded bg-base-200/30">
                {selectedRequest?.requestNumber} - {selectedRequest?.customerName} - {selectedRequest?.itemType}
              </div>
            </WorkspaceField>

            <WorkspaceField label="Assigned staff">
              <WorkspaceSelect
                value={scheduleForm.assignedUserId}
                onChange={(e) => setScheduleForm((cur) => ({ ...cur, assignedUserId: e.target.value }))}
              >
                <option value="">Select staff member</option>
                {(metaQuery.data?.assignableUsers ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>

            <WorkspaceField label="Assignment status">
              <WorkspaceSelect
                value={scheduleForm.assignmentStatus}
                onChange={(e) => setScheduleForm((cur) => ({ ...cur, assignmentStatus: e.target.value }))}
              >
                {assignmentStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>

            <WorkspaceField label="Scheduled start">
              <input
                type="datetime-local"
                className="input input-bordered w-full rounded-xl border-base-300/70 bg-base-100 text-base-content"
                value={scheduleForm.scheduledStartUtc}
                onChange={(e) => setScheduleForm((cur) => ({ ...cur, scheduledStartUtc: e.target.value }))}
              />
            </WorkspaceField>

            <WorkspaceField label="Scheduled end">
              <input
                type="datetime-local"
                className="input input-bordered w-full rounded-xl border-base-300/70 bg-base-100 text-base-content"
                value={scheduleForm.scheduledEndUtc}
                onChange={(e) => setScheduleForm((cur) => ({ ...cur, scheduledEndUtc: e.target.value }))}
              />
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </WorkspaceForm>
      </RecordFormModal>
    </RecordScrollRegion>
  );
}
