import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type {
  CurrentSessionUser,
  ServiceCostPreset,
  TenantPricingWorkspaceResponse,
  UpdateTenantCostingPolicyRequest,
  UpsertServiceCostPresetRequest
} from "@/shared/api/contracts";
import { httpDelete, httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
import { SmsModuleCodes, hasFullModuleAccess, hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import { useToast } from "@/shared/toast/ToastProvider";

type PolicyFormState = {
  taxLabel: string;
  defaultTaxRate: string;
  taxEnabledByDefault: boolean;
};

type PresetFormState = {
  category: string;
  name: string;
  defaultSpecification: string;
  defaultQuantity: string;
  defaultUnitPrice: string;
  isActive: boolean;
  sortOrder: string;
};

type ActionReadiness = {
  allowed: boolean;
  reason: string | null;
};

const initialPolicyForm: PolicyFormState = {
  taxLabel: "VAT",
  defaultTaxRate: "12",
  taxEnabledByDefault: true
};

const initialPresetForm: PresetFormState = {
  category: "Base Charge",
  name: "",
  defaultSpecification: "",
  defaultQuantity: "1",
  defaultUnitPrice: "0",
  isActive: true,
  sortOrder: "0"
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
});

export function SmsPricingPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const pricingManageReadiness = getPricingManageReadiness(currentUser);
  const canManagePricing = pricingManageReadiness.allowed;
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(initialPolicyForm);
  const [presetForm, setPresetForm] = useState<PresetFormState>(initialPresetForm);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  const pricingQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-pricing"],
    queryFn: () => httpGet<TenantPricingWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/sms/pricing`)
  });

  useEffect(() => {
    if (!pricingQuery.data) {
      return;
    }

    setPolicyForm({
      taxLabel: pricingQuery.data.policy.taxLabel,
      defaultTaxRate: String(pricingQuery.data.policy.defaultTaxRate),
      taxEnabledByDefault: pricingQuery.data.policy.taxEnabledByDefault
    });
  }, [pricingQuery.data]);

  const savePolicyMutation = useMutation({
    mutationFn: (payload: UpdateTenantCostingPolicyRequest) =>
      httpPutJson(`/api/tenants/${tenantDomainSlug}/sms/pricing/policy`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-pricing"] });
      toast.success({
        title: "Costing policy updated",
        message: "Tax defaults now apply to new draft cost sheets inside tenant SMS."
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to save costing policy",
        message: error.message
      });
    }
  });

  const savePresetMutation = useMutation({
    mutationFn: (payload: UpsertServiceCostPresetRequest) => {
      if (editingPresetId) {
        return httpPutJson<ServiceCostPreset, UpsertServiceCostPresetRequest>(
          `/api/tenants/${tenantDomainSlug}/sms/pricing/presets/${editingPresetId}`,
          payload
        );
      }

      return httpPostJson<ServiceCostPreset, UpsertServiceCostPresetRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/pricing/presets`,
        payload
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-pricing"] });
      setIsPresetModalOpen(false);
      setEditingPresetId(null);
      setPresetForm(initialPresetForm);
      toast.success({
        title: editingPresetId ? "Preset updated" : "Preset added",
        message: "The costing catalog is ready for service-request draft totals."
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to save preset",
        message: error.message
      });
    }
  });

  const deletePresetMutation = useMutation({
    mutationFn: (presetId: string) =>
      httpDelete(`/api/tenants/${tenantDomainSlug}/sms/pricing/presets/${presetId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-pricing"] });
      toast.success({
        title: "Preset removed",
        message: "Existing cost sheets keep their copied lines, but the preset is no longer offered."
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to remove preset",
        message: error.message
      });
    }
  });

  const presets = pricingQuery.data?.presets ?? [];
  const categories = pricingQuery.data?.categories ?? [];
  const activePresetCount = presets.filter((preset) => preset.isActive).length;
  const baseChargeCount = presets.filter((preset) => preset.category === "Base Charge").length;
  const serviceCount = presets.filter((preset) => preset.category === "Service").length;
  const partsCount = presets.filter((preset) => preset.category === "Part Replacement").length;

  const groupedPresetSummary = useMemo(() => {
    return categories.map((category) => ({
      category,
      count: presets.filter((preset) => preset.category === category).length
    }));
  }, [categories, presets]);

  function handlePolicySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManagePricing) {
      toast.warning({
        title: "Permission required",
        message: pricingManageReadiness.reason ?? "Your role cannot change tenant pricing policy."
      });
      return;
    }

    savePolicyMutation.mutate({
      taxLabel: policyForm.taxLabel,
      defaultTaxRate: Number(policyForm.defaultTaxRate),
      taxEnabledByDefault: policyForm.taxEnabledByDefault
    });
  }

  function openCreatePresetModal() {
    if (!canManagePricing) {
      toast.warning({
        title: "Permission required",
        message: pricingManageReadiness.reason ?? "Your role cannot create pricing presets."
      });
      return;
    }

    setEditingPresetId(null);
    setPresetForm({
      ...initialPresetForm,
      category: categories[0] ?? initialPresetForm.category
    });
    setIsPresetModalOpen(true);
  }

  function openEditPresetModal(preset: ServiceCostPreset) {
    if (!canManagePricing) {
      toast.warning({
        title: "Permission required",
        message: pricingManageReadiness.reason ?? "Your role cannot edit pricing presets."
      });
      return;
    }

    setEditingPresetId(preset.id);
    setPresetForm({
      category: preset.category,
      name: preset.name,
      defaultSpecification: preset.defaultSpecification ?? "",
      defaultQuantity: String(preset.defaultQuantity),
      defaultUnitPrice: String(preset.defaultUnitPrice),
      isActive: preset.isActive,
      sortOrder: String(preset.sortOrder)
    });
    setIsPresetModalOpen(true);
  }

  function handlePresetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManagePricing) {
      toast.warning({
        title: "Permission required",
        message: pricingManageReadiness.reason ?? "Your role cannot save pricing presets."
      });
      return;
    }

    savePresetMutation.mutate({
      category: presetForm.category,
      name: presetForm.name,
      defaultSpecification: presetForm.defaultSpecification || null,
      defaultQuantity: Number(presetForm.defaultQuantity),
      defaultUnitPrice: Number(presetForm.defaultUnitPrice),
      isActive: presetForm.isActive,
      sortOrder: Number(presetForm.sortOrder)
    });
  }

  return (
    <>
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / SMS / Pricing`}
        title="Pricing and costing"
        description="Manage reusable commercial defaults for labor, services, parts, and tax behavior before those values flow into live tenant service cost sheets."
        recordCount={presets.length}
        singularLabel="pricing preset"
      >
        {pricingQuery.isError ? (
          <WorkspaceNotice tone="error" className="m-4 mb-0">
            Unable to load the pricing workspace right now.
          </WorkspaceNotice>
        ) : null}

        <RecordScrollRegion>
          <WorkspaceScrollStack className="p-0">
            <WorkspaceKpiRailLayout
              kpis={(
                <>
                  <MetricCard
                    label="Active presets"
                    value={activePresetCount}
                    description="Reusable defaults currently offered to service-request costing."
                  />
                  <MetricCard
                    label="Base charges"
                    value={baseChargeCount}
                    description="Labor, diagnostics, and other default base fees."
                  />
                  <MetricCard
                    label="Service presets"
                    value={serviceCount}
                    description="Cleaning, assembly, configuration, and similar repeatable work."
                  />
                  <MetricCard
                    label="Part presets"
                    value={partsCount}
                    description="Reusable replacement templates for common hardware or materials."
                  />
                </>
              )}
            >
              <WorkspacePanel>
                <WorkspacePanelHeader
                  eyebrow="Tenant policy"
                  title="Tax defaults and costing behavior"
                  actions={pricingQuery.data ? (
                    <WorkspaceStatusPill tone={pricingQuery.data.policy.taxEnabledByDefault ? "progress" : "neutral"}>
                      {pricingQuery.data.policy.taxEnabledByDefault ? "Tax enabled by default" : "Tax disabled by default"}
                    </WorkspaceStatusPill>
                  ) : null}
                />

                <WorkspaceForm onSubmit={handlePolicySubmit}>
                  <WorkspaceFieldGrid>
                    <WorkspaceField label="Tax label">
                      <WorkspaceInput
                        value={policyForm.taxLabel}
                        onChange={(event) => setPolicyForm((current) => ({ ...current, taxLabel: event.target.value }))}
                        placeholder="VAT"
                      />
                    </WorkspaceField>

                    <WorkspaceField label="Default tax rate (%)">
                      <WorkspaceInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={policyForm.defaultTaxRate}
                        onChange={(event) => setPolicyForm((current) => ({ ...current, defaultTaxRate: event.target.value }))}
                      />
                    </WorkspaceField>

                    <WorkspaceField label="Default tax toggle" wide>
                      <label className="flex items-center gap-3 rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm border-base-300"
                          checked={policyForm.taxEnabledByDefault}
                          onChange={(event) => setPolicyForm((current) => ({ ...current, taxEnabledByDefault: event.target.checked }))}
                        />
                        New draft cost sheets start with tax {policyForm.taxEnabledByDefault ? "enabled" : "disabled"}.
                      </label>
                    </WorkspaceField>
                  </WorkspaceFieldGrid>

                  <WorkspaceActionButton
                    type="submit"
                    className="w-full justify-center sm:w-max"
                    disabled={!canManagePricing || savePolicyMutation.isPending}
                    title={pricingManageReadiness.reason ?? undefined}
                  >
                    {savePolicyMutation.isPending ? "Saving policy..." : "Save costing policy"}
                  </WorkspaceActionButton>
                </WorkspaceForm>
              </WorkspacePanel>

              <WorkspacePanel>
                <WorkspacePanelHeader
                  eyebrow="Preset catalog"
                  title="Reusable line items"
                  actions={(
                    <WorkspaceStatusPill tone="neutral">
                      {presets.length} presets
                    </WorkspaceStatusPill>
                  )}
                />

                {groupedPresetSummary.length ? (
                  <div className="flex flex-wrap gap-2">
                    {groupedPresetSummary.map((entry) => (
                      <WorkspaceStatusPill key={entry.category} tone={entry.count > 0 ? "progress" : "neutral"}>
                        {entry.category}: {entry.count}
                      </WorkspaceStatusPill>
                    ))}
                  </div>
                ) : null}

                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Name</th>
                        <th>Default spec</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>State</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingQuery.isLoading ? (
                        <RecordTableStateRow colSpan={7}>Loading pricing presets...</RecordTableStateRow>
                      ) : null}

                      {!pricingQuery.isLoading && !presets.length ? (
                        <RecordTableStateRow colSpan={7}>
                          No pricing presets yet. Add base charges or repeatable service lines first.
                        </RecordTableStateRow>
                      ) : null}

                      {presets.map((preset) => (
                        <tr key={preset.id}>
                          <td>{preset.category}</td>
                          <td>{preset.name}</td>
                          <td>{preset.defaultSpecification ?? "-"}</td>
                          <td>{preset.defaultQuantity}</td>
                          <td>{formatCurrency(preset.defaultUnitPrice)}</td>
                          <td>
                            <WorkspaceStatusPill tone={preset.isActive ? "active" : "inactive"}>
                              {preset.isActive ? "Active" : "Inactive"}
                            </WorkspaceStatusPill>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <WorkspaceActionButton
                                onClick={() => openEditPresetModal(preset)}
                                disabled={!canManagePricing}
                                title={pricingManageReadiness.reason ?? undefined}
                              >
                                Edit
                              </WorkspaceActionButton>
                              <WorkspaceActionButton
                                onClick={() => deletePresetMutation.mutate(preset.id)}
                                disabled={!canManagePricing || deletePresetMutation.isPending}
                                title={pricingManageReadiness.reason ?? undefined}
                              >
                                Delete
                              </WorkspaceActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>

                {!pricingQuery.isLoading && !presets.length ? (
                  <WorkspaceEmptyState>
                    Seed this tenant with default labor, services, fees, or part templates so technicians do not start every draft breakdown from scratch.
                  </WorkspaceEmptyState>
                ) : null}
              </WorkspacePanel>
            </WorkspaceKpiRailLayout>
          </WorkspaceScrollStack>
        </RecordScrollRegion>

        <WorkspaceFabDock
          actions={[
            {
              key: "refresh-pricing",
              label: "Refresh pricing",
              icon: "refresh",
              onClick: () => {
                void pricingQuery.refetch();
              }
            },
            {
              key: "add-pricing-preset",
              label: "Add pricing preset",
              icon: "plus",
              onClick: openCreatePresetModal,
              disabled: !canManagePricing,
              disabledReason: pricingManageReadiness.reason ?? undefined
            }
          ]}
        />
      </RecordWorkspace>

      <RecordFormModal
        open={isPresetModalOpen}
        eyebrow="Cost preset"
        title={editingPresetId ? "Edit pricing preset" : "Add pricing preset"}
        description="Reusable preset lines speed up technician costing without hard-locking the live service breakdown."
        actions={(
          <>
            <WorkspaceModalButton onClick={() => setIsPresetModalOpen(false)}>
              Cancel
            </WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="sms-pricing-preset-form"
              tone="primary"
              disabled={!canManagePricing || savePresetMutation.isPending}
              title={pricingManageReadiness.reason ?? undefined}
            >
              {savePresetMutation.isPending ? "Saving..." : editingPresetId ? "Save preset" : "Add preset"}
            </WorkspaceModalButton>
          </>
        )}
        onClose={() => setIsPresetModalOpen(false)}
      >
        <WorkspaceForm id="sms-pricing-preset-form" onSubmit={handlePresetSubmit}>
          <WorkspaceFieldGrid>
            <WorkspaceField label="Category">
              <WorkspaceSelect
                value={presetForm.category}
                onChange={(event) => setPresetForm((current) => ({ ...current, category: event.target.value }))}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>

            <WorkspaceField label="Name">
              <WorkspaceInput
                value={presetForm.name}
                onChange={(event) => setPresetForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </WorkspaceField>

            <WorkspaceField label="Default specification">
              <WorkspaceInput
                value={presetForm.defaultSpecification}
                onChange={(event) => setPresetForm((current) => ({ ...current, defaultSpecification: event.target.value }))}
                placeholder="Battery pack, 15-inch panel, deep cleaning scope"
              />
            </WorkspaceField>

            <WorkspaceField label="Sort order">
              <WorkspaceInput
                type="number"
                min="0"
                step="1"
                value={presetForm.sortOrder}
                onChange={(event) => setPresetForm((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </WorkspaceField>

            <WorkspaceField label="Default quantity">
              <WorkspaceInput
                type="number"
                min="0.01"
                step="0.01"
                value={presetForm.defaultQuantity}
                onChange={(event) => setPresetForm((current) => ({ ...current, defaultQuantity: event.target.value }))}
                required
              />
            </WorkspaceField>

            <WorkspaceField label="Default unit price">
              <WorkspaceInput
                type="number"
                min="0"
                step="0.01"
                value={presetForm.defaultUnitPrice}
                onChange={(event) => setPresetForm((current) => ({ ...current, defaultUnitPrice: event.target.value }))}
                required
              />
            </WorkspaceField>

            <WorkspaceField label="Availability" wide>
              <label className="flex items-center gap-3 rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm border-base-300"
                  checked={presetForm.isActive}
                  onChange={(event) => setPresetForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Offer this preset inside live service-request cost sheets.
              </label>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </WorkspaceForm>
      </RecordFormModal>
    </>
  );
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getPricingManageReadiness(user: CurrentSessionUser | null): ActionReadiness {
  if (!hasPermission(user, "sms.pricing.manage")) {
    return {
      allowed: false,
      reason: "Requires sms.pricing.manage permission."
    };
  }

  if (!hasFullModuleAccess(user, SmsModuleCodes.invoicing)) {
    return {
      allowed: false,
      reason: "Requires full Invoicing module access for tenant pricing settings."
    };
  }

  return { allowed: true, reason: null };
}
