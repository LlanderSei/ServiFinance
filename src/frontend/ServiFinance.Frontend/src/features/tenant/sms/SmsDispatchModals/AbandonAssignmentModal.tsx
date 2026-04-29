import { FormEvent, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { WorkspaceForm, WorkspaceField, WorkspaceModalButton } from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

interface AbandonAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}

export function AbandonAssignmentModal({ open, onClose, onSubmit, isPending }: AbandonAssignmentModalProps) {
  const [reason, setReason] = useState("");
  const toast = useToast();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.warning({ title: "Reason required", message: "Provide a reason for abandoning this assignment." });
      return;
    }
    onSubmit(reason);
    setReason("");
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Assignment action"
      title="Abandon assignment"
      description="Mark this assignment as abandoned. It will be moved back to pending tasks. This action cannot be undone."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose} disabled={isPending}>
            Keep assignment
          </WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="abandon-assignment-form"
            tone="danger"
            disabled={isPending}
          >
            {isPending ? "Abandoning..." : "Confirm abandon"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="abandon-assignment-form" onSubmit={handleSubmit}>
        <WorkspaceField label="Abandon reason">
          <textarea
            className="textarea textarea-bordered w-full rounded-xl border-base-300/70 bg-base-100 text-base-content"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this assignment is being abandoned..."
          />
        </WorkspaceField>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
