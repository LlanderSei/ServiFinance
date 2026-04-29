import { FormEvent, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { WorkspaceForm, WorkspaceField, WorkspaceModalButton } from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

interface CancelAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}

export function CancelAssignmentModal({ open, onClose, onSubmit, isPending }: CancelAssignmentModalProps) {
  const [reason, setReason] = useState("");
  const toast = useToast();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.warning({ title: "Reason required", message: "Please provide a cancellation reason." });
      return;
    }
    onSubmit(reason);
    setReason("");
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Assignment action"
      title="Cancel assignment"
      description="Provide a reason for cancelling this assignment. This action cannot be undone."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose} disabled={isPending}>
            Keep assignment
          </WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="cancel-assignment-form"
            tone="danger"
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : "Cancel assignment"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="cancel-assignment-form" onSubmit={handleSubmit}>
        <WorkspaceField label="Cancellation reason">
          <textarea
            className="textarea textarea-bordered w-full rounded-xl border-base-300/70 bg-base-100 text-base-content"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this assignment is being cancelled..."
          />
        </WorkspaceField>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
