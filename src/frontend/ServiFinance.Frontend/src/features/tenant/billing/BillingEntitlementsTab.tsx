import type { TenantBillingOverviewResponse } from "@/shared/api/contracts";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceEmptyState,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { ImpactSummary } from "./billingUi";

type BillingEntitlementsTabProps = {
  data?: TenantBillingOverviewResponse;
  isLoading: boolean;
  pendingPlanChange: TenantBillingOverviewResponse["pendingPlanChange"];
};

export function BillingEntitlementsTab({
  data,
  isLoading,
  pendingPlanChange
}: BillingEntitlementsTabProps) {
  return (
    <>
      {pendingPlanChange?.impact.isDowngrade ? (
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Pending downgrade" title="Locked-module impact after renewal" />
          <ImpactSummary impact={pendingPlanChange.impact} />
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Unlocked modules" title="What the current plan covers" />

        {!isLoading && !data?.plan.modules.length ? (
          <WorkspaceEmptyState>No module alignment is available for this tier yet.</WorkspaceEmptyState>
        ) : null}

        <WorkspaceSubtableShell>
          <WorkspaceSubtable>
            <thead>
              <tr>
                <th>Module</th>
                <th>Channel</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RecordTableStateRow colSpan={3}>Loading module coverage...</RecordTableStateRow>
              ) : null}

              {data?.plan.modules.map((row) => (
                <tr key={row.moduleCode}>
                  <td>{row.moduleName}</td>
                  <td>{row.channel}</td>
                  <td>{row.accessLevel}</td>
                </tr>
              ))}
            </tbody>
          </WorkspaceSubtable>
        </WorkspaceSubtableShell>
      </WorkspacePanel>
    </>
  );
}
