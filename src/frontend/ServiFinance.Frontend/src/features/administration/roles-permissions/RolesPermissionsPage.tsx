import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, type ReactNode, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateRoleRequest,
  RolePermissionRoleRow,
  RolePermissionWorkspaceResponse,
  RoleUsersResponse,
  UpdateRoleRequest,
  UpdateRolePermissionSetRequest
} from "@/shared/api/contracts";
import { httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
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
import {
  RecordTable,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { useToast } from "@/shared/toast/ToastProvider";
import { PermissionCatalogTab } from "./PermissionCatalogTab";
import { RoleCatalogTab } from "./RoleCatalogTab";
import { RolePermissionMatrixTab } from "./RolePermissionMatrixTab";

type RolePermissionScope = "superadmin" | "tenant-sms" | "tenant-mls";

type RolesPermissionsPageProps = {
  scope: RolePermissionScope;
};

type RoleModalMode = "create" | "edit";

type RoleLookup = {
  scope: RolePermissionScope;
  roleId: string;
};

type RoleFormState = {
  name: string;
  description: string;
  platformScope: string;
  rank: string;
};

type RoleWorkspaceTabContentProps = {
  activeTab: string;
  targetScope: RolePermissionScope;
  workspace: RolePermissionWorkspaceResponse;
  isSaving: boolean;
  onEditRole: (targetScope: RolePermissionScope, roleId: string) => void;
  onViewUsers: (targetScope: RolePermissionScope, roleId: string) => void;
  onSave: (targetScope: RolePermissionScope, roleId: string, permissionKeys: string[]) => void;
};

type RoleScopeSectionProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

const tabs = [
  { key: "roles", label: "Roles" },
  { key: "permissions", label: "Permissions" },
  { key: "matrix", label: "Matrix" }
];

export function PlatformRolesPermissionsPage() {
  return <RolesPermissionsPage scope="superadmin" />;
}

export function TenantSmsRolesPermissionsPage() {
  return <RolesPermissionsPage scope="tenant-sms" />;
}

export function TenantMlsRolesPermissionsPage() {
  return <RolesPermissionsPage scope="tenant-mls" />;
}

function RolesPermissionsPage({ scope }: RolesPermissionsPageProps) {
  const { tenantDomainSlug: routeTenantDomainSlug = "" } = useParams();
  const currentSession = getCurrentSession();
  const { data: refreshedSession } = useRefreshSession(!currentSession);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("roles");
  const [showAlternatePlatform, setShowAlternatePlatform] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<RoleModalMode | null>(null);
  const [editingRole, setEditingRole] = useState<RoleLookup | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(() => createEmptyRoleForm(scope));
  const [usersRole, setUsersRole] = useState<RoleLookup | null>(null);
  const resolvedTenantSlug = scope === "tenant-mls"
    ? (currentSession ?? refreshedSession)?.user.tenantDomainSlug ?? ""
    : routeTenantDomainSlug;
  const alternateScope = resolveAlternateScope(scope);
  const endpoints = resolveEndpoints(scope, resolvedTenantSlug);
  const queryKey = ["roles-permissions", scope, resolvedTenantSlug];
  const alternateEndpoints = alternateScope ? resolveEndpoints(alternateScope, resolvedTenantSlug) : null;
  const workspaceQuery = useQuery({
    queryKey,
    queryFn: () => httpGet<RolePermissionWorkspaceResponse>(endpoints.workspace),
    enabled: scope === "superadmin" || Boolean(resolvedTenantSlug)
  });
  const alternateWorkspaceQuery = useQuery({
    queryKey: alternateScope
      ? roleWorkspaceQueryKey(alternateScope, resolvedTenantSlug)
      : ["roles-permissions", "alternate", resolvedTenantSlug],
    queryFn: () => alternateEndpoints
      ? httpGet<RolePermissionWorkspaceResponse>(alternateEndpoints.workspace)
      : Promise.reject(new Error("No alternate role workspace is available.")),
    enabled: Boolean(alternateScope && showAlternatePlatform && resolvedTenantSlug)
  });
  const usersQuery = useQuery({
    queryKey: usersRole
      ? ["roles-permissions", usersRole.scope, resolvedTenantSlug, usersRole.roleId, "users"]
      : ["roles-permissions", "users", "idle", resolvedTenantSlug],
    queryFn: () => usersRole
      ? httpGet<RoleUsersResponse>(resolveEndpoints(usersRole.scope, resolvedTenantSlug).users(usersRole.roleId))
      : Promise.reject(new Error("No role selected.")),
    enabled: Boolean(usersRole)
  });
  const createRoleMutation = useMutation({
    mutationFn: ({ targetScope, payload }: { targetScope: RolePermissionScope; payload: CreateRoleRequest }) =>
      httpPostJson<RolePermissionWorkspaceResponse, CreateRoleRequest>(
        resolveEndpoints(targetScope, resolvedTenantSlug).create,
        payload
      ),
    onSuccess: (response, variables) => {
      updateWorkspaceCache(variables.targetScope, response);
      closeRoleModal();
      toast.success({
        title: "Role added",
        message: "The role is now available in the selected scope."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to add role",
        message: mutationError.message
      });
    }
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({
      targetScope,
      roleId,
      payload
    }: {
      targetScope: RolePermissionScope;
      roleId: string;
      payload: UpdateRoleRequest;
    }) =>
      httpPutJson<RolePermissionWorkspaceResponse, UpdateRoleRequest>(
        resolveEndpoints(targetScope, resolvedTenantSlug).updateRole(roleId),
        payload
      ),
    onSuccess: (response, variables) => {
      const updatedScope = resolveScopeFromPlatformScope(scope, variables.payload.platformScope);
      updateWorkspaceCache(variables.targetScope, response);
      if (updatedScope !== variables.targetScope) {
        void queryClient.invalidateQueries({ queryKey: roleWorkspaceQueryKey(updatedScope, resolvedTenantSlug) });
      }

      closeRoleModal();
      toast.success({
        title: "Role updated",
        message: "The role metadata and scoped permission target were updated."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update role",
        message: mutationError.message
      });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({
      targetScope,
      roleId,
      permissionKeys
    }: {
      targetScope: RolePermissionScope;
      roleId: string;
      permissionKeys: string[];
    }) =>
      httpPutJson<RolePermissionWorkspaceResponse, UpdateRolePermissionSetRequest>(
        resolveEndpoints(targetScope, resolvedTenantSlug).update(roleId),
        { permissionKeys }
      ),
    onSuccess: (response, variables) => {
      updateWorkspaceCache(variables.targetScope, response);
      toast.success({
        title: "Role permissions updated",
        message: "The selected role permission set is now saved for this scope."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to update permissions",
        message: mutationError.message
      });
    }
  });

  const workspace = workspaceQuery.data;
  const alternateWorkspace = alternateWorkspaceQuery.data;
  const editingWorkspace = editingRole
    ? resolveWorkspaceForScope(editingRole.scope, scope, workspace, alternateWorkspace)
    : null;
  const editingRoleRecord = editingWorkspace?.roles.find(role => role.id === editingRole?.roleId) ?? null;
  const roleModalTitle = roleModalMode === "edit" ? "Edit role" : "Add role";
  const roleModalDescription = roleModalMode === "edit"
    ? "Change role identity, rank, and scope. Changing SMS or MLS scope resets the role to target that scope's permission catalog."
    : "Create a mutable role for the selected scope. Add its permissions after creation from the Matrix tab.";
  const isRoleSubmitPending = createRoleMutation.isPending || updateRoleMutation.isPending;
  const canSubmitRole = roleForm.name.trim() &&
    roleForm.description.trim() &&
    roleForm.platformScope &&
    Number.isInteger(Number(roleForm.rank)) &&
    Number(roleForm.rank) > 0 &&
    !isRoleSubmitPending;
  const alternateScopeLabel = alternateScope ? resolvePlatformShortLabel(alternateScope) : "";
  const toggleAlternateLabel = `${showAlternatePlatform ? "Hide" : "Show"} ${alternateScopeLabel} Roles & Permissions`;
  const totalVisibleRoles = (workspace?.roles.length ?? 0) +
    (showAlternatePlatform ? alternateWorkspace?.roles.length ?? 0 : 0);

  function openCreateRoleModal() {
    setEditingRole(null);
    setRoleForm(createEmptyRoleForm(scope));
    setRoleModalMode("create");
  }

  function openEditRoleModal(targetScope: RolePermissionScope, roleId: string) {
    const targetWorkspace = resolveWorkspaceForScope(targetScope, scope, workspace, alternateWorkspace);
    const role = targetWorkspace?.roles.find(item => item.id === roleId);
    if (!role || !role.canEditPermissions) {
      return;
    }

    setEditingRole({ scope: targetScope, roleId: role.id });
    setRoleForm(createRoleForm(role));
    setRoleModalMode("edit");
  }

  function closeRoleModal() {
    setRoleModalMode(null);
    setEditingRole(null);
    setRoleForm(createEmptyRoleForm(scope));
  }

  function updateWorkspaceCache(targetScope: RolePermissionScope, response: RolePermissionWorkspaceResponse) {
    queryClient.setQueryData(roleWorkspaceQueryKey(targetScope, resolvedTenantSlug), response);
  }

  function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      platformScope: roleForm.platformScope,
      rank: Number(roleForm.rank)
    };

    if (roleModalMode === "edit" && editingRole && editingRoleRecord) {
      updateRoleMutation.mutate({
        targetScope: editingRole.scope,
        roleId: editingRoleRecord.id,
        payload
      });
      return;
    }

    createRoleMutation.mutate({
      targetScope: resolveScopeFromPlatformScope(scope, payload.platformScope),
      payload
    });
  }

  return (
    <>
      <RecordWorkspace
        breadcrumbs={resolveBreadcrumbs(scope, resolvedTenantSlug)}
        title="Roles and permissions"
        description="Review scoped roles, rank order, permission catalogs, and editable role-permission sets without enforcing them across the rest of the website yet."
        recordCount={totalVisibleRoles}
        singularLabel="role"
        headerBottom={<WorkspaceTopTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />}
      >
        <RecordContentStack>
          {workspaceQuery.isLoading ? (
            <WorkspaceNotice>Loading roles and permissions...</WorkspaceNotice>
          ) : null}

          {workspaceQuery.isError ? (
            <WorkspaceNotice tone="error">Unable to load roles and permissions for this scope.</WorkspaceNotice>
          ) : null}

          {workspace ? (
            <>
              {showAlternatePlatform && alternateScope ? (
                <RecordScrollRegion>
                  <div className="grid min-h-full gap-4">
                    <RoleScopeSection
                      eyebrow="Primary platform"
                      title={`${workspace.scopeLabel} Roles & Permissions`}
                    >
                      <RoleWorkspaceTabContent
                        activeTab={activeTab}
                        targetScope={scope}
                        workspace={workspace}
                        isSaving={updateMutation.isPending}
                        onEditRole={openEditRoleModal}
                        onViewUsers={(targetScope, roleId) => setUsersRole({ scope: targetScope, roleId })}
                        onSave={(targetScope, roleId, permissionKeys) =>
                          updateMutation.mutate({ targetScope, roleId, permissionKeys })}
                      />
                    </RoleScopeSection>

                    <RoleScopeSection
                      eyebrow="Also visible"
                      title={`${alternateScopeLabel} Roles & Permissions`}
                    >
                      {alternateWorkspaceQuery.isLoading ? (
                        <WorkspaceNotice>Loading {alternateScopeLabel} roles and permissions...</WorkspaceNotice>
                      ) : null}

                      {alternateWorkspaceQuery.isError ? (
                        <WorkspaceNotice tone="error">
                          Unable to load {alternateScopeLabel} roles and permissions.
                        </WorkspaceNotice>
                      ) : null}

                      {alternateWorkspace ? (
                        <RoleWorkspaceTabContent
                          activeTab={activeTab}
                          targetScope={alternateScope}
                          workspace={alternateWorkspace}
                          isSaving={updateMutation.isPending}
                          onEditRole={openEditRoleModal}
                          onViewUsers={(targetScope, roleId) => setUsersRole({ scope: targetScope, roleId })}
                          onSave={(targetScope, roleId, permissionKeys) =>
                            updateMutation.mutate({ targetScope, roleId, permissionKeys })}
                        />
                      ) : null}
                    </RoleScopeSection>
                  </div>
                </RecordScrollRegion>
              ) : (
                <RoleWorkspaceTabContent
                  activeTab={activeTab}
                  targetScope={scope}
                  workspace={workspace}
                  isSaving={updateMutation.isPending}
                  onEditRole={openEditRoleModal}
                  onViewUsers={(targetScope, roleId) => setUsersRole({ scope: targetScope, roleId })}
                  onSave={(targetScope, roleId, permissionKeys) =>
                    updateMutation.mutate({ targetScope, roleId, permissionKeys })}
                />
              )}
            </>
          ) : null}

          <WorkspaceFabDock
            actions={[
              ...(alternateScope ? [{
                key: "toggle-platform",
                label: toggleAlternateLabel,
                icon: "layers" as const,
                onClick: () => setShowAlternatePlatform((current) => !current),
                disabled: !resolvedTenantSlug
              }] : []),
              {
                key: "add-role",
                label: "Add role",
                icon: "plus",
                onClick: openCreateRoleModal,
                disabled: workspaceQuery.isLoading
              }
            ]}
          />
        </RecordContentStack>
      </RecordWorkspace>

      <RecordFormModal
        open={roleModalMode !== null}
        eyebrow="Role metadata"
        title={roleModalTitle}
        description={roleModalDescription}
        actions={(
          <>
            <WorkspaceModalButton onClick={closeRoleModal}>Cancel</WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="role-metadata-form"
              tone="primary"
              disabled={!canSubmitRole}
            >
              {isRoleSubmitPending ? "Saving..." : roleModalMode === "edit" ? "Update role" : "Add role"}
            </WorkspaceModalButton>
          </>
        )}
        onClose={closeRoleModal}
      >
        <WorkspaceForm id="role-metadata-form" onSubmit={handleRoleSubmit}>
          <WorkspaceNotice>
            Rank values must be unique inside this role catalog. Lower numbers are higher authority.
          </WorkspaceNotice>
          <WorkspaceFieldGrid>
            <WorkspaceField label="Role name">
              <WorkspaceInput
                value={roleForm.name}
                onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                required
              />
            </WorkspaceField>
            <WorkspaceField label="Rank">
              <WorkspaceInput
                type="number"
                min={1}
                value={roleForm.rank}
                onChange={(event) => setRoleForm({ ...roleForm, rank: event.target.value })}
                required
              />
            </WorkspaceField>
            <WorkspaceField label="Scope">
              <WorkspaceSelect
                value={roleForm.platformScope}
                onChange={(event) => setRoleForm({ ...roleForm, platformScope: event.target.value })}
              >
                {resolveScopeOptions(scope).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>
            <WorkspaceField label="Description">
              <WorkspaceInput
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                required
              />
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </WorkspaceForm>
      </RecordFormModal>

      <RecordFormModal
        open={Boolean(usersRole)}
        eyebrow="Role assignments"
        title={usersQuery.data?.roleName ?? "Role users"}
        description="Users currently assigned to this role."
        actions={<WorkspaceModalButton onClick={() => setUsersRole(null)}>Close</WorkspaceModalButton>}
        onClose={() => setUsersRole(null)}
      >
        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <RecordTableStateRow colSpan={4}>Loading users...</RecordTableStateRow>
              ) : null}
              {usersQuery.isError ? (
                <RecordTableStateRow colSpan={4} tone="error">Unable to load users for this role.</RecordTableStateRow>
              ) : null}
              {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data?.users.length ?? 0) === 0 ? (
                <RecordTableStateRow colSpan={4}>No users currently have this role.</RecordTableStateRow>
              ) : null}
              {usersQuery.data?.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>
                    <WorkspaceStatusPill tone={user.isActive ? "active" : "inactive"}>
                      {user.isActive ? "Active" : "Disabled"}
                    </WorkspaceStatusPill>
                  </td>
                  <td>{new Date(user.createdAtUtc).toLocaleDateString("en-PH")}</td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </RecordFormModal>
    </>
  );
}

function RoleWorkspaceTabContent({
  activeTab,
  targetScope,
  workspace,
  isSaving,
  onEditRole,
  onViewUsers,
  onSave
}: RoleWorkspaceTabContentProps) {
  if (activeTab === "permissions") {
    return <PermissionCatalogTab workspace={workspace} />;
  }

  if (activeTab === "matrix") {
    return (
      <RolePermissionMatrixTab
        workspace={workspace}
        isSaving={isSaving}
        onSave={(roleId, permissionKeys) => onSave(targetScope, roleId, permissionKeys)}
      />
    );
  }

  return (
    <RoleCatalogTab
      workspace={workspace}
      onEditRole={(roleId) => onEditRole(targetScope, roleId)}
      onViewUsers={(roleId) => onViewUsers(targetScope, roleId)}
    />
  );
}

function RoleScopeSection({
  eyebrow,
  title,
  children
}: RoleScopeSectionProps) {
  return (
    <section className="grid min-h-[36rem] gap-3 rounded-box border border-base-300/70 bg-base-100/82 p-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/58">
            {eyebrow}
          </p>
          <h2 className="text-lg font-bold tracking-[-0.03em] text-base-content">{title}</h2>
        </div>
      </div>
      <div className="flex min-h-[31rem] flex-col">
        {children}
      </div>
    </section>
  );
}

function resolveEndpoints(scope: RolePermissionScope, tenantDomainSlug: string) {
  if (scope === "superadmin") {
    return {
      workspace: "/api/superadmin/roles-permissions",
      create: "/api/superadmin/roles-permissions/roles",
      updateRole: (roleId: string) => `/api/superadmin/roles-permissions/roles/${roleId}`,
      users: (roleId: string) => `/api/superadmin/roles-permissions/roles/${roleId}/users`,
      update: (roleId: string) => `/api/superadmin/roles-permissions/roles/${roleId}/permissions`
    };
  }

  const workspaceScope = scope === "tenant-mls" ? "mls" : "sms";
  return {
    workspace: `/api/tenants/${tenantDomainSlug}/roles-permissions?scope=${workspaceScope}`,
    create: `/api/tenants/${tenantDomainSlug}/roles-permissions/roles?scope=${workspaceScope}`,
    updateRole: (roleId: string) =>
      `/api/tenants/${tenantDomainSlug}/roles-permissions/roles/${roleId}?scope=${workspaceScope}`,
    users: (roleId: string) =>
      `/api/tenants/${tenantDomainSlug}/roles-permissions/roles/${roleId}/users?scope=${workspaceScope}`,
    update: (roleId: string) =>
      `/api/tenants/${tenantDomainSlug}/roles-permissions/roles/${roleId}/permissions?scope=${workspaceScope}`
  };
}

function roleWorkspaceQueryKey(scope: RolePermissionScope, tenantDomainSlug: string) {
  return ["roles-permissions", scope, tenantDomainSlug];
}

function resolveAlternateScope(scope: RolePermissionScope): RolePermissionScope | null {
  if (scope === "tenant-sms") {
    return "tenant-mls";
  }

  if (scope === "tenant-mls") {
    return "tenant-sms";
  }

  return null;
}

function resolveScopeFromPlatformScope(currentScope: RolePermissionScope, platformScope: string): RolePermissionScope {
  if (currentScope === "superadmin") {
    return "superadmin";
  }

  return platformScope === "MLS" ? "tenant-mls" : "tenant-sms";
}

function resolveWorkspaceForScope(
  targetScope: RolePermissionScope,
  primaryScope: RolePermissionScope,
  primaryWorkspace: RolePermissionWorkspaceResponse | undefined,
  alternateWorkspace: RolePermissionWorkspaceResponse | undefined
) {
  return targetScope === primaryScope ? primaryWorkspace : alternateWorkspace;
}

function resolvePlatformShortLabel(scope: RolePermissionScope) {
  if (scope === "tenant-mls") {
    return "MLS";
  }

  if (scope === "tenant-sms") {
    return "SMS";
  }

  return "Root";
}

function createEmptyRoleForm(scope: RolePermissionScope): RoleFormState {
  return {
    name: "",
    description: "",
    platformScope: scope === "superadmin" ? "Root" : scope === "tenant-mls" ? "MLS" : "SMS",
    rank: ""
  };
}

function createRoleForm(role: RolePermissionRoleRow): RoleFormState {
  return {
    name: role.name,
    description: role.description,
    platformScope: role.platformScope,
    rank: String(role.rank)
  };
}

function resolveScopeOptions(scope: RolePermissionScope) {
  if (scope === "superadmin") {
    return [{ value: "Root", label: "Root" }];
  }

  return [
    { value: "SMS", label: "SMS" },
    { value: "MLS", label: "MLS" }
  ];
}

function resolveBreadcrumbs(scope: RolePermissionScope, tenantDomainSlug: string) {
  if (scope === "superadmin") {
    return "ServiFinance / Administration / Roles and permissions";
  }

  if (scope === "tenant-mls") {
    return `${tenantDomainSlug || "tenant"} / MLS / Administration / Roles and permissions`;
  }

  return `${tenantDomainSlug || "tenant"} / SMS / Administration / Roles and permissions`;
}
