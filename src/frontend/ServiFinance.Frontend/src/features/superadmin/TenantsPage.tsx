import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

type TenantRow = {
  id: string;
  name: string;
  code: string;
  domainSlug: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  isActive: boolean;
};

export function TenantsPage() {
  const query = useQuery({
    queryKey: ["superadmin", "tenants"],
    queryFn: () => httpGet<TenantRow[]>("/api/superadmin/tenants")
  });

  return (
    <ProtectedRoute requireRole="SuperAdmin">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">SaaS / Tenants</p>
          <h1>Subscribed tenants</h1>
          <p className="lede">Current tenant accounts registered in the SaaS platform.</p>
        </div>

        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Domain slug</th>
                <th>Segment</th>
                <th>Edition</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.code}</td>
                  <td>{tenant.domainSlug}</td>
                  <td>{tenant.businessSizeSegment}</td>
                  <td>{tenant.subscriptionEdition}</td>
                  <td>{tenant.subscriptionPlan}</td>
                  <td>{tenant.subscriptionStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!query.data?.length && !query.isLoading && <p>No tenant records found.</p>}
        </div>
      </main>
    </ProtectedRoute>
  );
}
