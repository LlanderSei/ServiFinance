import { useEffect, useState, type ReactNode } from "react";

type RecordFormModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
};

export function RecordFormModal({
  open,
  title,
  eyebrow,
  description,
  children,
  actions,
  onClose
}: RecordFormModalProps) {
  const [stackZIndex, setStackZIndex] = useState(90);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextModalStack = ((window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack ?? 80) + 2;
    (window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack = nextModalStack;
    setStackZIndex(nextModalStack);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/60 p-2 lg:p-4" style={{ zIndex: stackZIndex }} onClick={onClose}>
      <div
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[44rem] flex-col overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 text-base-content shadow-2xl lg:max-h-[min(90vh,48rem)] lg:rounded-[1.6rem]"
        style={{ zIndex: stackZIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-base-300/70 px-4 pt-4 pb-3 pr-14 lg:px-5 lg:pt-5 lg:pb-4">
          <div>
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{eyebrow}</p>
            <h2 className="mt-1.5 mb-0 text-[1.8rem] tracking-[-0.04em] text-base-content">{title}</h2>
            {description ? <p className="mt-2 mb-0 max-w-[34rem] text-[0.95rem] leading-6 text-base-content/70">{description}</p> : null}
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost absolute right-3 top-3 z-10" onClick={onClose} aria-label="Close form">
            x
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
          <div className="grid gap-4">
            {children}
          </div>
        </div>

        {actions ? (
          <footer className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-base-300/70 px-4 pt-3 pb-4 lg:gap-3 lg:px-5 lg:pt-4 lg:pb-5">
            {actions}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
