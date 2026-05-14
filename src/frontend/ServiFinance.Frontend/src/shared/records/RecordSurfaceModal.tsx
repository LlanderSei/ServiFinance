import { useEffect, useState, type ReactNode } from "react";

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
  mobileOptions?: ReactNode;
  mobileOptionsLabel?: string;
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
  mobileOptions,
  mobileOptionsLabel = "Options",
  onClose,
  onTabChange
}: RecordSurfaceModalProps) {
  const [stackZIndex, setStackZIndex] = useState(90);
  const [isMobileOptionsOpen, setIsMobileOptionsOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsMobileOptionsOpen(false);
    const nextModalStack = ((window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack ?? 80) + 2;
    (window as Window & { __sfRecordModalStack?: number }).__sfRecordModalStack = nextModalStack;
    setStackZIndex(nextModalStack);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/58 p-2 lg:p-5" style={{ zIndex: stackZIndex }} onClick={onClose}>
      <div
        className={joinClasses(
          "relative flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 shadow-2xl lg:h-[min(86vh,50rem)] lg:rounded-[1.6rem]",
          maxWidthClassName
        )}
        style={{ zIndex: stackZIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300/70 px-4 pt-4 pb-3 pr-14 lg:px-5 lg:pt-5 lg:pb-4">
          <div className="min-w-0">
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{eyebrow}</p>
            <h2 className="mt-1.5 mb-0 truncate text-[1.55rem] tracking-[-0.04em] text-base-content md:text-[1.85rem]">{title}</h2>
            {description ? <p className="mt-2 mb-0 max-w-[40rem] text-[0.95rem] leading-6 text-base-content/70">{description}</p> : null}
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost absolute right-3 top-3 z-10" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </header>

        {tabs?.length ? (
          <div className="overflow-x-auto border-b border-base-300/65 px-4 lg:px-5">
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

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-5">
          {children}
        </div>

        {actions ? (
          <footer className="relative border-t border-base-300/70 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] lg:px-5 lg:pt-4 lg:pb-5">
            {mobileOptions ? (
              <div className="flex justify-end gap-2 lg:hidden">
                <button
                  type="button"
                  className="btn rounded-full border border-base-300/70 bg-base-100 text-base-content shadow-none"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-full shadow-none"
                  aria-expanded={isMobileOptionsOpen}
                  onClick={() => setIsMobileOptionsOpen((current) => !current)}
                >
                  {mobileOptionsLabel}
                </button>

                {isMobileOptionsOpen ? (
                  <div className="absolute inset-x-4 bottom-[calc(100%+0.5rem)] z-20 grid max-h-[min(22rem,58dvh)] gap-2 overflow-y-auto rounded-[1.1rem] border border-base-300/70 bg-base-100 p-3 shadow-2xl">
                    {mobileOptions}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={joinClasses("flex flex-wrap justify-end gap-2 lg:gap-3", Boolean(mobileOptions) && "hidden lg:flex")}>
              {actions}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
