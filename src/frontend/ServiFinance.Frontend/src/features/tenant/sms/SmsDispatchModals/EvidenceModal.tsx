import { FormEvent, useState } from "react";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceModalButton,
  WorkspaceInput,
  WorkspaceFileInput,
} from "@/shared/records/WorkspaceControls";

interface EvidenceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}

export function EvidenceModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: EvidenceModalProps) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.append("note", note);
    files.forEach((file) => {
      formData.append("files", file);
    });
    onSubmit(formData);
    // Reset state after submit
    setNote("");
    setFiles([]);
  }

  return (
    <RecordFormModal
      open={open}
      eyebrow="Service completion"
      title="Submit technician evidence"
      description="Attach notes and photo proof to document the finished service execution."
      actions={
        <>
          <WorkspaceModalButton onClick={onClose}>Cancel</WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="tenant-dispatch-evidence-form"
            tone="primary"
            disabled={isPending}
          >
            {isPending ? "Uploading..." : "Submit evidence"}
          </WorkspaceModalButton>
        </>
      }
      onClose={onClose}
    >
      <WorkspaceForm id="tenant-dispatch-evidence-form" onSubmit={handleSubmit}>
        <WorkspaceFieldGrid>
          <WorkspaceField label="Evidence note" wide>
            <WorkspaceInput
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </WorkspaceField>

          <WorkspaceField label="Photo attachments" wide>
            <WorkspaceFileInput
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </WorkspaceField>
        </WorkspaceFieldGrid>
      </WorkspaceForm>
    </RecordFormModal>
  );
}
