import type { TenantBillingOverviewResponse } from "@/shared/api/contracts";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getRiskTone,
  getStandingTone
} from "./billingUi";

type BillingOverviewTabProps = {
  data?: TenantBillingOverviewResponse;
  isLoading: boolean;
  history: TenantBillingOverviewResponse["history"];
  billingProvider: string;
  isAutorenewalManaged: boolean;
};

export function BillingOverviewTab({
  data,
  isLoading,
  history,
  billingProvider,
  isAutorenewalManaged
}: BillingOverviewTabProps) {
  const confirmedCount = history.filter((row) => row.status === "Confirmed").length;
  const totalSubmittedAmount = history.reduce((sum, row) => sum + row.amountSubmitted, 0);
  const webModuleCount = data?.plan.modules.filter((row) => row.channel === "Web").length ?? 0;
  const desktopModuleCount = data?.plan.modules.filter((row) => row.channel === "Desktop").length ?? 0;
  const moduleCount = data?.plan.modules.length ?? 0;
  const standingNotes = isAutorenewalManaged
    ? [
        `${billingProvider} manages recurring renewal from the payment method used during registration or later billing-portal updates.`,
        "Renewal history is synchronized into this ledger from provider events instead of tenant-uploaded proof files.",
        "Subscription posture, suspension risk, and future plan-state changes still flow back into the tenant access model through provider synchronization."
      ]
    : [
        "Manual renewal proof submission has been removed from this tenant workspace.",
        "This tenant needs an online billing provider before future cycles can auto-renew.",
        "Existing historical billing rows remain visible for audit continuity, but new renewals should come from provider events."
      ];

  return (
    <>
      <section className="overflow-hidden rounded-box border border-base-300/70 bg-[radial-gradient(circle_at_top_left,rgba(86,146,255,0.16),transparent_34%),linear-gradient(180deg,var(--color-base-100),var(--color-base-200))] p-4 text-base-content shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-[58rem]">
            <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-base-content/60">Commercial workspace</p>
            <h2 className="mt-2 text-[clamp(1.85rem,3vw,2.8rem)] font-bold tracking-[-0.05em] text-base-content">
              {buildHeroHeadline(data?.plan.subscriptionPlan, data?.standing.accountStanding)}
            </h2>
            <p className="mt-3 text-[0.98rem] leading-7 text-base-content/72">
              {isLoading
                ? "Pulling the tenant subscription brief, module coverage, and billing history..."
                : data?.plan.planSummary ??
                  "Track plan coverage, renewal posture, and payment history from one tenant-scoped billing surface."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[32rem]">
            <HeroStat
              label="Standing"
              value={data?.standing.accountStanding ?? "Loading"}
              description="Current commercial state of the tenant subscription."
            />
            <HeroStat
              label="Next checkpoint"
              value={formatDate(data?.standing.nextRenewalDateUtc)}
              description="Auto-renewal checkpoint derived from subscription state and provider events."
            />
            <HeroStat
              label="Expected renewal"
              value={formatCurrency(data?.standing.expectedRenewalAmount)}
              description="Current monthly rate inferred from the subscribed catalog tier."
            />
          </div>
        </div>
      </section>

      <WorkspaceMetricGrid className="2xl:grid-cols-5">
        <MetricCard
          label="Billing records"
          value={history.length}
          description="Recorded subscription cycles already present in the tenant billing ledger."
        />
        <MetricCard
          label="Confirmed cycles"
          value={confirmedCount}
          description="Subscription cycles already verified against the tenant's billing history."
        />
        <MetricCard
          label="Renewal mode"
          value={isAutorenewalManaged ? "Auto" : "Setup needed"}
          description={isAutorenewalManaged ? `${billingProvider} handles recurring renewal.` : "No online renewal provider is attached to this tenant."}
        />
        <MetricCard
          label="Collected amount"
          value={formatCurrency(totalSubmittedAmount)}
          description="Cumulative billing amount currently recorded from provider or historical ledger events."
        />
        <MetricCard
          label="Module coverage"
          value={moduleCount}
          description="Unlocked modules currently aligned to the active subscription tier."
        />
      </WorkspaceMetricGrid>

      <WorkspacePanelGrid>
        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Plan profile"
            title="Tier alignment and delivery coverage"
            actions={
              data ? (
                <WorkspaceStatusPill tone={getStandingTone(data.standing.accountStanding)}>
                  {data.plan.subscriptionEdition}
                </WorkspaceStatusPill>
              ) : null
            }
          />

          <WorkspaceDetailGrid>
            <WorkspaceDetailItem label="Plan" value={data?.plan.subscriptionPlan ?? "Loading..."} />
            <WorkspaceDetailItem label="Segment" value={data?.plan.businessSizeSegment ?? "Loading..."} />
            <WorkspaceDetailItem label="Catalog rate" value={data?.plan.priceDisplay ?? "Not available"} />
            <WorkspaceDetailItem label="Billing cadence" value={data?.plan.billingLabel ?? "Not available"} />
            <WorkspaceDetailItem label="Web modules" value={webModuleCount} />
            <WorkspaceDetailItem label="Desktop modules" value={desktopModuleCount} />
          </WorkspaceDetailGrid>

          <WorkspaceEmptyState>
            {data?.plan.audienceSummary ??
              "This section aligns the tenant's commercial profile with the same subscription catalog used by the platform."}
          </WorkspaceEmptyState>
        </WorkspacePanel>

        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Standing"
            title="Renewal posture"
            actions={
              data ? (
                <WorkspaceStatusPill tone={getRiskTone(data.standing.suspensionRisk)}>
                  {data.standing.suspensionRisk} risk
                </WorkspaceStatusPill>
              ) : null
            }
          />

          <WorkspaceDetailGrid>
            <WorkspaceDetailItem label="Account standing" value={data?.standing.accountStanding ?? "Loading..."} />
            <WorkspaceDetailItem label="Subscription status" value={data?.plan.subscriptionStatus ?? "Loading..."} />
            <WorkspaceDetailItem label="Billing provider" value={billingProvider} />
            <WorkspaceDetailItem label="Next billing checkpoint" value={formatDate(data?.standing.nextRenewalDateUtc)} />
            <WorkspaceDetailItem label="Latest billing event" value={data?.standing.latestSubmissionStatus ?? "No events yet"} />
            <WorkspaceDetailItem label="Last confirmed coverage" value={formatDate(data?.standing.lastConfirmedCoverageEndUtc)} />
            <WorkspaceDetailItem label="Latest activity" value={formatDateTime(data?.standing.latestSubmissionAtUtc)} />
          </WorkspaceDetailGrid>

          <WorkspaceNoteList items={standingNotes} />
        </WorkspacePanel>
      </WorkspacePanelGrid>
    </>
  );
}

function HeroStat({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.4rem] border border-base-300/65 bg-base-100/80 px-4 py-4 backdrop-blur-sm">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-base-content/60">{label}</p>
      <strong className="mt-2 block text-[1.5rem] tracking-[-0.05em] text-base-content">{value}</strong>
      <p className="mt-1 text-sm leading-6 text-base-content/65">{description}</p>
    </article>
  );
}

function buildHeroHeadline(planName?: string, accountStanding?: string) {
  if (!planName && !accountStanding) {
    return "Tenant billing posture is loading.";
  }

  if (!planName) {
    return `Tenant billing is currently ${accountStanding?.toLowerCase()}.`;
  }

  return `${planName} is currently ${accountStanding?.toLowerCase() ?? "active"}, with auto-renewal tracked from one workspace.`;
}
