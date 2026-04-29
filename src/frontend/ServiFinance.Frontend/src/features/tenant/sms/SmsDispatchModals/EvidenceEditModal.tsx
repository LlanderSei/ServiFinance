import { FormEvent, useEffect, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceModalButton,
  WorkspaceInput,
} from "@/shared/records/WorkspaceControls";
import type { TenantDispatchAssignmentEvidenceRow } from "@/shared/api/contracts";

interface EvidenceEditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  isPending: boolean;
  evidence: TenantDispatchAssignmentEvidenceRow | null;
}

export function EvidenceEditModal({
  open,
  onClose,
  onSubmit,
  isPending,
  evidence,
}: EvidenceEditModalProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (evidence) {
      setNote(evidence.note);
    }
  }, [evidence]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(note);
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Evidence review"
      title="Update evidence note"
      description="Refine or correct the note attached to the selected technician proof entry."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="tenant-dispatch-evidence-edit-form"
            tone="primary"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save note"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="tenant-dispatch-evidence-edit-form" onSubmit={handleSubmit}>
        <WorkspaceFieldGrid>
          <WorkspaceField label="Evidence note" wide>
            <WorkspaceInput
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </WorkspaceField>
        </WorkspaceFieldGrid>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
