import { useEffect, useState } from "react";
import type {
  TenantBillingDowngradeImpact,
  TenantBillingOverviewResponse
} from "@/shared/api/contracts";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceActionButton,
  WorkspaceInlineNote,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDetailItem,
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
  ImpactSummary,
  isCurrentTier
} from "./billingUi";

type BillingTierOption = TenantBillingOverviewResponse["availableTiers"][number];

type BillingPlanSwitchTabProps = {
  data?: TenantBillingOverviewResponse;
  isLoading: boolean;
  canManageBilling: boolean;
  pendingPlanChange: TenantBillingOverviewResponse["pendingPlanChange"];
  selectedTierId: string;
  selectedTier: BillingTierOption | null;
  selectedImpact: TenantBillingDowngradeImpact | null;
  selectableTiers: BillingTierOption[];
  availableTiers: BillingTierOption[];
  isPlanChangePending: boolean;
  isCancelPlanChangePending: boolean;
  onSelectedTierChange: (value: string) => void;
  onRequestPlanSwitch: () => void;
  onCancelPlanChange: () => void;
};

export function BillingPlanSwitchTab({
  data,
  isLoading,
  canManageBilling,
  pendingPlanChange,
  selectedTierId,
  selectedTier,
  selectedImpact,
  selectableTiers,
  availableTiers,
  isPlanChangePending,
  isCancelPlanChangePending,
  onSelectedTierChange,
  onRequestPlanSwitch,
  onCancelPlanChange
}: BillingPlanSwitchTabProps) {
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const cooldownUntilUtc = data?.changeControls.cooldownUntilUtc;
  const remainingCooldown = formatCooldownRemaining(cooldownUntilUtc, cooldownTick);

  useEffect(() => {
    if (!cooldownUntilUtc) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldownTick(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [cooldownUntilUtc]);

  return (
    <>
      <WorkspacePanelGrid className="xl:[grid-template-columns:minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Tier and edition"
            title="Schedule a switch for the next renewal"
            actions={
              pendingPlanChange ? (
                <WorkspaceStatusPill tone={pendingPlanChange.changeDirection === "Downgrade" ? "warning" : "progress"}>
                  {pendingPlanChange.changeDirection} pending
                </WorkspaceStatusPill>
              ) : null
            }
          />

          {pendingPlanChange ? (
            <div className="grid gap-4 rounded-box border border-info/25 bg-info/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-base-content">Pending switch to {pendingPlanChange.targetPlan}</p>
                  <p className="mt-1 text-sm text-base-content/68">
                    Applies after the renewal checkpoint on {formatDate(pendingPlanChange.effectiveAtUtc)}. Current access remains active until then.
                  </p>
                </div>
                <WorkspaceActionButton
                  className="justify-center border-error/25 bg-error/10 text-error hover:bg-error/15"
                  disabled={!canManageBilling || isCancelPlanChangePending}
                  onClick={onCancelPlanChange}
                >
                  {isCancelPlanChangePending ? "Cancelling..." : "Cancel pending switch"}
                </WorkspaceActionButton>
              </div>

              {pendingPlanChange.impact.isDowngrade ? (
                <ImpactSummary impact={pendingPlanChange.impact} />
              ) : (
                <WorkspaceInlineNote>
                  No locked-module cleanup is required by the currently pending switch.
                </WorkspaceInlineNote>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-[0.8rem] font-bold uppercase tracking-[0.04em] text-base-content/60">Target tier and edition</span>
                <select
                  className="select select-bordered w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                  value={selectedTierId}
                  disabled={!canManageBilling || !data?.changeControls.canRequestChange}
                  onChange={(event) => onSelectedTierChange(event.target.value)}
                >
                  <option value="">Select a tier to schedule</option>
                  {selectableTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.displayName} - {tier.priceDisplay}
                    </option>
                  ))}
                </select>
              </label>

              {data && !data.changeControls.canRequestChange ? (
                <WorkspaceNotice tone="error">
                  <span className="grid gap-1">
                    <span>{data.changeControls.blockedReason}</span>
                    {remainingCooldown ? (
                      <span className="text-xs font-semibold text-error/80">
                        Current remaining cooldown: {remainingCooldown}
                      </span>
                    ) : null}
                  </span>
                </WorkspaceNotice>
              ) : null}

              {selectedTier && selectedImpact ? (
                <div className="grid gap-4 rounded-box border border-base-300/70 bg-base-200/45 p-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <WorkspaceDetailItem label="Target" value={selectedTier.displayName} />
                    <WorkspaceDetailItem label="Edition" value={selectedTier.subscriptionEdition} />
                    <WorkspaceDetailItem label="Monthly rate" value={formatCurrency(selectedTier.monthlyPriceAmount)} />
                  </div>
                  <ImpactSummary impact={selectedImpact} />
                  <WorkspaceActionButton
                    className="w-full justify-center bg-primary text-primary-content hover:bg-primary/90 md:w-fit"
                    disabled={isPlanChangePending || !canManageBilling}
                    onClick={onRequestPlanSwitch}
                  >
                    {isPlanChangePending ? "Scheduling..." : `Schedule ${selectedTier.displayName}`}
                  </WorkspaceActionButton>
                </div>
              ) : (
                <WorkspaceInlineNote>
                  Switches do not apply immediately. The current plan remains active until the next successful renewal event.
                </WorkspaceInlineNote>
              )}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Renewal failure policy" title="If renewal fails" />
          <WorkspaceNoteList
            items={[
              "Stripe marks the subscription as past due after a failed renewal; the tenant sees high-risk billing warnings while provider retries can still recover the subscription.",
              "If Stripe moves the subscription to unpaid, cancelled, paused, or expired, the tenant status becomes suspended and guarded SMS/MLS administration is blocked until billing is restored.",
              "If a downgrade locks modules with open work, the locked-module impact list should be cleared before renewal because those workspaces can become hidden or read-limited after the switch applies."
            ]}
          />
        </WorkspacePanel>
      </WorkspacePanelGrid>

      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Catalog options" title="Available tiers and editions" />
        <WorkspaceSubtableShell>
          <WorkspaceSubtable>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Edition</th>
                <th>Segment</th>
                <th>Rate</th>
                <th>Coverage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RecordTableStateRow colSpan={6}>Loading available subscription options...</RecordTableStateRow>
              ) : null}

              {!isLoading && !availableTiers.length ? (
                <RecordTableStateRow colSpan={6}>No active subscription tiers are available.</RecordTableStateRow>
              ) : null}

              {availableTiers.map((tier) => (
                <tr key={tier.id}>
                  <td>
                    <strong>{tier.displayName}</strong>
                  </td>
                  <td>{tier.subscriptionEdition}</td>
                  <td>{tier.businessSizeSegment}</td>
                  <td>{tier.priceDisplay}</td>
                  <td>
                    {tier.modules.length} module{tier.modules.length === 1 ? "" : "s"}
                  </td>
                  <td>
                    <WorkspaceStatusPill tone={isCurrentTier(tier.displayName, data?.plan.subscriptionPlan) ? "active" : "neutral"}>
                      {isCurrentTier(tier.displayName, data?.plan.subscriptionPlan) ? "Current" : "Available"}
                    </WorkspaceStatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </WorkspaceSubtable>
        </WorkspaceSubtableShell>
      </WorkspacePanel>
    </>
  );
}

function formatCooldownRemaining(cooldownUntilUtc?: string | null, now = Date.now()) {
  if (!cooldownUntilUtc) {
    return null;
  }

  const cooldownEnd = new Date(cooldownUntilUtc);

  if (Number.isNaN(cooldownEnd.valueOf())) {
    return null;
  }

  const millisecondsRemaining = cooldownEnd.getTime() - now;

  if (millisecondsRemaining <= 0) {
    return "Cooldown has ended. Refresh billing to request a new switch.";
  }

  const totalMinutes = Math.ceil(millisecondsRemaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? `${days} day${days === 1 ? "" : "s"}` : null,
    hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : null,
    days === 0 && minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : null
  ].filter(Boolean);

  return `${parts.join(", ")} remaining, until ${formatDateTime(cooldownUntilUtc)}.`;
}
