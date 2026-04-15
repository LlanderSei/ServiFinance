import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CreateUserRequest } from "../types";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

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
  const toast = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>({ fullName: "", email: "", password: "", roleId: "" });

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
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-users"] });
      setForm((current) => ({ ...current, fullName: "", email: "", password: "" }));
      setIsCreateModalOpen(false);
      toast.success({
        title: "Staff account created",
        message: "The tenant operator account is now active in the SMS workspace."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create staff account",
        message: mutationError.message
      });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      httpPostJson<void, { isActive: boolean }>(`/api/tenants/${tenantDomainSlug}/sms/users/${userId}/toggle`, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-users"] });
      toast.success({
        title: "Staff account updated",
        message: "The account status was updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update staff account",
        message: mutationError.message
      });
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
      <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Staff Accounts`}
          title="Staff accounts"
          description="Create tenant operators, assign roles, and disable or reactivate staff access from the same service management workspace."
          recordCount={usersQuery.data?.length ?? 0}
          singularLabel="user"
        >
          <RecordContentStack>
            <RecordTableShell>
              <RecordTable>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.isLoading ? (
                    <RecordTableStateRow colSpan={6}>Loading staff accounts...</RecordTableStateRow>
                  ) : null}

                  {usersQuery.isError ? (
                    <RecordTableStateRow colSpan={6} tone="error">
                        Unable to load tenant staff accounts.
                    </RecordTableStateRow>
                  ) : null}

                  {!usersQuery.isLoading && !usersQuery.isError && !usersQuery.data?.length ? (
                    <RecordTableStateRow colSpan={6}>No staff accounts found for this tenant.</RecordTableStateRow>
                  ) : null}

                  {usersQuery.data?.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.roles.join(", ")}</td>
                      <td>
                        <WorkspaceStatusPill tone={user.isActive ? "active" : "inactive"}>
                          {user.isActive ? "Active" : "Disabled"}
                        </WorkspaceStatusPill>
                      </td>
                      <td>{new Date(user.createdAtUtc).toLocaleDateString("en-PH")}</td>
                      <td>
                        <RecordTableActionButton
                          onClick={() => toggleMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </RecordTableActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </RecordTable>
            </RecordTableShell>

            <WorkspaceFabDock
              actions={[
                {
                  key: "refresh-users",
                  label: "Refresh staff accounts",
                  icon: "refresh",
                  onClick: () => {
                    void usersQuery.refetch();
                    void rolesQuery.refetch();
                  }
                },
                {
                  key: "add-user",
                  label: "Create staff account",
                  icon: "users",
                  onClick: () => setIsCreateModalOpen(true),
                  disabled: rolesQuery.isLoading || !rolesQuery.data?.length
                }
              ]}
            />
          </RecordContentStack>
        </RecordWorkspace>

        <RecordFormModal
          open={isCreateModalOpen}
          eyebrow="Provisioning"
          title="Create staff account"
          description="Provision a tenant operator, assign their initial role, and issue a temporary password from the SMS workspace."
          actions={
            <>
              <WorkspaceModalButton onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-user-form"
                tone="primary"
                disabled={createMutation.isPending || rolesQuery.isLoading || !rolesQuery.data?.length}
              >
                {createMutation.isPending ? "Creating..." : "Create staff account"}
              </WorkspaceModalButton>
            </>
          }
          onClose={() => setIsCreateModalOpen(false)}
        >
          <WorkspaceForm id="tenant-user-form" onSubmit={handleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Full name">
                <WorkspaceInput
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Email">
                <WorkspaceInput
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Temporary password">
                <WorkspaceInput
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Role">
                <WorkspaceSelect
                  value={form.roleId}
                  onChange={(event) => setForm({ ...form, roleId: event.target.value })}
                >
                  <option value="">Select role</option>
                  {rolesQuery.data?.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>
      </>
    </ProtectedRoute>
  );
}
