import { useEffect, useState } from "react";

type ImagePreviewModalProps = {
  open: boolean;
  title: string;
  imageUrl: string | null;
  description?: string;
  onClose: () => void;
};

export function ImagePreviewModal({
  open,
  title,
  imageUrl,
  description,
  onClose
}: ImagePreviewModalProps) {
  const [stackZIndex, setStackZIndex] = useState(140);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextModalStack = ((window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack ?? 120) + 2;
    (window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack = nextModalStack;
    setStackZIndex(nextModalStack);
  }, [open]);

  if (!open || !imageUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-black/68 p-3 md:p-5"
      style={{ zIndex: stackZIndex }}
      onClick={onClose}
    >
      <div
        className="flex h-[min(88vh,48rem)] w-full max-w-[min(64rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.6rem] border border-base-300/70 bg-base-100 shadow-2xl"
        style={{ zIndex: stackZIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-base-300/70 px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
              Image preview
            </p>
            <h2 className="mt-1.5 mb-0 break-words text-xl font-semibold tracking-[-0.04em] text-base-content [overflow-wrap:anywhere]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 mb-0 break-words text-sm leading-6 text-base-content/65 [overflow-wrap:anywhere]">
                {description}
              </p>
            ) : null}
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost" onClick={onClose} aria-label="Close image preview">
            x
          </button>
        </header>

        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-base-200/55 p-3 md:p-5">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-full max-w-full rounded-[1.1rem] object-contain shadow-[0_24px_60px_rgba(0,0,0,0.24)]"
          />
        </div>

        <footer className="flex justify-end border-t border-base-300/70 px-5 py-4">
          <button type="button" className="btn rounded-full" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
