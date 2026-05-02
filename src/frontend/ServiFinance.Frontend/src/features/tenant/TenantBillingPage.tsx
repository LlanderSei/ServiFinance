import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  TenantBillingOverviewResponse,
  TenantBillingPortalSessionResponse,
  TenantBillingRecordRow
} from "@/shared/api/contracts";
import { httpGet, httpPostFormData, httpPostJson } from "@/shared/api/http";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInlineNote,
  WorkspaceInput,
  WorkspaceNotice,
  WorkspaceSelect,
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

type BillingFormState = {
  amountSubmitted: string;
  paymentMethod: string;
  referenceNumber: string;
  note: string;
  proofFile: File | null;
};

const initialFormState: BillingFormState = {
  amountSubmitted: "",
  paymentMethod: "Bank transfer",
  referenceNumber: "",
  note: "",
  proofFile: null
};

export function TenantBillingPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const [formState, setFormState] = useState<BillingFormState>(initialFormState);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const billingQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "billing-overview"],
    queryFn: () => httpGet<TenantBillingOverviewResponse>(`/api/tenants/${tenantDomainSlug}/billing/overview`)
  });

  const submitMutation = useMutation<TenantBillingRecordRow, Error, FormData>({
    mutationFn: (payload: FormData) =>
      httpPostFormData<TenantBillingRecordRow>(`/api/tenants/${tenantDomainSlug}/billing/submissions`, payload),
    onSuccess: async (record) => {
      setSuccessMessage(`Submitted ${record.billingPeriodLabel} for billing review.`);
      setFormState(initialFormState);
      if (proofInputRef.current) {
        proofInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "billing-overview"]
      });
    }
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
  const canSubmitRenewalProof = billingQuery.data?.standing.canSubmitRenewalProof ?? true;
  const billingProvider = billingQuery.data?.standing.billingProvider ?? "Manual";
  const isStripeManaged = billingProvider === "Stripe";
  const canOpenBillingPortal = billingQuery.data?.standing.canOpenBillingPortal ?? false;
  const standingNotes = isStripeManaged
    ? [
        "This tenant is now Stripe-managed, so renewals and payment methods are handled through the Stripe billing portal instead of proof submission.",
        "The payment ledger below is synchronized from Stripe invoice events, which keeps the tenant-side commercial history visible in the same workspace.",
        "Subscription posture, suspension risk, and future plan-state changes still flow back into the tenant access model through webhook synchronization."
      ]
    : [
        "Only one billing proof can stay pending at a time, so tenant admins do not accidentally stack duplicate renewal submissions.",
        "Submitted proof remains tenant-scoped here, while final review and confirmation can still evolve on the platform side later.",
        "The current expected renewal amount is derived from the same subscription tier catalog used by the superadmin workspace."
      ];

  function updateField<TKey extends keyof BillingFormState>(key: TKey, value: BillingFormState[TKey]) {
    setSuccessMessage(null);
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const normalizedAmount = formState.amountSubmitted.trim() === ""
      ? expectedRenewalAmount ?? 0
      : Number(formState.amountSubmitted);

    const payload = new FormData();
    payload.append("amountSubmitted", String(normalizedAmount));
    payload.append("paymentMethod", formState.paymentMethod);
    payload.append("referenceNumber", formState.referenceNumber.trim());
    payload.append("note", formState.note.trim());
    if (formState.proofFile) {
      payload.append("proofFile", formState.proofFile);
    }

    submitMutation.mutate(payload);
  }

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / Billing`}
      title="Subscription and billing"
      description="Review the tenant subscription standing, included delivery surface, renewal rhythm, and manual billing submissions from one commercial workspace."
      recordCount={history.length}
      singularLabel="billing record"
    >
      {billingQuery.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          Unable to load the tenant billing workspace right now.
        </WorkspaceNotice>
      ) : null}

      {submitMutation.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          {submitMutation.error.message}
        </WorkspaceNotice>
      ) : null}

      {portalMutation.isError ? (
        <WorkspaceNotice tone="error" className="m-4 mb-0">
          {portalMutation.error.message}
        </WorkspaceNotice>
      ) : null}

      {successMessage ? (
        <WorkspaceNotice className="m-4 mb-0">
          {successMessage}
        </WorkspaceNotice>
      ) : null}

      <RecordScrollRegion>
        <WorkspaceScrollStack className="p-0">
          <WorkspacePanel className="overflow-hidden border-base-300/20 bg-[radial-gradient(circle_at_top_left,rgba(86,146,255,0.12),transparent_32%),linear-gradient(180deg,rgba(18,28,46,0.98),rgba(9,15,27,0.98))] text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[58rem]">
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/56">Commercial workspace</p>
                <h2 className="mt-2 text-[clamp(1.85rem,3vw,2.8rem)] font-bold tracking-[-0.05em] text-white">
                  {buildHeroHeadline(
                    billingQuery.data?.plan.subscriptionPlan,
                    billingQuery.data?.standing.accountStanding
                  )}
                </h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-white/74">
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
                  description="Renewal or next submitted cycle date derived from the billing ledger."
                />
                <HeroStat
                  label="Expected renewal"
                  value={formatCurrency(expectedRenewalAmount)}
                  description="Current monthly rate inferred from the subscribed catalog tier."
                />
              </div>
            </div>
          </WorkspacePanel>

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
              label="Pending review"
              value={billingQuery.data?.standing.pendingReviewCount ?? 0}
              description="Manual billing submissions still waiting for platform confirmation."
            />
            <MetricCard
              label="Submitted amount"
              value={formatCurrency(totalSubmittedAmount)}
              description="Cumulative billing amount currently recorded in the tenant ledger."
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
                <WorkspaceDetailItem label="Latest submission" value={billingQuery.data?.standing.latestSubmissionStatus ?? "No submissions yet"} />
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
                      <th>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingQuery.isLoading ? (
                      <RecordTableStateRow colSpan={6}>Loading tenant billing history...</RecordTableStateRow>
                    ) : null}

                    {!billingQuery.isLoading && !history.length ? (
                      <RecordTableStateRow colSpan={6}>No billing submissions have been recorded yet.</RecordTableStateRow>
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
                                {row.proofOriginalFileName ?? "Open proof"}
                              </a>
                            ) : (
                              <span className="text-sm text-base-content/60">Reference-only</span>
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
                eyebrow={isStripeManaged ? "Stripe billing" : "Manual renewal"}
                title={isStripeManaged ? "Manage subscription in Stripe" : "Submit billing proof"}
                actions={
                  billingQuery.data ? (
                    <WorkspaceStatusPill tone={isStripeManaged ? "progress" : canSubmitRenewalProof ? "progress" : "warning"}>
                      {isStripeManaged
                        ? "Stripe managed"
                        : canSubmitRenewalProof
                          ? "Ready to submit"
                          : "Pending review exists"}
                    </WorkspaceStatusPill>
                  ) : null
                }
              />

              {isStripeManaged ? (
                <div className="grid gap-4">
                  <WorkspaceInlineNote>
                    This tenant now renews through Stripe. Open the hosted billing portal to update payment methods, review invoices, or manage the recurring subscription directly.
                  </WorkspaceInlineNote>

                  <WorkspaceActionButton
                    type="button"
                    className="w-full justify-center"
                    disabled={!canOpenBillingPortal || portalMutation.isPending}
                    onClick={() => portalMutation.mutate()}
                  >
                    {portalMutation.isPending ? "Opening Stripe portal..." : "Open Stripe billing portal"}
                  </WorkspaceActionButton>
                </div>
              ) : (
                <WorkspaceForm onSubmit={handleSubmit}>
                  <WorkspaceFieldGrid>
                    <WorkspaceField label="Submitted amount">
                      <WorkspaceInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.amountSubmitted}
                        onChange={(event) => updateField("amountSubmitted", event.target.value)}
                        placeholder={expectedRenewalAmount ? String(expectedRenewalAmount) : "0.00"}
                        disabled={!canSubmitRenewalProof || submitMutation.isPending}
                      />
                    </WorkspaceField>

                    <WorkspaceField label="Payment method">
                      <WorkspaceSelect
                        value={formState.paymentMethod}
                        onChange={(event) => updateField("paymentMethod", event.target.value)}
                        disabled={!canSubmitRenewalProof || submitMutation.isPending}
                      >
                        <option>Bank transfer</option>
                        <option>GCash</option>
                        <option>Cash deposit</option>
                        <option>Online banking</option>
                      </WorkspaceSelect>
                    </WorkspaceField>

                    <WorkspaceField label="Reference number">
                      <WorkspaceInput
                        value={formState.referenceNumber}
                        onChange={(event) => updateField("referenceNumber", event.target.value)}
                        placeholder="Transaction or slip reference"
                        disabled={!canSubmitRenewalProof || submitMutation.isPending}
                      />
                    </WorkspaceField>

                    <WorkspaceField label="Proof file">
                      <input
                        ref={proofInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="file-input file-input-bordered w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                        onChange={(event) => updateField("proofFile", event.target.files?.[0] ?? null)}
                        disabled={!canSubmitRenewalProof || submitMutation.isPending}
                      />
                    </WorkspaceField>

                    <WorkspaceField label="Notes" wide>
                      <textarea
                        className="textarea textarea-bordered min-h-28 w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                        value={formState.note}
                        onChange={(event) => updateField("note", event.target.value)}
                        placeholder="Add transfer notes, payer context, or anything finance review should know."
                        disabled={!canSubmitRenewalProof || submitMutation.isPending}
                      />
                    </WorkspaceField>
                  </WorkspaceFieldGrid>

                  <WorkspaceInlineNote>
                    The current Phase 9 manual path still applies to this tenant: submit renewal proof here, and the commercial review loop can be tightened further on the platform side later.
                  </WorkspaceInlineNote>

                  <WorkspaceActionButton
                    type="submit"
                    className="w-full justify-center"
                    disabled={!canSubmitRenewalProof || submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Submitting proof..." : "Submit billing proof"}
                  </WorkspaceActionButton>
                </WorkspaceForm>
              )}
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
    <article className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-white/56">{label}</p>
      <strong className="mt-2 block text-[1.5rem] tracking-[-0.05em] text-white">{value}</strong>
      <p className="mt-1 text-sm leading-6 text-white/65">{description}</p>
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

  return `${planName} is currently ${accountStanding?.toLowerCase() ?? "active"}, with renewal and proof submission tracked from one workspace.`;
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
