import { useState } from "react";
import { ImagePreviewModal } from "@/shared/uploads/ImagePreviewModal";
import type { CustomerRequestAttachment } from "../useCustomerRequests";
import { EmptyState, Panel, formatDateTime } from "./CustomerRequestDetailsShared";

type CustomerRequestEvidenceTabProps = {
  attachments: CustomerRequestAttachment[];
};

export function CustomerRequestEvidenceTab({ attachments }: CustomerRequestEvidenceTabProps) {
  const [previewAttachment, setPreviewAttachment] = useState<CustomerRequestAttachment | null>(null);

  return (
    <>
      <Panel title="Customer pictures" eyebrow="Intake evidence">
        {attachments.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                className="group min-w-0 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white text-left shadow-[0_10px_24px_rgba(35,46,76,0.05)] transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => setPreviewAttachment(attachment)}
              >
                <img
                  src={attachment.relativeUrl}
                  alt={attachment.originalFileName}
                  className="h-44 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <div className="min-w-0 px-4 py-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{attachment.originalFileName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(attachment.createdAtUtc)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState message="No customer pictures were uploaded for this request." />
        )}
      </Panel>

      <ImagePreviewModal
        open={Boolean(previewAttachment)}
        title={previewAttachment?.originalFileName ?? "Customer picture"}
        imageUrl={previewAttachment?.relativeUrl ?? null}
        description={previewAttachment ? formatDateTime(previewAttachment.createdAtUtc) : undefined}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
