import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SuperadminTenantRow } from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";

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
    <ProtectedRoute requireRole="SuperAdmin">
      <>
        <RecordWorkspace
          breadcrumbs="SaaS / Tenants"
          title="Subscribed tenants"
          description="Filter tenant accounts by business segment, edition, and operating state, then inspect or suspend individual workspaces from one root-domain surface."
          recordCount={rows.length}
          singularLabel="tenant"
        >
          <div className="record-content-stack">
            <div className="record-toolbar">
              <label className="record-filter">
                <span>Segment</span>
                <select
                  value={filters.segment}
                  onChange={(event) => setFilters((current) => ({ ...current, segment: event.target.value }))}
                >
                  <option value="">All segments</option>
                  <option value="Micro">Micro</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                </select>
              </label>

              <label className="record-filter">
                <span>Edition</span>
                <select
                  value={filters.edition}
                  onChange={(event) => setFilters((current) => ({ ...current, edition: event.target.value }))}
                >
                  <option value="">All editions</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
              </label>

              <label className="record-filter">
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>

              <button
                type="button"
                className="record-action-button"
                onClick={() => setFilters({ segment: "", edition: "", status: "" })}
              >
                Reset filters
              </button>
            </div>

            <div className="record-table-shell">
              <table className="record-table">
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
                    <tr>
                      <td className="record-table__state" colSpan={8}>Loading tenant records...</td>
                    </tr>
                  ) : null}

                  {query.isError ? (
                    <tr>
                      <td className="record-table__state record-table__state--error" colSpan={8}>Unable to load tenant records.</td>
                    </tr>
                  ) : null}

                  {!query.isLoading && !query.isError && !rows.length ? (
                    <tr>
                      <td className="record-table__state" colSpan={8}>No tenant records found for the current filters.</td>
                    </tr>
                  ) : null}

                  {rows.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.code}</td>
                      <td>/{tenant.domainSlug}</td>
                      <td>{tenant.businessSizeSegment}</td>
                      <td>{tenant.subscriptionEdition}</td>
                      <td>{tenant.subscriptionPlan}</td>
                      <td>
                        <span className={`record-status-pill ${tenant.isActive ? "is-active" : "is-inactive"}`}>
                          {tenant.subscriptionStatus}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="record-table__action" onClick={() => setSelectedTenant(tenant)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RecordWorkspace>

        <RecordDetailsModal
          open={selectedTenant !== null}
          eyebrow="Tenant details"
          title={selectedTenant?.name ?? ""}
          sections={tenantDetails}
          actions={selectedTenant ? (
            <>
              <button type="button" className="record-modal__button" onClick={() => setSelectedTenant(null)}>
                Close
              </button>
              <button
                type="button"
                className={`record-modal__button ${selectedTenant.isActive ? "is-danger" : "is-primary"}`}
                disabled={tenantStatusMutation.isPending}
                onClick={() => {
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
              </button>
            </>
          ) : null}
          onClose={() => setSelectedTenant(null)}
        />
      </>
    </ProtectedRoute>
  );
}
