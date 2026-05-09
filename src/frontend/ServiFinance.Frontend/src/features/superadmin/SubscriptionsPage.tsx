import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SuperadminCatalogModule,
  SuperadminSubscriptionTier,
  UpsertSuperadminSubscriptionTierRequest
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpPostJson, httpPutJson } from "@/shared/api/http";
import { useSuperadminSubscriptionCatalog } from "@/shared/api/useSuperadminSubscriptionCatalog";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { SuperadminSubscriptionRecoveryTab } from "./SuperadminSubscriptionRecoveryTab";

type TierFormState = {
  code: string;
  displayName: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  audienceSummary: string;
  description: string;
  monthlyPriceAmount: string;
  currencyCode: string;
  billingLabel: string;
  planSummary: string;
  highlightLabel: string;
  sortOrder: string;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  isActive: boolean;
  moduleAccess: Record<string, string>;
};

type TierEditorState = {
  mode: "create" | "edit";
  tierId?: string;
  form: TierFormState;
};

const editionTabs = [
  { key: "All", label: "All editions" },
  { key: "Standard", label: "Standard" },
  { key: "Premium", label: "Premium" }
];
const workspaceTabs = [
  { key: "catalog", label: "Catalog" },
  { key: "recovery", label: "Recovery" }
];
const accessLevels = ["Not Included", "Limited", "Included"];
const segmentOrder = ["Micro", "Small", "Medium"];
const editionOrder = ["Standard", "Premium"];

export function SubscriptionsPage() {
  const [activeWorkspace, setActiveWorkspace] = useState("catalog");
  const [activeEdition, setActiveEdition] = useState("All");
  const [editorState, setEditorState] = useState<TierEditorState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const catalogQuery = useSuperadminSubscriptionCatalog();
  const catalog = catalogQuery.data;
  const tiers = useMemo(() => {
    const rows = [...(catalog?.tiers ?? [])].sort(compareTiers);
    return activeEdition === "All"
      ? rows
      : rows.filter((tier) => tier.subscriptionEdition === activeEdition);
  }, [activeEdition, catalog?.tiers]);
  const modules = catalog?.modules ?? [];
  const activeTierCount = catalog?.tiers.filter((tier) => tier.isActive).length ?? 0;
  const standardTierCount = catalog?.tiers.filter((tier) => tier.subscriptionEdition === "Standard").length ?? 0;
  const premiumTierCount = catalog?.tiers.filter((tier) => tier.subscriptionEdition === "Premium").length ?? 0;
  const assignedModuleCount = catalog?.tiers.reduce((total, tier) => total + tier.modules.length, 0) ?? 0;

  const saveTierMutation = useMutation({
    mutationFn: (payload: { tierId?: string; request: UpsertSuperadminSubscriptionTierRequest }) =>
      payload.tierId
        ? httpPutJson<SuperadminSubscriptionTier, UpsertSuperadminSubscriptionTierRequest>(
            `/api/superadmin/subscriptions/tiers/${payload.tierId}`,
            payload.request
          )
        : httpPostJson<SuperadminSubscriptionTier, UpsertSuperadminSubscriptionTierRequest>(
            "/api/superadmin/subscriptions/tiers",
            payload.request
          ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["superadmin", "subscriptions", "catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-tiers"] });
      setEditorState(null);
      setMutationError(null);
    },
    onError: (error) => {
      setMutationError(getApiErrorMessage(error, "Unable to save this subscription tier."));
    }
  });

  function openCreateTier() {
    setMutationError(null);
    setEditorState({
      mode: "create",
      form: createTierFormState(null, modules, ((catalog?.tiers.length ?? 0) + 1) * 10)
    });
  }

  function openEditTier(tier: SuperadminSubscriptionTier) {
    setMutationError(null);
    setEditorState({
      mode: "edit",
      tierId: tier.id,
      form: createTierFormState(tier, modules, tier.sortOrder)
    });
  }

  function handleSaveTier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorState) {
      return;
    }

    saveTierMutation.mutate({
      tierId: editorState.tierId,
      request: buildTierRequest(editorState.form, modules)
    });
  }

  return (
    <>
      <RecordWorkspace
        breadcrumbs="SaaS / Subscription Management"
        title="Subscription management"
        description="Control tenant-facing tiers, pricing copy, delivery surfaces, and module access levels from one catalog workspace."
        recordCount={catalog?.tiers.length ?? 0}
        singularLabel="tier"
        pluralLabel="tiers"
        headerBottom={<WorkspaceTopTabs tabs={workspaceTabs} activeTab={activeWorkspace} onChange={setActiveWorkspace} />}
      >
        {activeWorkspace === "catalog" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <WorkspaceTopTabs tabs={editionTabs} activeTab={activeEdition} onChange={setActiveEdition} />
            <WorkspaceMetricGrid className="md:grid-cols-2 xl:grid-cols-4">
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Active catalog" title={`${activeTierCount} active tiers`} />
                <p className="text-sm text-base-content/65">Only active tiers appear in public registration and checkout.</p>
              </WorkspacePanel>
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Standard" title={`${standardTierCount} web plans`} />
                <p className="text-sm text-base-content/65">Standard remains the SMS web-only commercial surface.</p>
              </WorkspacePanel>
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Premium" title={`${premiumTierCount} web + desktop plans`} />
                <p className="text-sm text-base-content/65">Premium extends Standard with MLS desktop modules.</p>
              </WorkspacePanel>
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Assignments" title={`${assignedModuleCount} tier-module links`} />
                <p className="text-sm text-base-content/65">Each link can be marked Limited or Included per tier.</p>
              </WorkspacePanel>
            </WorkspaceMetricGrid>

            <WorkspacePanel className="min-h-0 flex-1">
              <WorkspacePanelHeader
                eyebrow="Catalog table"
                title="Tiers and module coverage"
                actions={(
                  <button type="button" className="btn btn-primary btn-sm rounded-full" onClick={openCreateTier}>
                    Add tier
                  </button>
                )}
              />

              <RecordTableShell>
                <RecordTable>
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Segment</th>
                      <th>Edition</th>
                      <th>Delivery</th>
                      <th>Price</th>
                      <th>Modules</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogQuery.isLoading ? (
                      <RecordTableStateRow colSpan={8}>Loading subscription catalog...</RecordTableStateRow>
                    ) : null}

                    {catalogQuery.isError ? (
                      <RecordTableStateRow colSpan={8} tone="error">
                        Unable to load subscription catalog.
                      </RecordTableStateRow>
                    ) : null}

                    {!catalogQuery.isLoading && !catalogQuery.isError && !tiers.length ? (
                      <RecordTableStateRow colSpan={8}>No subscription tiers found for this filter.</RecordTableStateRow>
                    ) : null}

                    {tiers.map((tier) => {
                      const includedCount = tier.modules.filter((module) => module.accessLevel === "Included").length;
                      const limitedCount = tier.modules.filter((module) => module.accessLevel === "Limited").length;
                      return (
                        <tr key={tier.id}>
                          <td>
                            <div className="grid gap-1">
                              <strong>{tier.displayName}</strong>
                              <span className="text-xs text-base-content/55">{tier.code}</span>
                            </div>
                          </td>
                          <td>{tier.businessSizeSegment}</td>
                          <td>{tier.subscriptionEdition}</td>
                          <td>{formatDelivery(tier)}</td>
                          <td>{tier.priceDisplay}</td>
                          <td>{includedCount} full / {limitedCount} limited</td>
                          <td>{tier.isActive ? "Active" : "Inactive"}</td>
                          <td>
                            <RecordTableActionButton onClick={() => openEditTier(tier)}>
                              Edit
                            </RecordTableActionButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </RecordTable>
              </RecordTableShell>
            </WorkspacePanel>
          </div>
        ) : (
          <SuperadminSubscriptionRecoveryTab />
        )}
      </RecordWorkspace>

      {editorState ? (
        <TierEditorModal
          editorState={editorState}
          modules={modules}
          errorMessage={mutationError}
          isSaving={saveTierMutation.isPending}
          onChange={setEditorState}
          onClose={() => setEditorState(null)}
          onSubmit={handleSaveTier}
        />
      ) : null}
    </>
  );
}

function TierEditorModal({
  editorState,
  modules,
  errorMessage,
  isSaving,
  onChange,
  onClose,
  onSubmit
}: {
  editorState: TierEditorState;
  modules: SuperadminCatalogModule[];
  errorMessage: string | null;
  isSaving: boolean;
  onChange: (state: TierEditorState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const form = editorState.form;

  function updateField<TKey extends keyof TierFormState>(key: TKey, value: TierFormState[TKey]) {
    onChange({
      ...editorState,
      form: {
        ...form,
        [key]: value
      }
    });
  }

  function updateModuleAccess(moduleId: string, accessLevel: string) {
    onChange({
      ...editorState,
      form: {
        ...form,
        moduleAccess: {
          ...form.moduleAccess,
          [moduleId]: accessLevel
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[92] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <form
        className="flex max-h-[min(92vh,54rem)] w-full max-w-[70rem] flex-col overflow-hidden rounded-[1.6rem] border border-base-300/70 bg-base-100 text-base-content shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-base-300/70 px-5 py-5">
          <div>
            <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60">
              {editorState.mode === "create" ? "Create tier" : "Edit tier"}
            </p>
            <h2 className="mt-1 text-[1.8rem] tracking-[-0.04em]">
              {form.displayName || "Subscription tier"}
            </h2>
          </div>

          <button type="button" className="btn btn-circle btn-sm btn-ghost" onClick={onClose} aria-label="Close tier editor">
            x
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Tier profile" title="Commercial setup" />
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TierField label="Code">
                    <input className="input input-bordered w-full" value={form.code} onChange={(event) => updateField("code", normalizeCodeInput(event.target.value))} disabled={isSaving} />
                  </TierField>
                  <TierField label="Display name">
                    <input className="input input-bordered w-full" value={form.displayName} onChange={(event) => updateField("displayName", event.target.value)} disabled={isSaving} />
                  </TierField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TierField label="Business segment">
                    <select className="select select-bordered w-full" value={form.businessSizeSegment} onChange={(event) => updateField("businessSizeSegment", event.target.value)} disabled={isSaving}>
                      {segmentOrder.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
                    </select>
                  </TierField>
                  <TierField label="Edition">
                    <select className="select select-bordered w-full" value={form.subscriptionEdition} onChange={(event) => updateField("subscriptionEdition", event.target.value)} disabled={isSaving}>
                      {editionOrder.map((edition) => <option key={edition} value={edition}>{edition}</option>)}
                    </select>
                  </TierField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TierField label="Monthly price amount">
                    <input className="input input-bordered w-full" type="number" min="0" step="0.01" value={form.monthlyPriceAmount} onChange={(event) => updateField("monthlyPriceAmount", event.target.value)} placeholder="2490" disabled={isSaving} />
                  </TierField>
                  <TierField label="Currency code">
                    <input className="input input-bordered w-full uppercase" maxLength={3} value={form.currencyCode} onChange={(event) => updateField("currencyCode", event.target.value.toUpperCase())} placeholder="PHP" disabled={isSaving} />
                  </TierField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <WorkspaceDetailItem label="Generated display" value={formatPriceDisplay(Number.parseFloat(form.monthlyPriceAmount) || 0, form.currencyCode)} />
                  <TierField label="Billing label">
                    <input className="input input-bordered w-full" value={form.billingLabel} onChange={(event) => updateField("billingLabel", event.target.value)} placeholder="per tenant / month" disabled={isSaving} />
                  </TierField>
                </div>

                <TierField label="Audience summary">
                  <textarea className="textarea textarea-bordered min-h-24 w-full" value={form.audienceSummary} onChange={(event) => updateField("audienceSummary", event.target.value)} disabled={isSaving} />
                </TierField>
                <TierField label="Description">
                  <textarea className="textarea textarea-bordered min-h-24 w-full" value={form.description} onChange={(event) => updateField("description", event.target.value)} disabled={isSaving} />
                </TierField>

                <div className="grid gap-4 md:grid-cols-2">
                  <TierField label="Plan summary">
                    <input className="input input-bordered w-full" value={form.planSummary} onChange={(event) => updateField("planSummary", event.target.value)} disabled={isSaving} />
                  </TierField>
                  <TierField label="Highlight label">
                    <input className="input input-bordered w-full" value={form.highlightLabel} onChange={(event) => updateField("highlightLabel", event.target.value)} disabled={isSaving} />
                  </TierField>
                </div>

                <WorkspaceDetailGrid>
                  <WorkspaceDetailItem
                    label="Web SMS"
                    value={(
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="checkbox checkbox-primary" checked={form.includesServiceManagementWeb} onChange={(event) => updateField("includesServiceManagementWeb", event.target.checked)} disabled={isSaving} />
                        <span>Included in tier</span>
                      </label>
                    )}
                  />
                  <WorkspaceDetailItem
                    label="Desktop MLS"
                    value={(
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="checkbox checkbox-primary" checked={form.includesMicroLendingDesktop} onChange={(event) => updateField("includesMicroLendingDesktop", event.target.checked)} disabled={isSaving} />
                        <span>Included in tier</span>
                      </label>
                    )}
                  />
                  <WorkspaceDetailItem
                    label="Tier status"
                    value={(
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="checkbox checkbox-primary" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} disabled={isSaving} />
                        <span>Active for registration</span>
                      </label>
                    )}
                  />
                  <WorkspaceDetailItem
                    label="Sort order"
                    value={<input className="input input-bordered input-sm w-full" value={form.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} disabled={isSaving} />}
                  />
                </WorkspaceDetailGrid>
              </div>
            </WorkspacePanel>

            <WorkspacePanel className="min-h-0">
              <WorkspacePanelHeader eyebrow="Module entitlement" title="Set module access by tier" />
              <WorkspaceSubtableShell className="min-h-0 flex-1 !overflow-y-auto">
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Channel</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => (
                      <tr key={module.id}>
                        <td>
                          <div className="grid gap-1">
                            <strong>{module.name}</strong>
                            <span className="text-xs text-base-content/55">{module.code}</span>
                          </div>
                        </td>
                        <td>{module.channel}</td>
                        <td>
                          <select
                            className="select select-bordered select-sm w-full min-w-36"
                            value={form.moduleAccess[module.id] ?? "Not Included"}
                            onChange={(event) => updateModuleAccess(module.id, event.target.value)}
                            disabled={isSaving || !module.isActive}
                          >
                            {accessLevels.map((accessLevel) => (
                              <option key={accessLevel} value={accessLevel}>{accessLevel}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
              <p className="text-sm text-base-content/65">
                Limited unlocks the base module but blocks full-only actions such as advanced role matrices, custom pricing settings, dispatch handovers, evidence management, ledger drilldown, and exports. Not Included removes it from subscription entitlement checks.
              </p>
            </WorkspacePanel>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-base-300/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-error">{errorMessage}</div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn rounded-full" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary rounded-full" disabled={isSaving}>
              {isSaving ? "Saving tier..." : "Save tier"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function TierField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[0.78rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{label}</span>
      {children}
    </label>
  );
}

function createTierFormState(
  tier: SuperadminSubscriptionTier | null,
  modules: SuperadminCatalogModule[],
  sortOrder: number
): TierFormState {
  const moduleAccess = Object.fromEntries(
    modules.map((module) => [
      module.id,
      tier?.modules.find((assignment) => assignment.platformModuleId === module.id)?.accessLevel ?? "Not Included"
    ])
  );

  return {
    code: tier?.code ?? "",
    displayName: tier?.displayName ?? "",
    businessSizeSegment: tier?.businessSizeSegment ?? "Micro",
    subscriptionEdition: tier?.subscriptionEdition ?? "Standard",
    audienceSummary: tier?.audienceSummary ?? "",
    description: tier?.description ?? "",
    monthlyPriceAmount: tier ? String(tier.monthlyPriceAmount) : "",
    currencyCode: tier?.currencyCode ?? "PHP",
    billingLabel: tier?.billingLabel ?? "per tenant / month",
    planSummary: tier?.planSummary ?? "",
    highlightLabel: tier?.highlightLabel ?? "",
    sortOrder: String(sortOrder),
    includesServiceManagementWeb: tier?.includesServiceManagementWeb ?? true,
    includesMicroLendingDesktop: tier?.includesMicroLendingDesktop ?? false,
    isActive: tier?.isActive ?? true,
    moduleAccess
  };
}

function buildTierRequest(
  form: TierFormState,
  modules: SuperadminCatalogModule[]
): UpsertSuperadminSubscriptionTierRequest {
  return {
    code: form.code,
    displayName: form.displayName,
    businessSizeSegment: form.businessSizeSegment,
    subscriptionEdition: form.subscriptionEdition,
    audienceSummary: form.audienceSummary,
    description: form.description,
    monthlyPriceAmount: Number.parseFloat(form.monthlyPriceAmount) || 0,
    currencyCode: form.currencyCode.trim().toUpperCase(),
    billingLabel: form.billingLabel,
    planSummary: form.planSummary,
    highlightLabel: form.highlightLabel,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    includesServiceManagementWeb: form.includesServiceManagementWeb,
    includesMicroLendingDesktop: form.includesMicroLendingDesktop,
    isActive: form.isActive,
    modules: modules.map((module) => ({
      platformModuleId: module.id,
      accessLevel: form.moduleAccess[module.id] ?? "Not Included",
      sortOrder: module.sortOrder
    }))
  };
}

function compareTiers(left: SuperadminSubscriptionTier, right: SuperadminSubscriptionTier) {
  const sortDelta = left.sortOrder - right.sortOrder;
  if (sortDelta !== 0) {
    return sortDelta;
  }

  const segmentDelta = segmentOrder.indexOf(left.businessSizeSegment) - segmentOrder.indexOf(right.businessSizeSegment);
  if (segmentDelta !== 0) {
    return segmentDelta;
  }

  const editionDelta = editionOrder.indexOf(left.subscriptionEdition) - editionOrder.indexOf(right.subscriptionEdition);
  if (editionDelta !== 0) {
    return editionDelta;
  }

  return left.displayName.localeCompare(right.displayName);
}

function formatDelivery(tier: SuperadminSubscriptionTier) {
  return [
    tier.includesServiceManagementWeb ? "SMS Web" : null,
    tier.includesMicroLendingDesktop ? "MLS Desktop" : null
  ].filter(Boolean).join(" + ") || "None";
}

function formatPriceDisplay(amount: number, currencyCode: string) {
  const normalizedCurrency = currencyCode.trim().toUpperCase() || "PHP";
  return `Starts at ${normalizedCurrency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function normalizeCodeInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}
