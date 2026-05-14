import { useEffect, useState } from "react";
import type { RolePermissionRoleRow, RolePermissionWorkspaceResponse } from "@/shared/api/contracts";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceStatusPill,
  WorkspaceToggleButton
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import { MetricCard } from "@/shared/records/MetricCard";

type RolePermissionMatrixTabProps = {
  workspace: RolePermissionWorkspaceResponse;
  alternateWorkspace?: RolePermissionWorkspaceResponse;
  showAlternatePlatform: boolean;
  isSaving: boolean;
  onSave: (roleId: string, permissionKeys: string[], platformScope: string) => void;
};

export function RolePermissionMatrixTab({
  workspace,
  alternateWorkspace,
  showAlternatePlatform,
  isSaving,
  onSave
}: RolePermissionMatrixTabProps) {
  const visibleRoles = mergeRoles(workspace.roles, showAlternatePlatform ? alternateWorkspace?.roles : undefined);
  const [selectedRoleId, setSelectedRoleId] = useState(() => selectDefaultRole(visibleRoles)?.id ?? "");
  const selectedRole = visibleRoles.find(role => role.id === selectedRoleId) ?? selectDefaultRole(visibleRoles);
  const visiblePermissions = resolvePermissionsForRole(selectedRole, workspace, alternateWorkspace);
  const visiblePermissionKeys = visiblePermissions.map(permission => permission.key);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const baselineKeys = selectedRole
    ? selectedRole.permissionKeys.filter(permissionKey => visiblePermissionKeys.includes(permissionKey))
    : [];
  const tablePermissions = visiblePermissions
    .slice()
    .sort((left, right) =>
      left.category.localeCompare(right.category) ||
      left.name.localeCompare(right.name));
  const isDirty = !arePermissionSetsEqual(checkedKeys, baselineKeys);
  const canEdit = Boolean(selectedRole?.canEditPermissions) && !selectedRole?.isPermissionSetLocked;

  useEffect(() => {
    if (!selectedRole || visibleRoles.every(role => role.id !== selectedRole.id)) {
      setSelectedRoleId(selectDefaultRole(visibleRoles)?.id ?? "");
    }
  }, [selectedRole, visibleRoles]);

  useEffect(() => {
    setCheckedKeys(baselineKeys);
  }, [selectedRole?.id, workspace.scope, alternateWorkspace?.scope]);

  function togglePermission(permissionKey: string) {
    setCheckedKeys((currentKeys) => currentKeys.includes(permissionKey)
      ? currentKeys.filter(key => key !== permissionKey)
      : [...currentKeys, permissionKey]);
  }

  return (
    <WorkspaceKpiRailLayout
      kpis={(
        <>
          <MetricCard
            label="Selected role"
            value={selectedRole?.name ?? "None"}
            description={selectedRole ? `${formatPlatformScope(selectedRole.platformScope)} / ${selectedRole.description}` : "Choose a role to inspect its permission set."}
          />
          <MetricCard
            label="Role rank"
            value={selectedRole?.rank ?? "-"}
            description="Lower rank numbers mean higher authority."
          />
          <MetricCard
            label="Granted here"
            value={checkedKeys.length}
            description="Permission keys selected for this role's own scope."
          />
          <MetricCard
            label="Edit state"
            value={canEdit ? "Editable" : "Locked"}
            description={selectedRole?.isPermissionSetLocked ? "System authority roles cannot be changed." : workspace.rankPolicy}
          />
        </>
      )}
    >
      <div className="grid min-h-0 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <WorkspacePanel className="min-h-0 overflow-visible lg:overflow-hidden">
          <WorkspacePanelHeader
            eyebrow="Roles"
            title="Select a role"
          />
          <select
            className="select select-bordered w-full border-base-300/70 bg-base-100 lg:hidden"
            value={selectedRole?.id ?? ""}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            aria-label="Select role"
          >
            {visibleRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} / {formatPlatformScope(role.platformScope)} / Rank {role.rank}
              </option>
            ))}
          </select>
          <div className="hidden min-h-0 gap-2 overflow-y-auto pr-1 lg:grid">
            {visibleRoles.map((role) => (
              <WorkspaceToggleButton
                key={role.id}
                active={selectedRole?.id === role.id}
                className="h-auto justify-start rounded-2xl px-4 py-3 text-left"
                onClick={() => setSelectedRoleId(role.id)}
              >
                <span className="grid gap-1">
                  <span className="font-bold">{role.name}</span>
                  <span className="text-xs opacity-70">
                    {formatPlatformScope(role.platformScope)} / Rank {role.rank} / {role.isPermissionSetLocked ? "locked" : role.canEditPermissions ? "editable" : "not editable"}
                  </span>
                </span>
              </WorkspaceToggleButton>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="min-h-0 overflow-visible lg:overflow-hidden">
          <WorkspacePanelHeader
            eyebrow="Permission matrix"
            title={selectedRole ? `${selectedRole.name} permissions` : "No role selected"}
            actions={(
              <>
                {selectedRole ? (
                  <WorkspaceStatusPill tone={canEdit ? "active" : "warning"}>
                    {canEdit ? "Editable" : "Read only"}
                  </WorkspaceStatusPill>
                ) : null}
                <WorkspaceModalButton
                  tone="primary"
                  disabled={!selectedRole || !canEdit || !isDirty || isSaving}
                  onClick={() => selectedRole ? onSave(selectedRole.id, checkedKeys, selectedRole.platformScope) : undefined}
                >
                  {isSaving ? "Saving..." : "Save permissions"}
                </WorkspaceModalButton>
              </>
            )}
          />

          {!selectedRole ? (
            <WorkspaceNotice>No role is available for this scope.</WorkspaceNotice>
          ) : null}

          {selectedRole?.isPermissionSetLocked ? (
            <WorkspaceNotice>
              This is a locked authority role. SuperAdmin and Owner/Admin permission sets are intentionally fixed.
            </WorkspaceNotice>
          ) : null}

          {selectedRole && !selectedRole.isPermissionSetLocked && !selectedRole.canEditPermissions ? (
            <WorkspaceNotice>
              This role is at the same or a higher rank than the current user, so its permissions are read-only here.
            </WorkspaceNotice>
          ) : null}

          <div className="grid max-h-none gap-3 pb-3 lg:hidden">
            {tablePermissions.length === 0 ? (
              <WorkspaceNotice>No permissions are available for this role scope.</WorkspaceNotice>
            ) : null}

            {tablePermissions.map((permission) => {
              const checked = checkedKeys.includes(permission.key);
              return (
                <article
                  key={permission.key}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-box border border-base-300/70 bg-base-100 p-3 shadow-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mt-1"
                    checked={checked}
                    disabled={!canEdit}
                    aria-label={`Grant ${permission.name}`}
                    onChange={() => togglePermission(permission.key)}
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">
                      {permission.category} / {permission.scope}
                    </p>
                    <h4 className="m-0 mt-1 text-sm font-bold text-base-content">{permission.name}</h4>
                    <p className="m-0 mt-1 break-words text-xs leading-5 text-base-content/68">{permission.description}</p>
                    <code className="mt-2 block break-all rounded-lg bg-base-200 px-2 py-1 text-[0.68rem] text-base-content/70">
                      {permission.key}
                    </code>
                  </div>
                </article>
              );
            })}
          </div>

          <RecordTableShell className="hidden min-h-0 lg:block">
            <RecordTable>
              <thead>
                <tr>
                  <th aria-label="Granted permission" />
                  <th>Category</th>
                  <th>Permission name</th>
                  <th>Description</th>
                  <th>Permission key</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {tablePermissions.length === 0 ? (
                  <RecordTableStateRow colSpan={6}>
                    No permissions are available for this role scope.
                  </RecordTableStateRow>
                ) : null}

                {tablePermissions.map((permission) => {
                  const checked = checkedKeys.includes(permission.key);
                  return (
                    <tr key={permission.key}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          checked={checked}
                          disabled={!canEdit}
                          aria-label={`Grant ${permission.name}`}
                          onChange={() => togglePermission(permission.key)}
                        />
                      </td>
                      <td>{permission.category}</td>
                      <td>
                        <strong>{permission.name}</strong>
                      </td>
                      <td className="max-w-[28rem] text-base-content/68">{permission.description}</td>
                      <td className="font-mono text-xs">{permission.key}</td>
                      <td>{permission.scope}</td>
                    </tr>
                  );
                })}
              </tbody>
            </RecordTable>
          </RecordTableShell>
        </WorkspacePanel>
      </div>
    </WorkspaceKpiRailLayout>
  );
}

function selectDefaultRole(roles: RolePermissionRoleRow[]) {
  return roles.find(role => role.canEditPermissions) ?? roles[0] ?? null;
}

function mergeRoles(
  primaryRoles: RolePermissionRoleRow[],
  alternateRoles?: RolePermissionRoleRow[]
) {
  return Array.from(new Map([...primaryRoles, ...(alternateRoles ?? [])].map(role => [role.id, role])).values())
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

function resolvePermissionsForRole(
  role: RolePermissionRoleRow | null | undefined,
  workspace: RolePermissionWorkspaceResponse,
  alternateWorkspace?: RolePermissionWorkspaceResponse
) {
  if (!role) {
    return workspace.permissions;
  }

  if (role.platformScope === workspace.scope || role.platformScope === "OwnerAdmin") {
    return workspace.permissions;
  }

  return alternateWorkspace?.permissions ?? workspace.permissions;
}

function arePermissionSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every(key => rightSet.has(key));
}

function formatPlatformScope(platformScope: string) {
  if (platformScope === "OwnerAdmin") {
    return "Owner/Admin";
  }

  if (platformScope === "Root" || platformScope === "SMS" || platformScope === "MLS") {
    return platformScope;
  }

  return "Scope required";
}
