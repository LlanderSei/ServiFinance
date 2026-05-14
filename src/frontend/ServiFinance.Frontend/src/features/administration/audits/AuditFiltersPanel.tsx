import { useState } from "react";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceInput
} from "@/shared/records/WorkspaceControls";
import { WorkspacePanel, WorkspacePanelHeader, WorkspaceToolbar } from "@/shared/records/WorkspacePanel";
import type { AuditQueryState } from "./auditHelpers";
import { emptyAuditQueryState } from "./auditHelpers";

type AuditFiltersPanelProps = {
  filters: AuditQueryState;
  onChange: (filters: AuditQueryState) => void;
};

export function AuditFiltersPanel({ filters, onChange }: AuditFiltersPanelProps) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  return (
    <>
      <WorkspacePanel className="shrink-0">
        <WorkspacePanelHeader
          eyebrow="Filters"
          title="Audit review filters"
          actions={(
            <>
              <WorkspaceActionButton className="lg:hidden" onClick={() => setIsMobileFiltersOpen(true)}>
                Options
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => onChange(emptyAuditQueryState)}>
                Clear filters
              </WorkspaceActionButton>
            </>
          )}
        />

        <WorkspaceToolbar className="hidden flex-nowrap overflow-x-auto pb-1 lg:flex">
          <AuditFilterFields filters={filters} onChange={onChange} layout="desktop" />
        </WorkspaceToolbar>
      </WorkspacePanel>

      {isMobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Audit filter options"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <section
            className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-base-300/70 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Filters</p>
                <h2 className="mt-1 text-lg font-bold text-base-content">Audit options</h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-sm border-base-300/70 bg-base-100 shadow-none"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close audit filters"
              >
                x
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <AuditFilterFields filters={filters} onChange={onChange} layout="mobile" />
            </div>
            <footer className="flex justify-end gap-2 border-t border-base-300/70 bg-base-200/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <WorkspaceActionButton onClick={() => onChange(emptyAuditQueryState)}>
                Clear filters
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => setIsMobileFiltersOpen(false)}>
                Apply
              </WorkspaceActionButton>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AuditFilterFields({
  filters,
  onChange,
  layout
}: AuditFiltersPanelProps & { layout: "desktop" | "mobile" }) {
  const fieldClassName = layout === "desktop" ? "w-56 shrink-0" : "grid gap-3";
  const searchClassName = layout === "desktop" ? "w-80 shrink-0" : "grid gap-3";
  const dateClassName = layout === "desktop" ? "w-40 shrink-0" : "grid gap-3";

  return (
    <div className={layout === "desktop" ? "contents" : "grid gap-4"}>
      <div className={fieldClassName}>
        <WorkspaceField label="Action type">
          <WorkspaceInput
            value={filters.actionType}
            onChange={(event) => onChange({ ...filters, actionType: event.target.value })}
            placeholder="LoginSuccess, ServiceStatusChanged, LoanPayment"
          />
        </WorkspaceField>
      </div>

      <div className={searchClassName}>
        <WorkspaceField label="Search">
          <WorkspaceInput
            value={filters.searchTerm}
            onChange={(event) => onChange({ ...filters, searchTerm: event.target.value })}
            placeholder="Actor, email, subject, detail"
          />
        </WorkspaceField>
      </div>

      <div className={dateClassName}>
        <WorkspaceField label="Date from">
          <WorkspaceInput
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          />
        </WorkspaceField>
      </div>

      <div className={dateClassName}>
        <WorkspaceField label="Date to">
          <WorkspaceInput
            type="date"
            value={filters.dateTo}
            onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          />
        </WorkspaceField>
      </div>
    </div>
  );
}
