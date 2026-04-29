import type { ReactNode } from "react";
import { formatRecordCount } from "./recordCount";

type RecordWorkspaceProps = {
  breadcrumbs: string;
  title: string;
  description: string;
  recordCount?: number;
  singularLabel?: string;
  pluralLabel?: string;
  headerRight?: ReactNode;
  headerBottom?: ReactNode;
  children: ReactNode;
};

type RecordContentStackProps = {
  children: ReactNode;
  className?: string;
};

type RecordScrollRegionProps = {
  children: ReactNode;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RecordWorkspace({
  breadcrumbs,
  title,
  description,
  recordCount,
  singularLabel,
  pluralLabel,
  headerRight,
  headerBottom,
  children
}: RecordWorkspaceProps) {
  const hasCountBadge = typeof recordCount === "number" && singularLabel;

  return (
    <main className="authed-workspace mx-auto h-full min-h-0 max-w-none overflow-hidden bg-base-100 text-base-content">
      <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-0 bg-transparent">
        <header className="flex flex-col border-b border-base-300/70 bg-base-100 px-6 pt-5">
          {/* Upper row: breadcrumbs + title row + count badge + description */}
          <div className="grid gap-0.5">
            <p className="m-0 text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{breadcrumbs}</p>

            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
              <h1 className="m-0 text-[clamp(1.7rem,2.6vw,2.3rem)] font-bold tracking-[-0.04em] text-base-content">{title}</h1>

              {hasCountBadge ? (
                <span className="inline-flex items-center rounded-full border border-info/26 bg-info/12 px-3 py-1.5 text-[0.82rem] font-extrabold whitespace-nowrap text-info">
                  {formatRecordCount(recordCount, singularLabel, pluralLabel)}
                </span>
              ) : null}
            </div>

            <p className="m-0 text-[0.94rem] text-base-content/70 pb-2">{description}</p>
          </div>

          {/* Lower row: tabs + extra controls */}
          {headerBottom && (            
            headerBottom
          )}

          {/* Optional right-aligned content (upper row right side) */}
          {headerRight && (
            <div className="shrink-0">
              {headerRight}
            </div>
          )}
        </header>

        <section className="min-h-0 overflow-hidden p-0">
          <div className="authed-workspace__surface flex h-full min-h-0 flex-col border border-base-300/65 bg-base-100 p-4 shadow-sm">
            {children}
          </div>
        </section>
      </section>
    </main>
  );
}

export function RecordContentStack({ children, className }: RecordContentStackProps) {
  return (
    <div className={joinClasses("relative flex min-h-0 flex-1 flex-col gap-4", className)}>
      {children}
    </div>
  );
}

export function RecordScrollRegion({ children, className }: RecordScrollRegionProps) {
  return (
    <div
      className={joinClasses(
        "min-h-0 flex-1 overflow-auto overscroll-contain pb-[5.5rem] [scroll-padding-bottom:5.5rem] [contain:layout_paint]",
        className
      )}
    >
      {children}
    </div>
  );
}
