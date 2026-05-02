import type { AuditEventRow } from "@/shared/api/contracts";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import { formatAuditDate, getAuditTone } from "./auditHelpers";

type AuditEventTableProps = {
  events: AuditEventRow[];
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
};

export function AuditEventTable({ events, isLoading, isError, emptyMessage }: AuditEventTableProps) {
  return (
    <RecordTableShell>
      <RecordTable>
        <thead>
          <tr>
            <th>Date</th>
            <th>Scope</th>
            <th>Action</th>
            <th>Outcome</th>
            <th>Actor</th>
            <th>Subject</th>
            <th>Detail</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <RecordTableStateRow colSpan={8}>Loading audit events...</RecordTableStateRow>
          ) : null}
          {isError ? (
            <RecordTableStateRow colSpan={8} tone="error">
              Unable to load audit events.
            </RecordTableStateRow>
          ) : null}
          {!isLoading && !isError && events.length === 0 ? (
            <RecordTableStateRow colSpan={8}>{emptyMessage}</RecordTableStateRow>
          ) : null}
          {events.map((event) => (
            <tr key={`${event.scope}:${event.category}:${event.actionType}:${event.eventId}`}>
              <td>{formatAuditDate(event.occurredAtUtc)}</td>
              <td>{event.scope}</td>
              <td>
                <WorkspaceStatusPill tone={getAuditTone(event)}>
                  {event.actionType}
                </WorkspaceStatusPill>
              </td>
              <td>{event.outcome}</td>
              <td>
                <div className="grid gap-1">
                  <strong>{event.actorName || "System"}</strong>
                  <span className="text-xs text-base-content/60">{event.actorEmail || "No email captured"}</span>
                </div>
              </td>
              <td>
                <div className="grid gap-1">
                  <strong>{event.subjectLabel || event.subjectType}</strong>
                  <span className="text-xs text-base-content/60">{event.subjectType}</span>
                </div>
              </td>
              <td>{event.detail}</td>
              <td>{event.ipAddress ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
