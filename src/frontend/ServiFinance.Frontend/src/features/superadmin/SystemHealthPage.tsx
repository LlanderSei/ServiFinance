import { useSuperadminSystemHealth } from "@/shared/api/useSuperadminSystemHealth";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceAlertItem,
  WorkspaceAlertList,
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack
} from "@/shared/records/WorkspacePanel";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export function SystemHealthPage() {
  const healthQuery = useSuperadminSystemHealth();
  const health = healthQuery.data;

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <RecordWorkspace
        breadcrumbs="SaaS / System Health"
        title="System health"
        description="Watch API readiness, database state, hybrid bridge coverage, and deployment metadata from the root-domain monitoring console."
      >
        <WorkspaceScrollStack>
          <WorkspaceMetricGrid>
            <MetricCard
              label="API status"
              value={health?.api.status ?? "--"}
              description={health?.api.environment ?? "Loading environment..."}
            />
            <MetricCard
              label="Database"
              value={health?.database.status ?? "--"}
              description={health?.database.canConnect ? "Connection verified." : "Waiting on connectivity check."}
            />
            <MetricCard
              label="Pending migrations"
              value={health?.database.pendingMigrationCount ?? "--"}
              description="Migration drift between code and SQL Server."
            />
            <MetricCard
              label="Queue workers"
              value={health?.queues.status ?? "--"}
              description={health?.queues.summary ?? "Loading background worker state..."}
            />
            <MetricCard
              label="Hybrid bridge"
              value={health?.hybrid.status ?? "--"}
              description={health?.hybrid.summary ?? "Loading hybrid shell state..."}
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Runtime" title="Host diagnostics" />

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="Version" value={health?.api.version ?? "--"} />
                <WorkspaceDetailItem label="Environment" value={health?.api.environment ?? "--"} />
                <WorkspaceDetailItem
                  label="Started"
                  value={health?.api.startedAtUtc ? dateFormatter.format(new Date(health.api.startedAtUtc)) : "--"}
                />
                <WorkspaceDetailItem
                  label="Uptime"
                  value={typeof health?.api.uptimeMinutes === "number" ? `${health.api.uptimeMinutes} min` : "--"}
                />
                <WorkspaceDetailItem
                  label="Last build"
                  value={health?.api.buildTimestampUtc ? dateFormatter.format(new Date(health.api.buildTimestampUtc)) : "--"}
                />
                <WorkspaceDetailItem label="Latest migration" value={health?.database.latestAppliedMigration ?? "--"} />
              </WorkspaceDetailGrid>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Catalog state" title="Tiers and modules" />

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="Active tiers" value={health?.catalog.activeTierCount ?? "--"} />
                <WorkspaceDetailItem label="Inactive tiers" value={health?.catalog.inactiveTierCount ?? "--"} />
                <WorkspaceDetailItem label="Active modules" value={health?.catalog.activeModuleCount ?? "--"} />
                <WorkspaceDetailItem label="Inactive modules" value={health?.catalog.inactiveModuleCount ?? "--"} />
                <WorkspaceDetailItem label="Applied migrations" value={health?.database.appliedMigrationCount ?? "--"} />
                <WorkspaceDetailItem label="Can connect" value={health?.database.canConnect ? "Yes" : "No"} />
              </WorkspaceDetailGrid>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid singleColumn>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Warnings" title="Health alerts" />

              {healthQuery.isLoading ? <WorkspaceEmptyState>Loading health warnings...</WorkspaceEmptyState> : null}
              {healthQuery.isError ? <WorkspaceEmptyState>Unable to load health diagnostics.</WorkspaceEmptyState> : null}

              {!healthQuery.isLoading && !healthQuery.isError && !health?.warnings.length ? (
                <WorkspaceEmptyState>No health alerts right now.</WorkspaceEmptyState>
              ) : null}

              {health?.warnings.length ? (
                <WorkspaceAlertList>
                  {health.warnings.map((warning) => (
                    <WorkspaceAlertItem
                      key={warning.code}
                      title={warning.title}
                      message={warning.message}
                      badge={warning.severity}
                      tone={
                        warning.severity === "Critical"
                          ? "critical"
                          : warning.severity === "Warning"
                            ? "warning"
                            : "info"
                      }
                    />
                  ))}
                </WorkspaceAlertList>
              ) : null}
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
