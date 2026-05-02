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

type SystemAuditsProps = {
  endpoint: string;
  scopeLabel: string;
};

export function SystemAudits({ endpoint, scopeLabel }: SystemAuditsProps) {
  const [filters, setFilters] = useState(emptyAuditQueryState);
  const isWindowInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const requestPath = appendAuditQueryString(endpoint, filters);
  const auditsQuery = useQuery({
    queryKey: ["audits", endpoint, "system", filters],
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
          {getApiErrorMessage(auditsQuery.error, "Unable to load system audit events right now.")}
        </WorkspaceNotice>
      ) : null}

      <WorkspaceMetricGrid className="2xl:grid-cols-4">
        <MetricCard label="System events" value={String(auditsQuery.data?.summary.systemEvents ?? 0)} description={`CRUD and operational changes visible in ${scopeLabel}.`} />
        <MetricCard label="Total retained" value={String(auditsQuery.data?.summary.totalEvents ?? 0)} description="Events returned by the current audit filter." />
        <MetricCard label="Failed outcomes" value={String(auditsQuery.data?.summary.failedEvents ?? 0)} description="Operational events marked failed or denied." />
        <MetricCard label="Scope" value={scopeLabel} description="Audit stream currently being reviewed." />
      </WorkspaceMetricGrid>

      <AuditFiltersPanel filters={filters} onChange={setFilters} />

      <AuditEventTable
        events={auditsQuery.data?.events ?? []}
        isLoading={auditsQuery.isLoading}
        isError={auditsQuery.isError}
        emptyMessage="No system audit events match the current filters."
      />
    </WorkspaceScrollStack>
  );
}
