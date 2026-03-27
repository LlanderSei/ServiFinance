import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CreateUserRequest } from "./types";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

type UserListItem = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAtUtc: string;
  roles: string[];
};

type AvailableRole = {
  id: string;
  name: string;
};

export function SmsUsersPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserRequest>({ fullName: "", email: "", password: "", roleId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-users"],
    queryFn: () => httpGet<UserListItem[]>(`/api/tenants/${tenantDomainSlug}/sms/users`)
  });
  const rolesQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-roles"],
    queryFn: () => httpGet<AvailableRole[]>(`/api/tenants/${tenantDomainSlug}/sms/roles`)
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserRequest) =>
      httpPostJson<UserListItem, CreateUserRequest>(`/api/tenants/${tenantDomainSlug}/sms/users`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-users"] });
      setForm((current) => ({ ...current, fullName: "", email: "", password: "" }));
      setMessage("User created.");
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      httpPostJson<void, { isActive: boolean }>(`/api/tenants/${tenantDomainSlug}/sms/users/${userId}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-users"] });
      setMessage("User state updated.");
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  useEffect(() => {
    if (!form.roleId && rolesQuery.data?.[0]) {
      setForm((current) => ({ ...current, roleId: rolesQuery.data[0].id }));
    }
  }, [form.roleId, rolesQuery.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(form);
  }

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug} requireRole="Administrator">
      <main className="page authed-page">
        <div className="section-heading">
          <p className="eyebrow">{tenantDomainSlug} / SMS / Users</p>
          <h1>Tenant user management</h1>
          <p className="lede">Create tenant users, disable accounts, and manage roles for this tenant domain.</p>
        </div>

        {message && <div className="status-note">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        <div className="register-shell">
          <section className="register-form">
            <h2>Create user</h2>
            <form className="login-form" onSubmit={handleSubmit}>
              <label><span>Full name</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
              <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
              <label><span>Temporary password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
              <label>
                <span>Role</span>
                <select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
                  <option value="">Select role</option>
                  {rolesQuery.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <button type="submit" className="button button--primary">Create user</button>
            </form>
          </section>

          <section className="table-card">
            <h2>Current users</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{user.roles.join(", ")}</td>
                    <td>{user.isActive ? "Active" : "Disabled"}</td>
                    <td>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => toggleMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
