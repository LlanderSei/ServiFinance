import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { PasswordPolicyChecklist } from "@/shared/auth/PasswordPolicyChecklist";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
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
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

type RootUserRow = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAtUtc: string;
  roles: string[];
  platformScopes: string[];
};

type RootUserFormState = {
  fullName: string;
  email: string;
  password: string;
};

type CreateRootUserRequest = {
  fullName: string;
  email: string;
  password: string;
  roleIds: string[];
};

type UpdateRootUserRequest = {
  fullName: string;
  roleIds: string[];
};

type ModalMode = "create" | "edit";

const emptyForm: RootUserFormState = {
  fullName: "",
  email: "",
  password: ""
};

export function RootUsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const currentUser = currentSession?.user ?? null;
  const currentUserId = currentUser?.userId ?? "";
  const canManageRootUsers = hasPermission(currentUser, "root.users.manage");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingUser, setEditingUser] = useState<RootUserRow | null>(null);
  const [form, setForm] = useState<RootUserFormState>(emptyForm);
  const usersQueryKey = ["superadmin", "root-users"];

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: () => httpGet<RootUserRow[]>("/api/superadmin/root/users")
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRootUserRequest) =>
      httpPostJson<RootUserRow, CreateRootUserRequest>("/api/superadmin/root/users", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      closeModal();
      toast.success({
        title: "Root user created",
        message: "The account can now access the Superadmin control plane."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create root user",
        message: mutationError.message
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateRootUserRequest }) =>
      httpPutJson<RootUserRow, UpdateRootUserRequest>(`/api/superadmin/root/users/${userId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      closeModal();
      toast.success({
        title: "Root user updated",
        message: "The root user profile was updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update root user",
        message: mutationError.message
      });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      httpPostJson<void, { isActive: boolean }>(`/api/superadmin/root/users/${userId}/toggle`, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      toast.success({
        title: "Root user status updated",
        message: "The account status was updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update root user",
        message: mutationError.message
      });
    }
  });

  const rows = (usersQuery.data ?? [])
      .slice()
      .sort((left, right) => {
        const statusDelta = Number(right.isActive) - Number(left.isActive);
        return statusDelta !== 0
          ? statusDelta
          : left.fullName.localeCompare(right.fullName);
      });

  function openCreateModal() {
    if (!canManageRootUsers) {
      toast.warning({
        title: "Permission required",
        message: "Creating root users requires root.users.manage."
      });
      return;
    }

    setEditingUser(null);
    setForm(emptyForm);
    setModalMode("create");
  }

  function openEditModal(user: RootUserRow) {
    if (!canManageRootUsers) {
      toast.warning({
        title: "Permission required",
        message: "Updating root users requires root.users.manage."
      });
      return;
    }

    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: ""
    });
    setModalMode("edit");
  }

  function closeModal() {
    setEditingUser(null);
    setForm(emptyForm);
    setModalMode(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageRootUsers) {
      toast.warning({
        title: "Permission required",
        message: "Managing root users requires root.users.manage."
      });
      return;
    }

    if (modalMode === "edit" && editingUser) {
      updateMutation.mutate({
        userId: editingUser.id,
        payload: {
          fullName: form.fullName,
          roleIds: []
        }
      });
      return;
    }

    createMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      roleIds: []
    });
  }

  const modalTitle = modalMode === "edit" ? "Update root user" : "Create root user";
  const modalDescription = modalMode === "edit"
    ? "Update the root user profile. Root access is checked through root-scoped permissions."
    : "Create a Superadmin account for root-domain platform administration.";
  const primaryActionLabel = modalMode === "edit"
    ? updateMutation.isPending ? "Updating..." : "Update root user"
    : createMutation.isPending ? "Creating..." : "Create root user";
  const isSubmitDisabled = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <RecordWorkspace
        breadcrumbs="SaaS / Administration"
        title="Root users"
        description="Manage Superadmin accounts that can access the root-domain control plane, tenant operations, catalog setup, and platform audits."
        recordCount={rows.length}
        singularLabel="user"
      >
        <RecordContentStack>
          <RecordTableShell>
            <RecordTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading ? (
                  <RecordTableStateRow colSpan={6}>Loading root users...</RecordTableStateRow>
                ) : null}

                {usersQuery.isError ? (
                  <RecordTableStateRow colSpan={6} tone="error">
                    Unable to load root users.
                  </RecordTableStateRow>
                ) : null}

                {!usersQuery.isLoading && !usersQuery.isError && rows.length === 0 ? (
                  <RecordTableStateRow colSpan={6}>No root users found.</RecordTableStateRow>
                ) : null}

                {rows.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  return (
                    <tr key={user.id}>
                      <td>
                        <MobileRecordCardLayout
                          upper={(
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <strong className="block text-sm text-base-content">{user.fullName}</strong>
                                <MobileRecordFieldGrid>
                                  <MobileRecordField label="Email" value={user.email} />
                                  <MobileRecordField label="Created" value={new Date(user.createdAtUtc).toLocaleDateString("en-PH")} />
                                </MobileRecordFieldGrid>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <WorkspaceStatusPill tone={user.isActive ? "active" : "inactive"}>
                                  {user.isActive ? "Active" : "Disabled"}
                                </WorkspaceStatusPill>
                                <WorkspaceStatusPill tone="warning">
                                  {user.roles.length > 0 ? user.roles.join(" / ") : "Unscoped"}
                                </WorkspaceStatusPill>
                              </div>
                            </div>
                          )}
                        />
                        <span className="hidden lg:inline">{user.fullName}</span>
                      </td>
                      <td className="max-lg:hidden">{user.email}</td>
                      <td className="max-lg:hidden">
                        <WorkspaceStatusPill tone="warning">
                          {user.roles.length > 0 ? user.roles.join(" / ") : "Unscoped"}
                        </WorkspaceStatusPill>
                      </td>
                      <td className="max-lg:hidden">
                        <WorkspaceStatusPill tone={user.isActive ? "active" : "inactive"}>
                          {user.isActive ? "Active" : "Disabled"}
                        </WorkspaceStatusPill>
                      </td>
                      <td className="max-lg:hidden">{new Date(user.createdAtUtc).toLocaleDateString("en-PH")}</td>
                      <td>
                        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:flex-wrap">
                          <RecordTableActionButton
                            onClick={() => openEditModal(user)}
                            disabled={!canManageRootUsers}
                            title={!canManageRootUsers ? "Requires root.users.manage." : undefined}
                          >
                            Edit
                          </RecordTableActionButton>
                          <RecordTableActionButton
                            onClick={() => {
                              if (!canManageRootUsers) {
                                toast.warning({
                                  title: "Permission required",
                                  message: "Updating root users requires root.users.manage."
                                });
                                return;
                              }

                              toggleMutation.mutate({ userId: user.id, isActive: !user.isActive });
                            }}
                            disabled={toggleMutation.isPending || isCurrentUser || !canManageRootUsers}
                            title={!canManageRootUsers ? "Requires root.users.manage." : isCurrentUser ? "Current root session cannot disable itself from this screen." : undefined}
                          >
                            {user.isActive ? "Disable" : "Enable"}
                          </RecordTableActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </RecordTable>
          </RecordTableShell>

          <WorkspaceFabDock
            actions={[
              {
                key: "refresh-root-users",
                label: "Refresh root users",
                icon: "refresh",
                onClick: () => {
                  void usersQuery.refetch();
                }
              },
              {
                key: "add-root-user",
                label: "Create root user",
                icon: "users",
                onClick: openCreateModal,
                disabled: !canManageRootUsers
              }
            ]}
          />
        </RecordContentStack>
      </RecordWorkspace>

      <RecordFormModal
        open={modalMode !== null}
        eyebrow="Root access"
        title={modalTitle}
        description={modalDescription}
        actions={
          <>
            <WorkspaceModalButton onClick={closeModal}>
              Cancel
            </WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="root-user-form"
              tone="primary"
              disabled={isSubmitDisabled || !canManageRootUsers}
            >
              {primaryActionLabel}
            </WorkspaceModalButton>
          </>
        }
        onClose={closeModal}
      >
        <WorkspaceForm id="root-user-form" onSubmit={handleSubmit}>
          <WorkspaceNotice>
            Root users stay on the root surface. Tenant SMS/MLS platform roles stay managed from each tenant workspace.
          </WorkspaceNotice>

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
                disabled={modalMode === "edit"}
                required
              />
            </WorkspaceField>

            {modalMode === "create" ? (
              <WorkspaceField label="Temporary password">
                <WorkspaceInput
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
          {modalMode === "create" ? (
            <PasswordPolicyChecklist
              password={form.password}
              email={form.email}
              fullName={form.fullName}
            />
          ) : null}
        </WorkspaceForm>
      </RecordFormModal>
    </>
  );
}
