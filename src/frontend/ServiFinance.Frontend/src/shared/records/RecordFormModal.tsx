import type { ReactNode } from "react";

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative z-[81] max-h-[min(90vh,48rem)] w-full max-w-[44rem] overflow-auto rounded-[1.6rem] border border-base-300/70 bg-base-100 text-base-content shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-base-300/70 px-5 pt-5 pb-4">
          <div>
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{eyebrow}</p>
            <h2 className="mt-1.5 mb-0 text-[1.8rem] tracking-[-0.04em] text-base-content">{title}</h2>
            {description ? <p className="mt-2 mb-0 max-w-[34rem] text-[0.95rem] leading-6 text-base-content/70">{description}</p> : null}
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost" onClick={onClose} aria-label="Close form">
            x
          </button>
        </header>

        <div className="grid gap-4 px-5 py-5">
          {children}
        </div>

        {actions ? (
          <footer className="flex flex-col justify-end gap-3 border-t border-base-300/70 px-5 pt-4 pb-5 md:flex-row">
            {actions}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
