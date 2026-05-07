import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type {
  TenantBillingOverviewResponse,
  TenantBillingPortalSessionResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceActionButton,
  WorkspaceInlineNote,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";

export function TenantBillingPage() {
  const { tenantDomainSlug = "" } = useParams();
  const currentUser = getCurrentSession()?.user ?? null;
  const canManageBilling = hasPermission(currentUser, "sms.billing.manage");

  const billingQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "billing-overview"],
    queryFn: () => httpGet<TenantBillingOverviewResponse>(`/api/tenants/${tenantDomainSlug}/billing/overview`)
  });
  const portalMutation = useMutation({
    mutationFn: () =>
      httpPostJson<TenantBillingPortalSessionResponse, Record<string, never>>(
        `/api/tenants/${tenantDomainSlug}/billing/portal-session`,
        {}
      ),
    onSuccess: (response) => {
      window.location.assign(response.url);
    }
  });

  const history = billingQuery.data?.history ?? [];
  const confirmedCount = history.filter((row) => row.status === "Confirmed").length;
  const totalSubmittedAmount = history.reduce((sum, row) => sum + row.amountSubmitted, 0);
  const webModuleCount = billingQuery.data?.plan.modules.filter((row) => row.channel === "Web").length ?? 0;
  const desktopModuleCount = billingQuery.data?.plan.modules.filter((row) => row.channel === "Desktop").length ?? 0;
  const moduleCount = billingQuery.data?.plan.modules.length ?? 0;
  const expectedRenewalAmount = billingQuery.data?.standing.expectedRenewalAmount;
  const billingProvider = billingQuery.data?.standing.billingProvider ?? "Manual";
  const isStripeManaged = billingProvider === "Stripe";
  const isAutorenewalManaged = billingProvider !== "Manual";
  const canOpenBillingPortal = canManageBilling && (billingQuery.data?.standing.canOpenBillingPortal ?? false);
  const renewalWarningMessage = buildRenewalWarning(
    billingQuery.data?.standing.nextRenewalDateUtc,
    isAutorenewalManaged,
    billingProvider
  );
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
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / Billing`}
      title="Subscription and billing"
      description="Review tenant subscription standing, included delivery surface, auto-renewal timing, and provider-synced billing history from one commercial workspace."
      recordCount={history.length}
      singularLabel="billing record"
    >
      {billingQuery.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          Unable to load the tenant billing workspace right now.
        </WorkspaceNotice>
      ) : null}

      {portalMutation.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          {portalMutation.error.message}
        </WorkspaceNotice>
      ) : null}

      {renewalWarningMessage ? (
        <WorkspaceNotice tone={isAutorenewalManaged ? "info" : "error"} className="m-4 mb-0">
          {renewalWarningMessage}
        </WorkspaceNotice>
      ) : null}

      <RecordScrollRegion>
        <WorkspaceScrollStack className="p-0">
          <section className="overflow-hidden rounded-box border border-base-300/70 bg-[radial-gradient(circle_at_top_left,rgba(86,146,255,0.16),transparent_34%),linear-gradient(180deg,var(--color-base-100),var(--color-base-200))] p-4 text-base-content shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[58rem]">
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-base-content/60">Commercial workspace</p>
                <h2 className="mt-2 text-[clamp(1.85rem,3vw,2.8rem)] font-bold tracking-[-0.05em] text-base-content">
                  {buildHeroHeadline(
                    billingQuery.data?.plan.subscriptionPlan,
                    billingQuery.data?.standing.accountStanding
                  )}
                </h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-base-content/72">
                  {billingQuery.isLoading
                    ? "Pulling the tenant subscription brief, module coverage, and billing history..."
                    : billingQuery.data?.plan.planSummary ??
                      "Track plan coverage, renewal posture, and payment history from one tenant-scoped billing surface."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[32rem]">
                <HeroStat
                  label="Standing"
                  value={billingQuery.data?.standing.accountStanding ?? "Loading"}
                  description="Current commercial state of the tenant subscription."
                />
                <HeroStat
                  label="Next checkpoint"
                  value={formatDate(billingQuery.data?.standing.nextRenewalDateUtc)}
                  description="Auto-renewal checkpoint derived from subscription state and provider events."
                />
                <HeroStat
                  label="Expected renewal"
                  value={formatCurrency(expectedRenewalAmount)}
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
                  billingQuery.data ? (
                    <WorkspaceStatusPill tone={getStandingTone(billingQuery.data.standing.accountStanding)}>
                      {billingQuery.data.plan.subscriptionEdition}
                    </WorkspaceStatusPill>
                  ) : null
                }
              />

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="Plan" value={billingQuery.data?.plan.subscriptionPlan ?? "Loading..."} />
                <WorkspaceDetailItem label="Segment" value={billingQuery.data?.plan.businessSizeSegment ?? "Loading..."} />
                <WorkspaceDetailItem label="Catalog rate" value={billingQuery.data?.plan.priceDisplay ?? "Not available"} />
                <WorkspaceDetailItem label="Billing cadence" value={billingQuery.data?.plan.billingLabel ?? "Not available"} />
                <WorkspaceDetailItem label="Web modules" value={webModuleCount} />
                <WorkspaceDetailItem label="Desktop modules" value={desktopModuleCount} />
              </WorkspaceDetailGrid>

              <WorkspaceEmptyState>
                {billingQuery.data?.plan.audienceSummary ??
                  "This section aligns the tenant's commercial profile with the same subscription catalog used by the platform."}
              </WorkspaceEmptyState>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Standing"
                title="Renewal posture"
                actions={
                  billingQuery.data ? (
                    <WorkspaceStatusPill tone={getRiskTone(billingQuery.data.standing.suspensionRisk)}>
                      {billingQuery.data.standing.suspensionRisk} risk
                    </WorkspaceStatusPill>
                  ) : null
                }
              />

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="Account standing" value={billingQuery.data?.standing.accountStanding ?? "Loading..."} />
                <WorkspaceDetailItem label="Subscription status" value={billingQuery.data?.plan.subscriptionStatus ?? "Loading..."} />
                <WorkspaceDetailItem label="Billing provider" value={billingProvider} />
                <WorkspaceDetailItem label="Next billing checkpoint" value={formatDate(billingQuery.data?.standing.nextRenewalDateUtc)} />
                <WorkspaceDetailItem label="Latest billing event" value={billingQuery.data?.standing.latestSubmissionStatus ?? "No events yet"} />
                <WorkspaceDetailItem label="Last confirmed coverage" value={formatDate(billingQuery.data?.standing.lastConfirmedCoverageEndUtc)} />
                <WorkspaceDetailItem label="Latest activity" value={formatDateTime(billingQuery.data?.standing.latestSubmissionAtUtc)} />
              </WorkspaceDetailGrid>

              <WorkspaceNoteList items={standingNotes} />
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid className="xl:[grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Billing ledger" title="Subscription payment history" />

              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th>Coverage</th>
                      <th>Submitted</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingQuery.isLoading ? (
                      <RecordTableStateRow colSpan={6}>Loading tenant billing history...</RecordTableStateRow>
                    ) : null}

                    {!billingQuery.isLoading && !history.length ? (
                      <RecordTableStateRow colSpan={6}>No billing events have been recorded yet.</RecordTableStateRow>
                    ) : null}

                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="grid gap-1">
                            <strong className="text-base-content">{row.billingPeriodLabel}</strong>
                            <span className="text-xs text-base-content/60">{row.referenceNumber}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            <span>{formatDate(row.coverageStartUtc)} to {formatDate(row.coverageEndUtc)}</span>
                            <span className="text-xs text-base-content/60">Due {formatDate(row.dueDateUtc)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            <strong>{formatCurrency(row.amountSubmitted)}</strong>
                            <span className="text-xs text-base-content/60">Expected {formatCurrency(row.amountDue)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            <span>{row.paymentMethod}</span>
                            <span className="text-xs text-base-content/60">By {row.submittedByUserName}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            <WorkspaceStatusPill tone={getBillingStatusTone(row.status)}>
                              {row.status}
                            </WorkspaceStatusPill>
                            <span className="text-xs text-base-content/60">{formatDateTime(row.submittedAtUtc)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid gap-1">
                            {row.proofRelativeUrl ? (
                              <a
                                href={row.proofRelativeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {row.proofOriginalFileName ?? "Open receipt"}
                              </a>
                            ) : (
                              <span className="text-sm text-base-content/60">Provider event</span>
                            )}
                            {row.reviewRemarks ? (
                              <span className="text-xs text-base-content/60">{row.reviewRemarks}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Autorenewal"
                title={isAutorenewalManaged ? `Managed by ${billingProvider}` : "Online renewal required"}
                actions={
                  billingQuery.data ? (
                    <WorkspaceStatusPill tone={isAutorenewalManaged ? "progress" : "warning"}>
                      {isAutorenewalManaged ? "Auto-renewal" : "Setup needed"}
                    </WorkspaceStatusPill>
                  ) : null
                }
              />

              <div className="grid gap-4">
                <WorkspaceInlineNote>
                  {isAutorenewalManaged
                    ? `Renewals are handled automatically through ${billingProvider} using the payment method attached during registration or the hosted billing portal.`
                    : "Manual renewal proof upload has been removed. Attach this tenant to an online billing provider so renewal can happen automatically."}
                </WorkspaceInlineNote>

                {isStripeManaged || canOpenBillingPortal ? (
                  <WorkspaceActionButton
                    type="button"
                    className="w-full justify-center"
                    disabled={!canOpenBillingPortal || portalMutation.isPending}
                    onClick={() => portalMutation.mutate()}
                  >
                    {portalMutation.isPending ? "Opening billing portal..." : "Open billing portal"}
                  </WorkspaceActionButton>
                ) : (
                  <WorkspaceInlineNote className="rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
                    No hosted billing portal is available for this tenant yet.
                  </WorkspaceInlineNote>
                )}
              </div>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Unlocked modules" title="What the current plan covers" />

            {!billingQuery.isLoading && !billingQuery.data?.plan.modules.length ? (
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
                  {billingQuery.isLoading ? (
                    <RecordTableStateRow colSpan={3}>Loading module coverage...</RecordTableStateRow>
                  ) : null}

                  {billingQuery.data?.plan.modules.map((row) => (
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
        </WorkspaceScrollStack>
      </RecordScrollRegion>
    </RecordWorkspace>
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

function buildRenewalWarning(value?: string | null, isAutorenewalManaged = false, billingProvider = "Manual") {
  if (!value) {
    return null;
  }

  const renewalDate = new Date(value);
  if (Number.isNaN(renewalDate.valueOf())) {
    return null;
  }

  const millisecondsUntilRenewal = renewalDate.getTime() - Date.now();
  const daysUntilRenewal = Math.ceil(millisecondsUntilRenewal / 86_400_000);

  if (daysUntilRenewal < 0) {
    return isAutorenewalManaged
      ? `${billingProvider} renewal checkpoint passed on ${formatDate(value)}. Check provider billing history if access did not update.`
      : `Renewal checkpoint passed on ${formatDate(value)}. Connect online billing because manual renewal proof is no longer accepted here.`;
  }

  if (daysUntilRenewal <= 7) {
    return isAutorenewalManaged
      ? `${billingProvider} will auto-renew this tenant on ${formatDate(value)}. Review the payment method before the cycle closes.`
      : `Renewal is due on ${formatDate(value)}. Connect an online billing provider before this cycle because manual proof submission is no longer available.`;
  }

  return null;
}

function getStandingTone(accountStanding: string) {
  if (accountStanding === "Suspended") {
    return "inactive";
  }

  if (accountStanding === "Renewal overdue" || accountStanding === "Renewal due soon") {
    return "warning";
  }

  if (accountStanding === "Awaiting billing review") {
    return "progress";
  }

  return "active";
}

function getRiskTone(risk: string) {
  if (risk === "High") {
    return "inactive";
  }

  if (risk === "Medium") {
    return "warning";
  }

  return "active";
}

function getBillingStatusTone(status: string) {
  if (status === "Confirmed") {
    return "active";
  }

  if (status === "Rejected") {
    return "inactive";
  }

  if (status === "Pending Review") {
    return "progress";
  }

  return "neutral";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
