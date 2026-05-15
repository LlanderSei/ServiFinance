import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SuperadminSubscriptionRecoveryActionResponse,
  SuperadminSubscriptionRecoveryResponse,
  SuperadminSubscriptionRecoveryRow
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
import {
  MobileRecordCardLayout,
  MobileRecordField,
  MobileRecordFieldGrid
} from "@/shared/records/MobileRecordDetails";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { useToast } from "@/shared/toast/ToastProvider";

export function SuperadminSubscriptionRecoveryTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const recoveryQuery = useQuery({
    queryKey: ["superadmin", "subscriptions", "recovery"],
    queryFn: () => httpGet<SuperadminSubscriptionRecoveryResponse>("/api/superadmin/subscriptions/recovery")
  });
  const recoveryActionMutation = useMutation({
    mutationFn: ({ tenantId, action }: { tenantId: string; action: "provider-sync" | "force-suspension" }) =>
      httpPostJson<SuperadminSubscriptionRecoveryActionResponse, Record<string, never>>(
        `/api/superadmin/subscriptions/recovery/${tenantId}/${action}`,
        {}
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["superadmin", "subscriptions", "recovery"] });
      toast.success({
        title: "Recovery action completed",
        message: response.message
      });
    },
    onError: (error) => {
      toast.error({
        title: "Recovery action failed",
        message: getApiErrorMessage(error, "The recovery action could not be completed.")
      });
    }
  });
  const summary = recoveryQuery.data?.summary;
  const rows = recoveryQuery.data?.rows ?? [];

  function runRecoveryAction(row: SuperadminSubscriptionRecoveryRow, action: "provider-sync" | "force-suspension") {
    if (action === "force-suspension" && !window.confirm(`Suspend tenant workspace access for ${row.tenantName}?`)) {
      return;
    }

    recoveryActionMutation.mutate({ tenantId: row.tenantId, action });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
      <WorkspaceMetricGrid className="md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Tenants" title={`${summary?.totalTenantAccounts ?? 0} tracked`} />
          <p className="text-sm text-base-content/65">Tenant accounts with billing state in the platform catalog.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="High risk" title={`${summary?.highRiskTenants ?? 0} tenants`} />
          <p className="text-sm text-base-content/65">Suspended, overdue, or failed-payment tenants that need review.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Failed payment" title={`${summary?.paymentFailedTenants ?? 0} failures`} />
          <p className="text-sm text-base-content/65">Provider or ledger failures that should enter recovery first.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Due soon" title={`${summary?.dueSoonTenants ?? 0} renewals`} />
          <p className="text-sm text-base-content/65">Renewals inside the next 7 days before escalation is needed.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Past due" title={`${summary?.pastDueTenants ?? 0} tenants`} />
          <p className="text-sm text-base-content/65">Failed or overdue renewals still inside the first recovery week.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Read-only" title={`${summary?.readOnlyRecommendedTenants ?? 0} recommended`} />
          <p className="text-sm text-base-content/65">Tenants past the 7-day recovery threshold before suspension review.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Suspension" title={`${summary?.suspensionReviewTenants ?? 0} review`} />
          <p className="text-sm text-base-content/65">Tenants at the final recovery-review threshold or already suspended.</p>
        </WorkspacePanel>
        <WorkspacePanel>
          <WorkspacePanelHeader eyebrow="Plan changes" title={`${summary?.pendingPlanChanges ?? 0} pending`} />
          <p className="text-sm text-base-content/65">{summary?.cooldownLockedTenants ?? 0} tenant(s) are blocked by switch-cancellation cooldown.</p>
        </WorkspacePanel>
      </WorkspaceMetricGrid>

      <WorkspacePanel className="min-h-0 flex-1">
        <WorkspacePanelHeader
          eyebrow="Recovery operations"
          title="Tenant renewal and downgrade queue"
          actions={(
            <button
              type="button"
              className="btn btn-sm rounded-full"
              onClick={() => void recoveryQuery.refetch()}
              disabled={recoveryQuery.isFetching}
            >
              {recoveryQuery.isFetching ? "Refreshing..." : "Refresh"}
            </button>
          )}
        />

        <WorkspaceDetailGrid className="xl:grid-cols-3">
          <WorkspaceDetailItem
            label="Recovery policy"
            value="Failed renewals stay visible here before read-only or suspension policy is enforced."
          />
          <WorkspaceDetailItem
            label="Provider path"
            value="Stripe-managed tenants recover payment methods through hosted billing portal from their tenant billing workspace."
          />
          <WorkspaceDetailItem
            label="Downgrade cleanup"
            value="Pending switches should clear locked-module work before the next renewal applies."
          />
        </WorkspaceDetailGrid>

        <WorkspaceSubtableShell className="min-h-0 flex-1 overflow-auto">
          <WorkspaceSubtable>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Standing</th>
                <th>Recovery stage</th>
                <th>Renewal</th>
                <th>Latest billing</th>
                <th>Pending switch</th>
                <th>Cooldown</th>
                <th>Recommended action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recoveryQuery.isLoading ? (
                <RecordTableStateRow colSpan={10}>Loading subscription recovery queue...</RecordTableStateRow>
              ) : null}

              {recoveryQuery.isError ? (
                <RecordTableStateRow colSpan={10} tone="error">
                  Unable to load subscription recovery queue.
                </RecordTableStateRow>
              ) : null}

              {!recoveryQuery.isLoading && !recoveryQuery.isError && rows.length === 0 ? (
                <RecordTableStateRow colSpan={10}>No tenant subscription records found.</RecordTableStateRow>
              ) : null}

              {rows.map((row) => (
                <tr key={row.tenantId}>
                  <td>
                    <MobileRecordCardLayout
                      upper={(
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <strong className="block text-sm text-base-content">{row.tenantName}</strong>
                            <span className="block text-xs text-base-content/55">/t/{row.domainSlug}</span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusPill label={row.accountStanding} tone={resolveStandingTone(row)} />
                            <StatusPill label={row.recoveryStage} tone={resolveStageTone(row.recoveryStage)} />
                          </div>
                        </div>
                      )}
                      middleColumns={2}
                      middle={(
                        <>
                          <MobileRecordFieldGrid>
                            <MobileRecordField label="Plan" value={row.subscriptionPlan} />
                            <MobileRecordField label="Segment" value={row.businessSizeSegment} />
                            <MobileRecordField label="Edition" value={row.subscriptionEdition} />
                            <MobileRecordField label="Renewal" value={formatDate(row.nextRenewalDateUtc)} />
                            <MobileRecordField label="Expected amount" value={formatCurrency(row.expectedRenewalAmount, row.expectedRenewalCurrencyCode)} />
                          </MobileRecordFieldGrid>
                          <MobileRecordFieldGrid>
                            <MobileRecordField label="Billing" value={row.latestBillingStatus ?? "No ledger yet"} />
                            <MobileRecordField label="Latest billing" value={formatDate(row.latestBillingAtUtc)} />
                            <MobileRecordField label="Pending switch" value={row.pendingPlanChange ?? "None"} />
                            <MobileRecordField label="Cooldown" value={formatDate(row.cooldownUntilUtc)} />
                          </MobileRecordFieldGrid>
                        </>
                      )}
                      lower={(
                        <MobileRecordFieldGrid>
                          <MobileRecordField label="Recovery detail" value={formatRecoveryStageDetail(row)} />
                          <MobileRecordField label="Recommended action" value={row.recommendedAction} />
                        </MobileRecordFieldGrid>
                      )}
                    />
                    <div className="hidden gap-1 lg:grid">
                      <strong>{row.tenantName}</strong>
                      <span className="text-xs text-base-content/55">/t/{row.domainSlug}</span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-1">
                      <span>{row.subscriptionPlan}</span>
                      <span className="text-xs text-base-content/55">
                        {row.businessSizeSegment} / {row.subscriptionEdition}
                      </span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-2">
                      <StatusPill label={row.accountStanding} tone={resolveStandingTone(row)} />
                      <span className="text-xs text-base-content/55">
                        {row.billingProvider} / {row.subscriptionStatus} / {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-2">
                      <StatusPill label={row.recoveryStage} tone={resolveStageTone(row.recoveryStage)} />
                      <span className="max-w-[18rem] text-xs text-base-content/55">
                        {formatRecoveryStageDetail(row)}
                      </span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-1">
                      <span>{formatDate(row.nextRenewalDateUtc)}</span>
                      <span className="text-xs text-base-content/55">
                        {formatCurrency(row.expectedRenewalAmount, row.expectedRenewalCurrencyCode)}
                      </span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-1">
                      <span>{row.latestBillingStatus ?? "No ledger yet"}</span>
                      <span className="text-xs text-base-content/55">
                        {formatDate(row.latestBillingAtUtc)}
                      </span>
                      {row.pendingReviewCount > 0 ? (
                        <span className="text-xs font-bold text-warning">{row.pendingReviewCount} pending review</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="max-lg:hidden">
                    <div className="grid gap-1">
                      <span>{row.pendingPlanChange ?? "None"}</span>
                      <span className="text-xs text-base-content/55">
                        Effective {formatDate(row.pendingPlanChangeEffectiveAtUtc)}
                      </span>
                    </div>
                  </td>
                  <td className="max-lg:hidden">{formatDate(row.cooldownUntilUtc)}</td>
                  <td className="max-w-[24rem] text-sm text-base-content/70 max-lg:hidden">{row.recommendedAction}</td>
                  <td>
                    <RecoveryActions
                      row={row}
                      isBusy={recoveryActionMutation.isPending}
                      onAction={runRecoveryAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </WorkspaceSubtable>
        </WorkspaceSubtableShell>
      </WorkspacePanel>
    </div>
  );
}

function RecoveryActions({
  row,
  isBusy,
  onAction
}: {
  row: SuperadminSubscriptionRecoveryRow;
  isBusy: boolean;
  onAction: (row: SuperadminSubscriptionRecoveryRow, action: "provider-sync" | "force-suspension") => void;
}) {
  const canSyncProvider = row.billingProvider === "Stripe";
  const canForceSuspend = row.recoveryStage === "Suspension review" && row.isActive;

  return (
    <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:min-w-[10rem] lg:flex-col">
      <button
        type="button"
        className="btn btn-xs rounded-full"
        disabled={!canSyncProvider || isBusy}
        title={canSyncProvider ? "Re-read the Stripe subscription status" : "Provider sync is only available for Stripe tenants"}
        onClick={() => onAction(row, "provider-sync")}
      >
        Sync provider
      </button>
      <button
        type="button"
        className="btn btn-xs rounded-full border-error/30 text-error hover:bg-error hover:text-error-content"
        disabled={!canForceSuspend || isBusy}
        title={canForceSuspend ? "Force suspension after recovery review" : "Force suspension is only available at suspension review"}
        onClick={() => onAction(row, "force-suspension")}
      >
        Force suspend
      </button>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "error" | "neutral" }) {
  const toneClass = {
    success: "border-success/20 bg-success/12 text-success",
    warning: "border-warning/25 bg-warning/14 text-warning",
    error: "border-error/20 bg-error/12 text-error",
    neutral: "border-base-300/80 bg-base-200 text-base-content/70"
  }[tone];

  return (
    <span className={`inline-flex w-max rounded-full border px-3 py-1 text-xs font-extrabold ${toneClass}`}>
      {label}
    </span>
  );
}

function resolveStandingTone(row: SuperadminSubscriptionRecoveryRow) {
  if (row.suspensionRisk === "High") {
    return "error";
  }

  if (row.suspensionRisk === "Medium") {
    return "warning";
  }

  if (row.accountStanding === "Active") {
    return "success";
  }

  return "neutral";
}

function resolveStageTone(stage: string) {
  if (stage === "Suspension review") {
    return "error";
  }

  if (stage === "Read-only recommended" || stage === "Past due") {
    return "warning";
  }

  if (stage === "Active") {
    return "success";
  }

  return "neutral";
}

function formatRecoveryStageDetail(row: SuperadminSubscriptionRecoveryRow) {
  const overdueText = row.overdueDays === null
    ? null
    : `${row.overdueDays} day${row.overdueDays === 1 ? "" : "s"} overdue`;

  if (row.recoveryStage === "Past due" && row.readOnlyRecommendedAtUtc) {
    return `${overdueText ?? row.recoveryStageDescription}; read-only review starts ${formatDate(row.readOnlyRecommendedAtUtc)}.`;
  }

  if (row.recoveryStage === "Read-only recommended" && row.suspensionReviewAtUtc) {
    return `${overdueText ?? row.recoveryStageDescription}; suspension review starts ${formatDate(row.suspensionReviewAtUtc)}.`;
  }

  if (row.recoveryStage === "Suspension review" && overdueText) {
    return `${overdueText}; ${row.recoveryStageDescription}`;
  }

  return row.recoveryStageDescription;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatCurrency(value: number | null, currencyCode: string | null) {
  if (value === null) {
    return "Amount unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "PHP",
    maximumFractionDigits: 0
  }).format(value);
}
