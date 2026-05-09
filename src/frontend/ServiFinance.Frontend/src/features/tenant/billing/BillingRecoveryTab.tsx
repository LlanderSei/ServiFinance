import type { TenantBillingOverviewResponse } from "@/shared/api/contracts";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceActionButton,
  WorkspaceInlineNote,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDetailItem,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getStandingTone,
  ImpactSummary
} from "./billingUi";

type BillingRecoveryTabProps = {
  data?: TenantBillingOverviewResponse;
  isLoading: boolean;
  billingProvider: string;
  isAutorenewalManaged: boolean;
  canOpenBillingPortal: boolean;
  isPortalPending: boolean;
  onOpenPortal: () => void;
};

export function BillingRecoveryTab({
  data,
  isLoading,
  billingProvider,
  isAutorenewalManaged,
  canOpenBillingPortal,
  isPortalPending,
  onOpenPortal
}: BillingRecoveryTabProps) {
  const standing = data?.standing;
  const pendingPlanChange = data?.pendingPlanChange ?? null;
  const lockedModules = pendingPlanChange?.impact.lockedModules ?? [];
  const workloadWarnings = pendingPlanChange?.impact.workloadWarnings ?? [];
  const recoverySeverity = getRecoverySeverity(standing?.accountStanding, standing?.suspensionRisk);

  return (
    <>
      <WorkspacePanelGrid className="xl:[grid-template-columns:minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Recovery posture"
            title="Renewal and access recovery"
            actions={standing ? (
              <WorkspaceStatusPill tone={getStandingTone(standing.accountStanding)}>
                {standing.accountStanding}
              </WorkspaceStatusPill>
            ) : null}
          />

          <WorkspaceMetricGrid className="2xl:!grid-cols-4">
            <MetricCard
              label="Suspension risk"
              value={standing?.suspensionRisk ?? "Loading"}
              description="Billing risk calculated from subscription status, renewal date, and provider events."
            />
            <MetricCard
              label="Provider"
              value={billingProvider}
              description={isAutorenewalManaged ? "Renewal is provider-managed." : "Online renewal provider is not active."}
            />
            <MetricCard
              label="Expected renewal"
              value={formatCurrency(standing?.expectedRenewalAmount)}
              description={`Next checkpoint: ${formatDate(standing?.nextRenewalDateUtc)}`}
            />
            <MetricCard
              label="Pending reviews"
              value={standing?.pendingReviewCount ?? 0}
              description="Subscription billing rows still awaiting provider or platform reconciliation."
            />
          </WorkspaceMetricGrid>

          {recoverySeverity === "blocked" ? (
            <WorkspaceNotice tone="error">
              This tenant is in a high-risk billing state. Restore the provider subscription or update the payment method before guarded workspaces remain blocked.
            </WorkspaceNotice>
          ) : null}

          {recoverySeverity === "warning" ? (
            <WorkspaceNotice>
              Renewal is near, overdue, or payment failed. Review the payment method before the provider retry window closes.
            </WorkspaceNotice>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <WorkspaceDetailItem label="Subscription status" value={data?.plan.subscriptionStatus ?? "Loading..."} />
            <WorkspaceDetailItem label="Latest billing event" value={standing?.latestSubmissionStatus ?? "No events yet"} />
            <WorkspaceDetailItem label="Latest event time" value={formatDateTime(standing?.latestSubmissionAtUtc)} />
            <WorkspaceDetailItem label="Last confirmed coverage" value={formatDate(standing?.lastConfirmedCoverageEndUtc)} />
          </div>
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Payment method"
            title={isAutorenewalManaged ? "Provider recovery path" : "Setup required"}
            actions={(
              <WorkspaceStatusPill tone={canOpenBillingPortal ? "active" : "warning"}>
                {canOpenBillingPortal ? "Portal ready" : "Portal unavailable"}
              </WorkspaceStatusPill>
            )}
          />

          <WorkspaceNoteList
            items={[
              isAutorenewalManaged
                ? `${billingProvider} remains the source of truth for retry attempts, payment method updates, and subscription recovery.`
                : "Manual renewal proof submission is disabled, so this tenant needs a hosted provider setup before the next cycle.",
              "Removing a payment method should be done through the provider portal so Stripe or the configured provider keeps mandate and retry state consistent.",
              "If renewal fails, recover the provider subscription first; the tenant billing ledger should then sync from provider invoice events."
            ]}
          />

          <WorkspaceActionButton
            className="w-full justify-center bg-primary text-primary-content hover:bg-primary/90"
            disabled={!canOpenBillingPortal || isPortalPending}
            onClick={onOpenPortal}
            title={canOpenBillingPortal ? undefined : "Hosted billing portal is not available for this tenant."}
          >
            {isPortalPending ? "Opening portal..." : "Open billing portal"}
          </WorkspaceActionButton>
        </WorkspacePanel>
      </WorkspacePanelGrid>

      {pendingPlanChange?.impact.isDowngrade ? (
        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Downgrade cleanup"
            title={`Before switching to ${pendingPlanChange.targetPlan}`}
            actions={(
              <WorkspaceStatusPill tone="warning">
                Applies {formatDate(pendingPlanChange.effectiveAtUtc)}
              </WorkspaceStatusPill>
            )}
          />
          <ImpactSummary impact={pendingPlanChange.impact} />
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Locked-module queue" title="Work that can be affected by downgrade" />

        {!isLoading && !lockedModules.length && !workloadWarnings.length ? (
          <WorkspaceInlineNote>
            No pending locked-module cleanup is currently detected for the active or scheduled plan.
          </WorkspaceInlineNote>
        ) : null}

        <WorkspaceSubtableShell>
          <WorkspaceSubtable>
            <thead>
              <tr>
                <th>Module</th>
                <th>Channel</th>
                <th>Access change</th>
                <th>Active work</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RecordTableStateRow colSpan={5}>Loading recovery queue...</RecordTableStateRow>
              ) : null}

              {!isLoading && !lockedModules.length && !workloadWarnings.length ? (
                <RecordTableStateRow colSpan={5}>No locked-module cleanup is pending.</RecordTableStateRow>
              ) : null}

              {lockedModules.map((module) => {
                const warning = workloadWarnings.find((entry) => entry.moduleCode === module.moduleCode);
                return (
                  <tr key={module.moduleCode}>
                    <td>{module.moduleName}</td>
                    <td>{module.channel}</td>
                    <td>{formatAccessChange(module.currentAccessLevel, module.targetAccessLevel)}</td>
                    <td>{warning?.activeWorkCount ?? 0}</td>
                    <td>{warning?.detail ?? "No active workload blocker detected."}</td>
                  </tr>
                );
              })}

              {workloadWarnings
                .filter((warning) => !lockedModules.some((module) => module.moduleCode === warning.moduleCode))
                .map((warning) => (
                  <tr key={`${warning.moduleCode}-${warning.detail}`}>
                    <td>{warning.moduleName}</td>
                    <td>-</td>
                    <td>Review required</td>
                    <td>{warning.activeWorkCount}</td>
                    <td>{warning.detail}</td>
                  </tr>
                ))}
            </tbody>
          </WorkspaceSubtable>
        </WorkspaceSubtableShell>
      </WorkspacePanel>
    </>
  );
}

function getRecoverySeverity(accountStanding?: string | null, suspensionRisk?: string | null) {
  if (accountStanding === "Suspended" || suspensionRisk === "High") {
    return "blocked";
  }

  if (
    accountStanding === "Renewal overdue" ||
    accountStanding === "Renewal due soon" ||
    accountStanding === "Payment failed" ||
    suspensionRisk === "Medium"
  ) {
    return "warning";
  }

  return "normal";
}

function formatAccessChange(currentAccess?: string | null, targetAccess?: string | null) {
  return `${currentAccess ?? "Locked"} to ${targetAccess ?? "Locked"}`;
}
