import type { CustomerRequestAttachment } from "../useCustomerRequests";
import { EmptyState, Panel, formatDateTime } from "./CustomerRequestDetailsShared";

type CustomerRequestEvidenceTabProps = {
  attachments: CustomerRequestAttachment[];
};

export function CustomerRequestEvidenceTab({ attachments }: CustomerRequestEvidenceTabProps) {
  return (
    <Panel title="Customer pictures" eyebrow="Intake evidence">
      {attachments.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.relativeUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white no-underline shadow-[0_10px_24px_rgba(35,46,76,0.05)]"
            >
              <img
                src={attachment.relativeUrl}
                alt={attachment.originalFileName}
                className="h-44 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-950">{attachment.originalFileName}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(attachment.createdAtUtc)}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState message="No customer pictures were uploaded for this request." />
      )}
    </Panel>
  );
}
