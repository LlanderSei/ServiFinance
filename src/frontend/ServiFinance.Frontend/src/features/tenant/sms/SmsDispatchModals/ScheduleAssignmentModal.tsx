import { FormEvent, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceInput,
} from "@/shared/records/WorkspaceControls";
import type { TenantDispatchMetaResponse, CreateTenantAssignmentRequest } from "@/shared/api/contracts";

interface ScheduleAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTenantAssignmentRequest) => void;
  isPending: boolean;
  meta: TenantDispatchMetaResponse | undefined;
  isLoadingMeta: boolean;
}

const assignmentStatuses = ["Scheduled", "In Progress", "On Hold", "Completed"] as const;

export function ScheduleAssignmentModal({
  open,
  onClose,
  onSubmit,
  isPending,
  meta,
  isLoadingMeta,
}: ScheduleAssignmentModalProps) {
  const [form, setForm] = useState({
    serviceRequestId: "",
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "Scheduled",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      serviceRequestId: form.serviceRequestId,
      assignedUserId: form.assignedUserId,
      scheduledStartUtc: form.scheduledStartUtc ? new Date(form.scheduledStartUtc).toISOString() : null,
      scheduledEndUtc: form.scheduledEndUtc ? new Date(form.scheduledEndUtc).toISOString() : null,
      assignmentStatus: form.assignmentStatus,
    });
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Dispatch planning"
      title="Schedule assignment"
      description="Assign a staff member to a live service request and set the expected service window."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="tenant-dispatch-form"
            tone="primary"
            disabled={
              isPending ||
              isLoadingMeta ||
              !meta?.assignableUsers.length ||
              !meta?.serviceRequests.length
            }
          >
            {isPending ? "Scheduling..." : "Schedule assignment"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="tenant-dispatch-form" onSubmit={handleSubmit}>
        <WorkspaceFieldGrid>
          <WorkspaceField label="Service request" wide>
            <WorkspaceSelect
              value={form.serviceRequestId}
              onChange={(event) => setForm((current) => ({ ...current, serviceRequestId: event.target.value }))}
              required
            >
              <option value="">Select service request</option>
              {meta?.serviceRequests.map((serviceRequest) => (
                <option key={serviceRequest.id} value={serviceRequest.id}>
                  {serviceRequest.requestNumber} - {serviceRequest.customerName} - {serviceRequest.itemType}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>

          <WorkspaceField label="Assigned staff">
            <WorkspaceSelect
              value={form.assignedUserId}
              onChange={(event) => setForm((current) => ({ ...current, assignedUserId: event.target.value }))}
              required
            >
              <option value="">Select staff member</option>
              {meta?.assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.roles.join(", ")})
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>

          <WorkspaceField label="Assignment status">
            <WorkspaceSelect
              value={form.assignmentStatus}
              onChange={(event) => setForm((current) => ({ ...current, assignmentStatus: event.target.value }))}
            >
              {assignmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>

          <WorkspaceField label="Scheduled start">
            <WorkspaceInput
              type="datetime-local"
              value={form.scheduledStartUtc}
              onChange={(event) => setForm((current) => ({ ...current, scheduledStartUtc: event.target.value }))}
            />
          </WorkspaceField>

          <WorkspaceField label="Scheduled end">
            <WorkspaceInput
              type="datetime-local"
              value={form.scheduledEndUtc}
              onChange={(event) => setForm((current) => ({ ...current, scheduledEndUtc: event.target.value }))}
            />
          </WorkspaceField>
        </WorkspaceFieldGrid>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
