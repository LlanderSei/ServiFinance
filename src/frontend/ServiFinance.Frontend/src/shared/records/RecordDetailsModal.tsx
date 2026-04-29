import { useEffect, useState, type ReactNode } from "react";

type RecordDetailItem = {
  label: string;
  value: ReactNode;
};

type RecordDetailSection = {
  title: string;
  items: RecordDetailItem[];
};

type RecordDetailsModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  sections: RecordDetailSection[];
  actions?: ReactNode;
  onClose: () => void;
};

export function RecordDetailsModal({
  open,
  title,
  eyebrow,
  sections,
  actions,
  onClose
}: RecordDetailsModalProps) {
  const [stackZIndex, setStackZIndex] = useState(80);

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
    <div className="fixed inset-0 grid place-items-center bg-black/60 p-4" style={{ zIndex: stackZIndex }} onClick={onClose}>
      <div
        className="relative flex max-h-[min(90vh,48rem)] w-full max-w-[44rem] flex-col overflow-hidden rounded-[1.6rem] border border-base-300/70 bg-base-100 text-base-content shadow-2xl"
        style={{ zIndex: stackZIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-base-300/70 px-5 pt-5 pb-4">
          <div>
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{eyebrow}</p>
            <h2 className="mt-1.5 mb-0 text-[1.8rem] tracking-[-0.04em] text-base-content">{title}</h2>
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost" onClick={onClose} aria-label="Close details">
            x
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
          {sections.map((section) => (
            <section key={section.title} className="grid gap-3">
              <h3 className="m-0 text-[0.9rem] font-extrabold uppercase tracking-[0.1em] text-base-content/60">{section.title}</h3>

              <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.label}`} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <dt className="text-[0.76rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{item.label}</dt>
                    <dd className="m-0 leading-6 text-base-content">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          </div>
        </div>

        {actions ? (
          <footer className="shrink-0 flex flex-wrap justify-end gap-3 border-t border-base-300/70 px-5 pt-4 pb-5">
            {actions}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
