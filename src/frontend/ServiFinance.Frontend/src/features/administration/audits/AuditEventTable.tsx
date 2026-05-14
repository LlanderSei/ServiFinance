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
              <td>
                <div className="grid gap-3 lg:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block text-sm text-base-content">{event.subjectLabel || event.subjectType}</strong>
                      <span className="block text-xs text-base-content/65">{formatAuditDate(event.occurredAtUtc)}</span>
                      <span className="block text-xs text-base-content/60">{event.scope} / {event.outcome}</span>
                    </div>
                    <WorkspaceStatusPill tone={getAuditTone(event)}>
                      {event.actionType}
                    </WorkspaceStatusPill>
                  </div>
                  <div className="grid gap-1 text-xs leading-5 text-base-content/65">
                    <span>{event.detail}</span>
                    <span>{event.actorName || "System"} / {event.actorEmail || "No email captured"}</span>
                    <span>{event.subjectType} / {event.ipAddress ?? "No IP address"}</span>
                  </div>
                </div>
                <span className="hidden lg:inline">{formatAuditDate(event.occurredAtUtc)}</span>
              </td>
              <td className="max-lg:hidden">{event.scope}</td>
              <td className="max-lg:hidden">
                <WorkspaceStatusPill tone={getAuditTone(event)}>
                  {event.actionType}
                </WorkspaceStatusPill>
              </td>
              <td className="max-lg:hidden">{event.outcome}</td>
              <td className="max-lg:hidden">
                <div className="grid gap-1">
                  <strong>{event.actorName || "System"}</strong>
                  <span className="text-xs text-base-content/60">{event.actorEmail || "No email captured"}</span>
                </div>
              </td>
              <td className="max-lg:hidden">
                <div className="grid gap-1">
                  <strong>{event.subjectLabel || event.subjectType}</strong>
                  <span className="text-xs text-base-content/60">{event.subjectType}</span>
                </div>
              </td>
              <td className="max-lg:hidden">{event.detail}</td>
              <td className="max-lg:hidden">{event.ipAddress ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </RecordTable>
    </RecordTableShell>
  );
}
