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
    <main className="page authed-page record-page">
      <section className="record-workspace">
        <header className="record-workspace__header">
          <div className="record-workspace__header-main">
            <p className="record-workspace__breadcrumbs">{breadcrumbs}</p>

            <div className="record-workspace__title-row">
              <h1 className="record-workspace__title">{title}</h1>

              {hasCountBadge ? (
                <span className="record-workspace__count">
                  {formatRecordCount(recordCount, singularLabel, pluralLabel)}
                </span>
              ) : null}
            </div>

            <p className="record-workspace__description">{description}</p>
          </div>
        </header>

        <section className="record-workspace__body">
          <div className="record-workspace__surface">
            {children}
          </div>
        </section>
      </section>
    </main>
  );
}
