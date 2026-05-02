import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditWorkspaceResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceNotice } from "@/shared/records/WorkspaceControls";
import { WorkspaceMetricGrid, WorkspaceScrollStack } from "@/shared/records/WorkspacePanel";
import { AuditEventTable } from "./AuditEventTable";
import { AuditFiltersPanel } from "./AuditFiltersPanel";
import { appendAuditQueryString, emptyAuditQueryState } from "./auditHelpers";

type SecurityAuditsProps = {
  endpoint: string;
  scopeLabel: string;
};

export function SecurityAudits({ endpoint, scopeLabel }: SecurityAuditsProps) {
  const [filters, setFilters] = useState(emptyAuditQueryState);
  const isWindowInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const requestPath = appendAuditQueryString(endpoint, filters);
  const auditsQuery = useQuery({
    queryKey: ["audits", endpoint, "security", filters],
    queryFn: () => httpGet<AuditWorkspaceResponse>(requestPath),
    enabled: !isWindowInvalid
  });

  return (
    <WorkspaceScrollStack>
      {isWindowInvalid ? (
        <WorkspaceNotice tone="error">Audit end date must be on or after the start date.</WorkspaceNotice>
      ) : null}
      {auditsQuery.isError ? (
        <WorkspaceNotice tone="error">
          {getApiErrorMessage(auditsQuery.error, "Unable to load security audit events right now.")}
        </WorkspaceNotice>
      ) : null}

      <WorkspaceMetricGrid className="2xl:grid-cols-4">
        <MetricCard label="Security events" value={String(auditsQuery.data?.summary.securityEvents ?? 0)} description={`Login, logout, denial, and failed access events for ${scopeLabel}.`} />
        <MetricCard label="Failed attempts" value={String(auditsQuery.data?.summary.failedEvents ?? 0)} description="Failed or denied authentication events in the current filter." />
        <MetricCard label="Total retained" value={String(auditsQuery.data?.summary.totalEvents ?? 0)} description="Events returned by the current audit filter." />
        <MetricCard label="Scope" value={scopeLabel} description="Security stream currently being reviewed." />
      </WorkspaceMetricGrid>

      <AuditFiltersPanel filters={filters} onChange={setFilters} />

      <AuditEventTable
        events={auditsQuery.data?.events ?? []}
        isLoading={auditsQuery.isLoading}
        isError={auditsQuery.isError}
        emptyMessage="No security audit events match the current filters."
      />
    </WorkspaceScrollStack>
  );
}
