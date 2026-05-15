import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SuperadminTenantRow } from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import {
  MobileRecordCardLayout,
  MobileRecordField,
  MobileRecordFieldGrid
} from "@/shared/records/MobileRecordDetails";
import {
  WorkspaceActionButton,
  WorkspaceFilter,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";

const tenantDateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function buildTenantPath(filters: { segment: string; edition: string; status: string }) {
  const searchParams = new URLSearchParams();
  if (filters.segment) {
    searchParams.set("segment", filters.segment);
  }
  if (filters.edition) {
    searchParams.set("edition", filters.edition);
  }
  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const query = searchParams.toString();
  return query ? `/api/superadmin/tenants?${query}` : "/api/superadmin/tenants";
}

export function TenantsPage() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentSession()?.user ?? null;
  const canManageTenants = hasPermission(currentUser, "root.tenants.manage");
  const [selectedTenant, setSelectedTenant] = useState<SuperadminTenantRow | null>(null);
  const [filters, setFilters] = useState({
    segment: "",
    edition: "",
    status: ""
  });
  const query = useQuery({
    queryKey: ["superadmin", "tenants", filters],
    queryFn: () => httpGet<SuperadminTenantRow[]>(buildTenantPath(filters))
  });
  const tenantStatusMutation = useMutation({
    mutationFn: ({ tenantId, isActive }: { tenantId: string; isActive: boolean }) =>
      httpPostJson<SuperadminTenantRow, { isActive: boolean }>(`/api/superadmin/tenants/${tenantId}/status`, { isActive }),
    onSuccess: (tenant) => {
      setSelectedTenant(tenant);
      void queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["superadmin", "overview"] });
    }
  });
  const rows = query.data ?? [];
  const tenantDetails = useMemo(() => {
    if (!selectedTenant) {
      return [];
    }

    return [
      {
        title: "Tenant identity",
        items: [
          { label: "Tenant name", value: selectedTenant.name },
          { label: "Code", value: selectedTenant.code },
          { label: "Domain slug", value: `/${selectedTenant.domainSlug}` },
          { label: "Provisioned", value: tenantDateFormatter.format(new Date(selectedTenant.createdAtUtc)) }
        ]
      },
      {
        title: "Commercial access",
        items: [
          { label: "Business segment", value: selectedTenant.businessSizeSegment },
          { label: "Edition", value: selectedTenant.subscriptionEdition },
          { label: "Plan code", value: selectedTenant.subscriptionPlan },
          { label: "Subscription status", value: selectedTenant.subscriptionStatus }
        ]
      },
      {
        title: "Operations",
        items: [
          { label: "Lifecycle", value: selectedTenant.isActive ? "Active" : "Suspended" },
          { label: "Tenant route", value: `/t/${selectedTenant.domainSlug}/sms` }
        ]
      }
    ];
  }, [selectedTenant]);

  return (
    <>
      <RecordWorkspace
        breadcrumbs="SaaS / Tenants"
        title="Subscribed tenants"
        description="Filter tenant accounts by business segment, edition, and operating state, then inspect or suspend individual workspaces from one root-domain surface."
        recordCount={rows.length}
        singularLabel="tenant"
      >
        <RecordContentStack>
          <TenantFilterBar
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters({ segment: "", edition: "", status: "" })}
          />

          <RecordTableShell>
            <RecordTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Domain slug</th>
                  <th>Segment</th>
                  <th>Edition</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <RecordTableStateRow colSpan={8}>Loading tenant records...</RecordTableStateRow>
                ) : null}

                {query.isError ? (
                  <RecordTableStateRow colSpan={8} tone="error">
                    Unable to load tenant records.
                  </RecordTableStateRow>
                ) : null}

                {!query.isLoading && !query.isError && !rows.length ? (
                  <RecordTableStateRow colSpan={8}>
                    No tenant records found for the current filters.
                  </RecordTableStateRow>
                ) : null}

                {rows.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <MobileRecordCardLayout
                        upperColumns={2}
                        upper={(
                          <>
                            <strong className="min-w-0 text-sm text-base-content">{tenant.name}</strong>
                            <span className="justify-self-end">
                              <WorkspaceStatusPill tone={tenant.isActive ? "active" : "inactive"}>
                                {tenant.subscriptionStatus}
                              </WorkspaceStatusPill>
                            </span>
                          </>
                        )}
                        middleColumns={2}
                        middle={(
                          <>
                            <MobileRecordFieldGrid>
                              <MobileRecordField label="Code" value={tenant.code} />
                              <MobileRecordField label="Domain Slug" value={`/${tenant.domainSlug}`} />
                              <MobileRecordField label="Segment" value={tenant.businessSizeSegment} />
                            </MobileRecordFieldGrid>
                            <MobileRecordFieldGrid>
                              <MobileRecordField label="Edition" value={tenant.subscriptionEdition} />
                              <MobileRecordField label="Plan" value={tenant.subscriptionPlan} />
                            </MobileRecordFieldGrid>
                          </>
                        )}
                      />
                      <span className="hidden lg:inline">{tenant.name}</span>
                    </td>
                    <td className="max-lg:hidden">{tenant.code}</td>
                    <td className="max-lg:hidden">/{tenant.domainSlug}</td>
                    <td className="max-lg:hidden">{tenant.businessSizeSegment}</td>
                    <td className="max-lg:hidden">{tenant.subscriptionEdition}</td>
                    <td className="max-lg:hidden">{tenant.subscriptionPlan}</td>
                    <td className="max-lg:hidden">
                      <WorkspaceStatusPill tone={tenant.isActive ? "active" : "inactive"}>
                        {tenant.subscriptionStatus}
                      </WorkspaceStatusPill>
                    </td>
                    <td>
                      <RecordTableActionButton className="w-full justify-center" onClick={() => setSelectedTenant(tenant)}>
                        View
                      </RecordTableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </RecordTable>
          </RecordTableShell>
        </RecordContentStack>
      </RecordWorkspace>

      <RecordDetailsModal
        open={selectedTenant !== null}
        eyebrow="Tenant details"
        title={selectedTenant?.name ?? ""}
        sections={tenantDetails}
        actions={selectedTenant ? (
          <>
            <WorkspaceModalButton onClick={() => setSelectedTenant(null)}>
              Close
            </WorkspaceModalButton>
            <WorkspaceModalButton
              tone={selectedTenant.isActive ? "danger" : "primary"}
              disabled={tenantStatusMutation.isPending || !canManageTenants}
              title={!canManageTenants ? "Requires root.tenants.manage." : undefined}
              onClick={() => {
                if (!canManageTenants) {
                  return;
                }

                void tenantStatusMutation.mutateAsync({
                  tenantId: selectedTenant.id,
                  isActive: !selectedTenant.isActive
                });
              }}
            >
              {tenantStatusMutation.isPending
                ? "Updating..."
                  : selectedTenant.isActive
                    ? "Suspend tenant"
                    : "Reactivate tenant"}
            </WorkspaceModalButton>
          </>
        ) : null}
        onClose={() => setSelectedTenant(null)}
      />
    </>
  );
}

function TenantFilterBar({
  filters,
  onChange,
  onClear
}: {
  filters: { segment: string; edition: string; status: string };
  onChange: (filters: { segment: string; edition: string; status: string }) => void;
  onClear: () => void;
}) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  return (
    <>
      <section className="rounded-box border border-base-300/65 bg-base-100 px-3 py-3 shadow-sm lg:px-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 lg:flex lg:items-end lg:overflow-hidden">
          <div className="min-w-0 self-center lg:hidden">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Filters</p>
            <h2 className="text-sm font-bold text-base-content">Tenant account filters</h2>
          </div>

          <WorkspaceActionButton className="shrink-0 lg:hidden" onClick={() => setIsMobileFiltersOpen(true)}>
            Options
          </WorkspaceActionButton>

          <WorkspaceActionButton className="shrink-0" onClick={onClear}>
            Reset filters
          </WorkspaceActionButton>

          <div className="hidden min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-1 lg:block">
            <div className="flex w-max items-end gap-3 pr-10">
              <TenantFilterFields filters={filters} onChange={onChange} />
            </div>
          </div>
        </div>
      </section>

      {isMobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tenant filter options"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <section
            className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-base-300/70 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Filters</p>
                <h2 className="mt-1 text-lg font-bold text-base-content">Tenant options</h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-sm border-base-300/70 bg-base-100 shadow-none"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close tenant filters"
              >
                x
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="grid gap-4">
                <TenantFilterFields filters={filters} onChange={onChange} />
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-base-300/70 bg-base-200/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <WorkspaceActionButton onClick={onClear}>
                Reset filters
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => setIsMobileFiltersOpen(false)}>
                Apply
              </WorkspaceActionButton>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TenantFilterFields({
  filters,
  onChange
}: {
  filters: { segment: string; edition: string; status: string };
  onChange: (filters: { segment: string; edition: string; status: string }) => void;
}) {
  return (
    <>
      <WorkspaceFilter label="Segment">
        <WorkspaceSelect
          value={filters.segment}
          onChange={(event) => onChange({ ...filters, segment: event.target.value })}
        >
          <option value="">All segments</option>
          <option value="Micro">Micro</option>
          <option value="Small">Small</option>
          <option value="Medium">Medium</option>
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Edition">
        <WorkspaceSelect
          value={filters.edition}
          onChange={(event) => onChange({ ...filters, edition: event.target.value })}
        >
          <option value="">All editions</option>
          <option value="Standard">Standard</option>
          <option value="Premium">Premium</option>
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Status">
        <WorkspaceSelect
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </WorkspaceSelect>
      </WorkspaceFilter>
    </>
  );
}
