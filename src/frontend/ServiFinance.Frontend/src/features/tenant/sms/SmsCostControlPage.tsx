import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { TenantSmsCostControlResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { SmsModuleCodes, hasFullModuleAccess } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceInlineNote, WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDistributionRow,
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceTenantCell
} from "@/shared/records/WorkspacePanel";

export function SmsCostControlPage() {
  const { tenantDomainSlug = "" } = useParams();
  const currentUser = getCurrentSession()?.user ?? null;
  const hasFullCostControl = hasFullModuleAccess(currentUser, SmsModuleCodes.partsCostControl);
  const costQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-cost-control"],
    queryFn: () => httpGet<TenantSmsCostControlResponse>(`/api/tenants/${tenantDomainSlug}/sms/cost-control`)
  });

  const summary = costQuery.data?.summary;
  const categoryTotals = costQuery.data?.categoryTotals ?? [];
  const presetCategories = costQuery.data?.presetCategories ?? [];
  const rows = costQuery.data?.rows ?? [];
  const categoryGrandTotal = categoryTotals.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / SMS / Cost Control`}
      title="Parts and cost control"
      description="Review transparent service-cost exposure, preset coverage, invoice readiness, and pricing governance for medium tenant operations."
      recordCount={summary?.needsCosting ?? 0}
      singularLabel="costing gap"
    >
      <RecordContentStack>
        {costQuery.isError ? (
          <WorkspaceNotice tone="error">Unable to load service cost control right now.</WorkspaceNotice>
        ) : null}

        {!hasFullCostControl ? (
          <WorkspaceNotice>
            Medium Standard has limited cost-control access. Full preset governance and advanced approval workflows stay reserved for Medium Premium.
          </WorkspaceNotice>
        ) : null}

        <WorkspaceKpiRailLayout
          kpis={
            <>
              <MetricCard label="Estimated exposure" value={formatCurrency(summary?.estimatedCostTotal ?? 0)} description="Current tracked cost-sheet total across visible service work." />
              <MetricCard label="Needs costing" value={summary?.needsCosting ?? 0} description="Completed service work without a cost sheet yet." />
              <MetricCard label="Needs invoice" value={summary?.needsInvoice ?? 0} description="Completed service work that has not produced an invoice yet." />
              <MetricCard label="Draft sheets" value={summary?.draftCostSheets ?? 0} description="Cost sheets still editable before finance handoff." />
              <MetricCard label="Active presets" value={summary?.activePresetCount ?? 0} description="Reusable cost presets available to technicians and admins." />
            </>
          }
        >
          <div className="grid min-h-0 flex-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_24rem]">
            <WorkspacePanel className="min-h-0">
              <WorkspacePanelHeader
                eyebrow="Costing worklist"
                title="Requests with cost or invoice attention"
                actions={<WorkspaceStatusPill tone={summary?.needsCosting || summary?.needsInvoice ? "warning" : "active"}>{summary?.needsCosting || summary?.needsInvoice ? "Review needed" : "Controlled"}</WorkspaceStatusPill>}
              />

              <RecordTableShell>
                <RecordTable>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Cost sheet</th>
                      <th>Total</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costQuery.isLoading ? (
                      <RecordTableStateRow colSpan={4}>Loading cost-control worklist...</RecordTableStateRow>
                    ) : rows.length === 0 ? (
                      <RecordTableStateRow colSpan={4}>No cost-control worklist items right now.</RecordTableStateRow>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <WorkspaceTenantCell
                              title={row.requestNumber}
                              subtitle={`${row.customerName} / ${row.itemType}`}
                            />
                            <WorkspaceInlineNote>{row.currentStatus}</WorkspaceInlineNote>
                          </td>
                          <td>
                            <div className="grid gap-1">
                              <WorkspaceStatusPill tone={resolveCostSheetTone(row.costSheetStatus, row.needsCosting)}>
                                {row.costSheetStatus ?? (row.needsCosting ? "Missing" : "Not needed")}
                              </WorkspaceStatusPill>
                              <span className="text-xs text-base-content/60">{row.costLineCount} line items</span>
                            </div>
                          </td>
                          <td>{formatCurrency(row.costTotal)}</td>
                          <td>
                            <div className="grid gap-1">
                              <span>{row.invoiceNumber ?? "No invoice"}</span>
                              <span className="text-xs text-base-content/60">{row.invoiceStatus ?? (row.needsInvoice ? "Needs invoice" : "-")}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </RecordTable>
              </RecordTableShell>
            </WorkspacePanel>

            <div className="grid min-h-0 gap-4">
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Cost categories" title="Where service costs accumulate" />
                {categoryTotals.length === 0 ? (
                  <WorkspaceEmptyState>No service cost lines have been added yet.</WorkspaceEmptyState>
                ) : (
                  <div className="grid gap-3">
                    {categoryTotals.map((row) => (
                      <WorkspaceDistributionRow
                        key={row.category}
                        label={`${row.category} / ${row.lineCount} lines`}
                        value={formatCurrency(row.totalAmount)}
                        percentage={categoryGrandTotal === 0 ? 0 : (row.totalAmount / categoryGrandTotal) * 100}
                      />
                    ))}
                  </div>
                )}
              </WorkspacePanel>

              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Preset coverage" title="Reusable pricing library" />
                {presetCategories.length === 0 ? (
                  <WorkspaceEmptyState>No reusable service cost presets have been configured.</WorkspaceEmptyState>
                ) : (
                  <div className="grid gap-3">
                    {presetCategories.map((row) => (
                      <div key={row.category} className="rounded-box border border-base-300/65 bg-base-200/40 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{row.category}</strong>
                          <WorkspaceStatusPill tone={row.activePresets > 0 ? "active" : "neutral"}>{row.activePresets}/{row.presetCount} active</WorkspaceStatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </WorkspacePanel>
            </div>
          </div>
        </WorkspaceKpiRailLayout>
      </RecordContentStack>
    </RecordWorkspace>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

function resolveCostSheetTone(status: string | null, needsCosting: boolean) {
  if (needsCosting) {
    return "inactive";
  }

  if (status === "Draft") {
    return "warning";
  }

  if (status === "Finalized") {
    return "active";
  }

  return "neutral";
}

export default SmsCostControlPage;
