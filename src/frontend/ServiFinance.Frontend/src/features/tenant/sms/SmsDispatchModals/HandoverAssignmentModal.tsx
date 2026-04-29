import { FormEvent, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { WorkspaceForm, WorkspaceField, WorkspaceSelect, WorkspaceModalButton } from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

interface HandoverAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newAssigneeUserId: string, reason: string) => void;
  isPending: boolean;
  availableUsers: Array<{ id: string; fullName: string }>;
  currentAssigneeId: string;
}

export function HandoverAssignmentModal({
  open,
  onClose,
  onSubmit,
  isPending,
  availableUsers,
  currentAssigneeId
}: HandoverAssignmentModalProps) {
  const [newAssignee, setNewAssignee] = useState("");
  const [reason, setReason] = useState("");
  const toast = useToast();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newAssignee) {
      toast.warning({ title: "Select a staff member", message: "Choose who to handover this assignment to." });
      return;
    }
    if (!reason.trim()) {
      toast.warning({ title: "Reason required", message: "Provide a reason for the handover." });
      return;
    }
    onSubmit(newAssignee, reason);
    setNewAssignee("");
    setReason("");
  }

  const filteredUsers = availableUsers.filter(u => u.id !== currentAssigneeId);

  return (
    <RecordFormModal
      open={open}
      eyebrow="Assignment handover"
      title="Handover assignment"
      description="Reassign this assignment to another staff member. The current assignee will be notified."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose} disabled={isPending}>
            Cancel
          </WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="handover-assignment-form"
            tone="primary"
            disabled={isPending || !newAssignee}
          >
            {isPending ? "Handing over..." : "Confirm handover"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="handover-assignment-form" onSubmit={handleSubmit}>
        <WorkspaceField label="New assignee">
          <WorkspaceSelect
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
          >
            <option value="">Select staff member</option>
            {filteredUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </WorkspaceSelect>
        </WorkspaceField>

        <WorkspaceField label="Handover reason">
          <textarea
            className="textarea textarea-bordered w-full rounded-xl border-base-300/70 bg-base-100 text-base-content"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this assignment is being handed over..."
          />
        </WorkspaceField>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
