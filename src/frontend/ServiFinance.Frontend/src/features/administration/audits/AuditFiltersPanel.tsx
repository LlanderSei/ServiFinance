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
  return (
    <WorkspacePanel className="shrink-0">
      <WorkspacePanelHeader
        eyebrow="Filters"
        title="Audit review filters"
        actions={(
          <WorkspaceActionButton onClick={() => onChange(emptyAuditQueryState)}>
            Clear filters
          </WorkspaceActionButton>
        )}
      />

      <WorkspaceToolbar className="flex-nowrap overflow-x-auto pb-1">
        <div className="w-56 shrink-0">
          <WorkspaceField label="Action type">
            <WorkspaceInput
              value={filters.actionType}
              onChange={(event) => onChange({ ...filters, actionType: event.target.value })}
              placeholder="LoginSuccess, ServiceStatusChanged, LoanPayment"
            />
          </WorkspaceField>
        </div>

        <div className="w-80 shrink-0">
          <WorkspaceField label="Search">
            <WorkspaceInput
              value={filters.searchTerm}
              onChange={(event) => onChange({ ...filters, searchTerm: event.target.value })}
              placeholder="Actor, email, subject, detail"
            />
          </WorkspaceField>
        </div>

        <div className="w-40 shrink-0">
          <WorkspaceField label="Date from">
            <WorkspaceInput
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
            />
          </WorkspaceField>
        </div>

        <div className="w-40 shrink-0">
          <WorkspaceField label="Date to">
            <WorkspaceInput
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
            />
          </WorkspaceField>
        </div>
      </WorkspaceToolbar>
    </WorkspacePanel>
  );
}
