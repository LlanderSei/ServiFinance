import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { PasswordPolicyChecklist } from "@/shared/auth/PasswordPolicyChecklist";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
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
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

export type PlatformUsersEntrySurface = "sms" | "mls";

type UserListItem = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAtUtc: string;
  roles: string[];
  platformScopes: string[];
};

type AvailableRole = {
  id: string;
  name: string;
  platformScope: string;
};

type CreatePlatformUserRequest = {
  fullName: string;
  email: string;
  password: string;
  roleIds: string[];
};

type UpdatePlatformUserRequest = {
  fullName: string;
  roleIds: string[];
};

type UserFormState = {
  fullName: string;
  email: string;
  password: string;
  ownerAdminRoleId: string;
  smsRoleId: string;
  mlsRoleId: string;
};

type AccessCategory = "owner-admin" | "sms" | "mls" | "both" | "other";

type ModalMode = "create" | "edit";

const emptyForm: UserFormState = {
  fullName: "",
  email: "",
  password: "",
  ownerAdminRoleId: "",
  smsRoleId: "",
  mlsRoleId: ""
};

export function PlatformUsersPage({ entrySurface }: { entrySurface: PlatformUsersEntrySurface }) {
  const { tenantDomainSlug: routeTenantDomainSlug = "" } = useParams();
  const currentSession = getCurrentSession();
  const { data: refreshedSession } = useRefreshSession(!currentSession);
  const currentUser = (currentSession ?? refreshedSession)?.user ?? null;
  const managePermissionKey = entrySurface === "mls" ? "mls.users.manage" : "sms.users.manage";
  const canManageUsers = hasPermission(currentUser, managePermissionKey);
  const tenantDomainSlug = entrySurface === "mls"
    ? (currentSession ?? refreshedSession)?.user.tenantDomainSlug ?? ""
    : routeTenantDomainSlug;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);

  const usersQueryKey = ["tenant", tenantDomainSlug, "platform-users"];
  const rolesQueryKey = ["tenant", tenantDomainSlug, "platform-roles"];
  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: () => httpGet<UserListItem[]>(`/api/tenants/${tenantDomainSlug}/platform/users`),
    enabled: Boolean(tenantDomainSlug)
  });
  const rolesQuery = useQuery({
    queryKey: rolesQueryKey,
    queryFn: () => httpGet<AvailableRole[]>(`/api/tenants/${tenantDomainSlug}/platform/roles`),
    enabled: Boolean(tenantDomainSlug)
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlatformUserRequest) =>
      httpPostJson<UserListItem, CreatePlatformUserRequest>(`/api/tenants/${tenantDomainSlug}/platform/users`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      closeModal();
      toast.success({
        title: "Platform user created",
        message: "The account is now available for its assigned platform scope."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create platform user",
        message: mutationError.message
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdatePlatformUserRequest }) =>
      httpPutJson<UserListItem, UpdatePlatformUserRequest>(`/api/tenants/${tenantDomainSlug}/platform/users/${userId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      closeModal();
      toast.success({
        title: "Platform user updated",
        message: "The account scope and role assignment were updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update platform user",
        message: mutationError.message
      });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      httpPostJson<void, { isActive: boolean }>(`/api/tenants/${tenantDomainSlug}/platform/users/${userId}/toggle`, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
      toast.success({
        title: "Platform user status updated",
        message: "The account status was updated successfully."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update platform user",
        message: mutationError.message
      });
    }
  });

  const roles = rolesQuery.data ?? [];
  const ownerAdminRoles = roles.filter(role => role.platformScope === "OwnerAdmin");
  const smsRoles = roles.filter(role => role.platformScope === "SMS");
  const mlsRoles = roles.filter(role => role.platformScope === "MLS");
  const sortedUsers = (usersQuery.data ?? [])
      .slice()
      .sort((left, right) => compareUsers(left, right, entrySurface));
  const hasSelectableRoles = ownerAdminRoles.length > 0 || smsRoles.length > 0 || mlsRoles.length > 0;
  const roleIds = buildRoleIds(form);
  const isSubmitDisabled = createMutation.isPending ||
      updateMutation.isPending ||
      rolesQuery.isLoading ||
      !hasSelectableRoles ||
      roleIds.length === 0;

  function openCreateModal() {
    if (!canManageUsers) {
      toast.warning({
        title: "Permission required",
        message: "Your role cannot create tenant platform users."
      });
      return;
    }

    setEditingUser(null);
    setForm(emptyForm);
    setModalMode("create");
  }

  function openEditModal(user: UserListItem) {
    if (!canManageUsers) {
      toast.warning({
        title: "Permission required",
        message: "Your role cannot update tenant platform users."
      });
      return;
    }

    setEditingUser(user);
    setForm(createFormForUser(user, roles));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingUser(null);
    setForm(emptyForm);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageUsers) {
      toast.warning({
        title: "Permission required",
        message: "Your role cannot manage tenant platform users."
      });
      return;
    }

    const selectedRoleIds = buildRoleIds(form);
    if (selectedRoleIds.length === 0) {
      toast.error({
        title: "Select a role",
        message: "Assign one SMS role, one MLS role, both platform roles, or one Owner/Admin role."
      });
      return;
    }

    if (modalMode === "edit" && editingUser) {
      updateMutation.mutate({
        userId: editingUser.id,
        payload: {
          fullName: form.fullName,
          roleIds: selectedRoleIds
        }
      });
      return;
    }

    createMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      roleIds: selectedRoleIds
    });
  }

  const modalTitle = modalMode === "edit" ? "Update platform user" : "Create platform user";
  const modalDescription = modalMode === "edit"
    ? "Adjust the user name and platform role scope. Owner/Admin access stands alone; SMS and MLS can be combined."
    : "Provision a tenant user with one SMS role, one MLS role, both platform roles, or one Owner/Admin role.";
  const primaryActionLabel = modalMode === "edit"
    ? updateMutation.isPending ? "Updating..." : "Update platform user"
    : createMutation.isPending ? "Creating..." : "Create platform user";

  return (
    <>
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug || "tenant"} / ${entrySurface.toUpperCase()} / Administration`}
        title="Platform users"
        description="Manage tenant accounts across SMS and MLS from the same list. The list is ordered for the workspace you entered from."
        recordCount={sortedUsers.length}
        singularLabel="user"
      >
        <RecordContentStack>
          <RecordTableShell>
            <RecordTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Platform</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading ? (
                  <RecordTableStateRow colSpan={7}>Loading platform users...</RecordTableStateRow>
                ) : null}

                {usersQuery.isError ? (
                  <RecordTableStateRow colSpan={7} tone="error">
                    Unable to load platform users.
                  </RecordTableStateRow>
                ) : null}

                {!usersQuery.isLoading && !usersQuery.isError && sortedUsers.length === 0 ? (
                  <RecordTableStateRow colSpan={7}>No platform users found for this tenant.</RecordTableStateRow>
                ) : null}

                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>
                      <AccessPill category={getAccessCategory(user.platformScopes.length ? user.platformScopes : user.roles)} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full border border-base-300/70 bg-base-200/60 px-2.5 py-1 text-xs font-semibold text-base-content/70"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <WorkspaceStatusPill tone={user.isActive ? "active" : "inactive"}>
                        {user.isActive ? "Active" : "Disabled"}
                      </WorkspaceStatusPill>
                    </td>
                    <td>{new Date(user.createdAtUtc).toLocaleDateString("en-PH")}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <RecordTableActionButton
                          onClick={() => openEditModal(user)}
                          disabled={!canManageUsers || rolesQuery.isLoading || !hasSelectableRoles}
                        >
                          Edit
                        </RecordTableActionButton>
                        <RecordTableActionButton
                          onClick={() => toggleMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                          disabled={!canManageUsers || toggleMutation.isPending}
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </RecordTableActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </RecordTable>
          </RecordTableShell>

          <WorkspaceFabDock
            actions={[
              {
                key: "refresh-platform-users",
                label: "Refresh platform users",
                icon: "refresh",
                onClick: () => {
                  void usersQuery.refetch();
                  void rolesQuery.refetch();
                }
              },
              {
                key: "add-platform-user",
                label: "Create platform user",
                icon: "users",
                onClick: openCreateModal,
                disabled: !canManageUsers || rolesQuery.isLoading || !hasSelectableRoles
              }
            ]}
          />
        </RecordContentStack>
      </RecordWorkspace>

      <RecordFormModal
        open={modalMode !== null}
        eyebrow="Platform access"
        title={modalTitle}
        description={modalDescription}
        actions={
          <>
            <WorkspaceModalButton onClick={closeModal}>
              Cancel
            </WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="platform-user-form"
              tone="primary"
              disabled={!canManageUsers || isSubmitDisabled}
            >
              {primaryActionLabel}
            </WorkspaceModalButton>
          </>
        }
        onClose={closeModal}
      >
        <WorkspaceForm id="platform-user-form" onSubmit={handleSubmit}>
          <WorkspaceNotice>
            Select Owner/Admin by itself, or assign one SMS role, one MLS role, or both SMS and MLS roles.
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

            <WorkspaceField label="Owner/Admin role">
              <WorkspaceSelect
                value={form.ownerAdminRoleId}
                onChange={(event) => {
                  const nextRoleId = event.target.value;
                  setForm({
                    ...form,
                    ownerAdminRoleId: nextRoleId,
                    smsRoleId: nextRoleId ? "" : form.smsRoleId,
                    mlsRoleId: nextRoleId ? "" : form.mlsRoleId
                  });
                }}
              >
                <option value="">No Owner/Admin access</option>
                {ownerAdminRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>

            <WorkspaceField label="SMS role">
              <WorkspaceSelect
                value={form.smsRoleId}
                onChange={(event) => setForm({ ...form, ownerAdminRoleId: "", smsRoleId: event.target.value })}
                disabled={Boolean(form.ownerAdminRoleId)}
              >
                <option value="">No SMS access</option>
                {smsRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>

            <WorkspaceField label="MLS role">
              <WorkspaceSelect
                value={form.mlsRoleId}
                onChange={(event) => setForm({ ...form, ownerAdminRoleId: "", mlsRoleId: event.target.value })}
                disabled={Boolean(form.ownerAdminRoleId)}
              >
                <option value="">No MLS access</option>
                {mlsRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>
          </WorkspaceFieldGrid>
          {modalMode === "create" ? (
            <PasswordPolicyChecklist
              password={form.password}
              email={form.email}
              fullName={form.fullName}
              tenantDomainSlug={tenantDomainSlug}
            />
          ) : null}
        </WorkspaceForm>
      </RecordFormModal>
    </>
  );
}

function createFormForUser(user: UserListItem, roles: AvailableRole[]): UserFormState {
  return {
    ...emptyForm,
    fullName: user.fullName,
    email: user.email,
    ownerAdminRoleId: findAssignedRoleId(user.roles, roles, "OwnerAdmin"),
    smsRoleId: findAssignedRoleId(user.roles, roles, "SMS"),
    mlsRoleId: findAssignedRoleId(user.roles, roles, "MLS")
  };
}

function findAssignedRoleId(userRoles: string[], availableRoles: AvailableRole[], platformScope: string) {
  return availableRoles.find(role =>
    role.platformScope === platformScope &&
    userRoles.some(userRole => userRole.toLowerCase() === role.name.toLowerCase())
  )?.id ?? "";
}

function buildRoleIds(form: UserFormState) {
  if (form.ownerAdminRoleId) {
    return [form.ownerAdminRoleId];
  }

  return [form.smsRoleId, form.mlsRoleId].filter(Boolean);
}

function compareUsers(left: UserListItem, right: UserListItem, entrySurface: PlatformUsersEntrySurface) {
  const leftCategory = getAccessCategory(left.roles);
  const rightCategory = getAccessCategory(right.roles);
  const categoryDelta = getCategoryWeight(leftCategory, entrySurface) - getCategoryWeight(rightCategory, entrySurface);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  return left.fullName.localeCompare(right.fullName);
}

function getCategoryWeight(category: AccessCategory, entrySurface: PlatformUsersEntrySurface) {
  const order: AccessCategory[] = entrySurface === "mls"
    ? ["owner-admin", "mls", "both", "sms", "other"]
    : ["owner-admin", "sms", "both", "mls", "other"];

  return order.indexOf(category);
}

function getAccessCategory(roles: string[]): AccessCategory {
  const isOwnerAdmin = roles.some(role => isOwnerAdminRole(role));
  if (isOwnerAdmin) {
    return "owner-admin";
  }

  const hasSms = roles.some(role => isSmsRole(role));
  const hasMls = roles.some(role => isMlsRole(role));
  if (hasSms && hasMls) {
    return "both";
  }

  if (hasSms) {
    return "sms";
  }

  return hasMls ? "mls" : "other";
}

function isOwnerAdminRole(role: string) {
  return role.toLowerCase() === "administrator" ||
    role.toLowerCase() === "owner" ||
    role.toLowerCase() === "owneradmin";
}

function isSmsRole(role: string) {
  return role.toLowerCase() === "staff" ||
    role.toLowerCase() === "sms" ||
    role.toLowerCase().startsWith("sms ");
}

function isMlsRole(role: string) {
  return role.toLowerCase() === "mls" ||
    role.toLowerCase().startsWith("mls ");
}

function AccessPill({ category }: { category: AccessCategory }) {
  switch (category) {
    case "owner-admin":
      return <WorkspaceStatusPill tone="warning">Owner/Admin</WorkspaceStatusPill>;
    case "sms":
      return <WorkspaceStatusPill tone="active">SMS</WorkspaceStatusPill>;
    case "mls":
      return <WorkspaceStatusPill tone="progress">MLS</WorkspaceStatusPill>;
    case "both":
      return <WorkspaceStatusPill tone="warning">SMS + MLS</WorkspaceStatusPill>;
    default:
      return <WorkspaceStatusPill tone="inactive">Scope required</WorkspaceStatusPill>;
  }
}
