import type { ReactNode } from "react";

type RecordSurfaceModalTab = {
  key: string;
  label: string;
};

type RecordSurfaceModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  tabs?: RecordSurfaceModalTab[];
  activeTabKey?: string;
  maxWidthClassName?: string;
  onClose: () => void;
  onTabChange?: (tabKey: string) => void;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RecordSurfaceModal({
  open,
  title,
  eyebrow,
  description,
  children,
  actions,
  tabs,
  activeTabKey,
  maxWidthClassName = "max-w-[min(82rem,calc(100vw-3rem))]",
  onClose,
  onTabChange
}: RecordSurfaceModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/58 p-3 md:p-5" onClick={onClose}>
      <div
        className={joinClasses(
          "relative z-[91] flex h-[min(88vh,52rem)] w-full flex-col overflow-hidden rounded-[1.6rem] border border-base-300/70 bg-base-100 shadow-2xl md:h-[min(86vh,50rem)]",
          maxWidthClassName
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300/70 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{eyebrow}</p>
            <h2 className="mt-1.5 mb-0 truncate text-[1.55rem] tracking-[-0.04em] text-base-content md:text-[1.85rem]">{title}</h2>
            {description ? <p className="mt-2 mb-0 max-w-[40rem] text-[0.95rem] leading-6 text-base-content/70">{description}</p> : null}
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </header>

        {tabs?.length ? (
          <div className="overflow-x-auto border-b border-base-300/65 px-5">
            <div className="flex min-w-max items-end gap-1">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTabKey;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={joinClasses(
                      "relative rounded-t-2xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-base-200/72 text-base-content before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:rounded-full before:bg-primary"
                        : "text-base-content/62 hover:bg-base-200/45 hover:text-base-content"
                    )}
                    onClick={() => onTabChange?.(tab.key)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          {children}
        </div>

        {actions ? (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-base-300/70 px-5 pt-4 pb-5">
            {actions}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
