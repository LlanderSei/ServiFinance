import { FormEvent, useEffect, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceInput,
} from "@/shared/records/WorkspaceControls";
import type { TenantDispatchMetaResponse, RescheduleTenantAssignmentRequest, TenantDispatchAssignmentRow } from "@/shared/api/contracts";

interface RescheduleAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RescheduleTenantAssignmentRequest) => void;
  isPending: boolean;
  meta: TenantDispatchMetaResponse | undefined;
  isLoadingMeta: boolean;
  assignment: TenantDispatchAssignmentRow | null;
}

const assignmentStatuses = ["Scheduled", "In Progress", "On Hold", "Completed"] as const;

export function RescheduleAssignmentModal({
  open,
  onClose,
  onSubmit,
  isPending,
  meta,
  isLoadingMeta,
  assignment,
}: RescheduleAssignmentModalProps) {
  const [form, setForm] = useState({
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "",
    remarks: "",
  });

  useEffect(() => {
    if (assignment) {
      setForm({
        assignedUserId: assignment.assignedUserId,
        scheduledStartUtc: toDateTimeLocalValue(assignment.scheduledStartUtc),
        scheduledEndUtc: toDateTimeLocalValue(assignment.scheduledEndUtc),
        assignmentStatus: assignment.assignmentStatus,
        remarks: "",
      });
    }
  }, [assignment]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      assignedUserId: form.assignedUserId,
      scheduledStartUtc: form.scheduledStartUtc ? new Date(form.scheduledStartUtc).toISOString() : null,
      scheduledEndUtc: form.scheduledEndUtc ? new Date(form.scheduledEndUtc).toISOString() : null,
      assignmentStatus: form.assignmentStatus,
      remarks: form.remarks || null,
    });
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Dispatch reassignment"
      title="Reschedule assignment"
      description="Update assignment ownership, timing, and status while preserving a proper reassignment history."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="tenant-reschedule-form"
            tone="primary"
            disabled={isPending || isLoadingMeta}
          >
            {isPending ? "Updating..." : "Reschedule assignment"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="tenant-reschedule-form" onSubmit={handleSubmit}>
        <WorkspaceFieldGrid>
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

          <WorkspaceField label="Reassignment remarks" wide>
            <WorkspaceInput
              value={form.remarks}
              onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              placeholder="Explain why this assignment was rescheduled or reassigned."
            />
          </WorkspaceField>
        </WorkspaceFieldGrid>
      </WorkspaceForm>
    </RecordFormModal>
  );
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
