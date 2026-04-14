import type { ReactNode } from "react";
import { formatRecordCount } from "./recordCount";

type RecordWorkspaceProps = {
  breadcrumbs: string;
  title: string;
  description: string;
  recordCount?: number;
  singularLabel?: string;
  pluralLabel?: string;
  children: ReactNode;
};

export function RecordWorkspace({
  breadcrumbs,
  title,
  description,
  recordCount,
  singularLabel,
  pluralLabel,
  children
}: RecordWorkspaceProps) {
  const hasCountBadge = typeof recordCount === "number" && singularLabel;

  return (
    <main className="mx-auto min-h-dvh max-w-none overflow-visible bg-base-100 text-base-content md:h-dvh md:overflow-hidden">
      <section className="grid h-auto min-h-dvh grid-rows-[auto_1fr] gap-0 bg-transparent md:h-full md:min-h-0">
        <header className="grid gap-2 border-b border-base-300/70 bg-base-100/80 px-6 pt-5 pb-3">
          <div className="grid gap-0.5">
            <p className="m-0 text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">{breadcrumbs}</p>

            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
              <h1 className="m-0 text-[clamp(1.7rem,2.6vw,2.3rem)] font-bold tracking-[-0.04em] text-base-content">{title}</h1>

              {hasCountBadge ? (
                <span className="badge badge-soft badge-info px-3 py-3 text-[0.82rem] font-extrabold whitespace-nowrap">
                  {formatRecordCount(recordCount, singularLabel, pluralLabel)}
                </span>
              ) : null}
            </div>

            <p className="m-0 text-[0.94rem] text-base-content/70">{description}</p>
          </div>
        </header>

        <section className="min-h-0 overflow-hidden p-0">
          <div className="flex h-full min-h-0 flex-col border border-base-300/70 bg-base-100 p-4 shadow-sm">
            {children}
          </div>
        </section>
      </section>
    </main>
  );
}
