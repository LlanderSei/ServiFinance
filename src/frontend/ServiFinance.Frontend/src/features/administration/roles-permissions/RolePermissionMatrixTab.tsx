import { useEffect, useState } from "react";
import type {
  RolePermissionDefinition,
  RolePermissionRoleRow,
  RolePermissionWorkspaceResponse
} from "@/shared/api/contracts";
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
  isSaving: boolean;
  onSave: (roleId: string, permissionKeys: string[]) => void;
};

export function RolePermissionMatrixTab({
  workspace,
  isSaving,
  onSave
}: RolePermissionMatrixTabProps) {
  const [selectedRoleId, setSelectedRoleId] = useState(() => selectDefaultRole(workspace.roles)?.id ?? "");
  const selectedRole = workspace.roles.find(role => role.id === selectedRoleId) ?? selectDefaultRole(workspace.roles);
  const visiblePermissionKeys = workspace.permissions.map(permission => permission.key);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const baselineKeys = selectedRole
    ? selectedRole.permissionKeys.filter(permissionKey => visiblePermissionKeys.includes(permissionKey))
    : [];
  const permissionGroups = groupPermissionsByCategory(workspace.permissions);
  const isDirty = !arePermissionSetsEqual(checkedKeys, baselineKeys);
  const canEdit = Boolean(selectedRole?.canEditPermissions) && !selectedRole?.isPermissionSetLocked;

  useEffect(() => {
    if (!selectedRole || workspace.roles.every(role => role.id !== selectedRole.id)) {
      setSelectedRoleId(selectDefaultRole(workspace.roles)?.id ?? "");
    }
  }, [selectedRole, workspace.roles]);

  useEffect(() => {
    setCheckedKeys(baselineKeys);
  }, [selectedRole?.id, workspace.scope]);

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
            description={selectedRole?.description ?? "Choose a role to inspect its permission set."}
          />
          <MetricCard
            label="Role rank"
            value={selectedRole?.rank ?? "-"}
            description="Lower rank numbers mean higher authority."
          />
          <MetricCard
            label="Granted here"
            value={checkedKeys.length}
            description="Permission keys selected for the visible scope."
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
        <WorkspacePanel className="min-h-0">
          <WorkspacePanelHeader
            eyebrow="Roles"
            title="Select a role"
          />
          <div className="grid min-h-0 gap-2 overflow-y-auto pr-1">
            {workspace.roles.map((role) => (
              <WorkspaceToggleButton
                key={role.id}
                active={selectedRole?.id === role.id}
                className="h-auto justify-start rounded-2xl px-4 py-3 text-left"
                onClick={() => setSelectedRoleId(role.id)}
              >
                <span className="grid gap-1">
                  <span className="font-bold">{role.name}</span>
                  <span className="text-xs opacity-70">
                    Rank {role.rank} / {role.isPermissionSetLocked ? "locked" : role.canEditPermissions ? "editable" : "not editable"}
                  </span>
                </span>
              </WorkspaceToggleButton>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="min-h-0">
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
                  onClick={() => selectedRole ? onSave(selectedRole.id, checkedKeys) : undefined}
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

          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4">
              {permissionGroups.map((group) => (
                <section key={group.name} className="rounded-2xl border border-base-300/65 bg-base-200/35 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-base-content">{group.name}</h3>
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-base-content/55">
                      {group.permissions.filter(permission => checkedKeys.includes(permission.key)).length} / {group.permissions.length}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {group.permissions.map((permission) => {
                      const checked = checkedKeys.includes(permission.key);
                      return (
                        <label
                          key={permission.key}
                          className="flex gap-3 rounded-xl border border-base-300/55 bg-base-100/75 p-3"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary mt-1"
                            checked={checked}
                            disabled={!canEdit}
                            onChange={() => togglePermission(permission.key)}
                          />
                          <span className="grid gap-1">
                            <span className="font-bold text-base-content">{permission.name}</span>
                            <span className="text-xs font-bold uppercase tracking-[0.08em] text-base-content/50">{permission.key}</span>
                            <span className="text-sm leading-6 text-base-content/68">{permission.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </WorkspacePanel>
      </div>
    </WorkspaceKpiRailLayout>
  );
}

function selectDefaultRole(roles: RolePermissionRoleRow[]) {
  return roles.find(role => role.canEditPermissions) ?? roles[0] ?? null;
}

function arePermissionSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every(key => rightSet.has(key));
}

function groupPermissionsByCategory(permissions: RolePermissionDefinition[]) {
  return Object.entries(
    permissions.reduce<Record<string, RolePermissionDefinition[]>>((groups, permission) => {
      groups[permission.category] = [...(groups[permission.category] ?? []), permission];
      return groups;
    }, {})
  ).map(([name, groupedPermissions]) => ({
    name,
    permissions: groupedPermissions
  }));
}
