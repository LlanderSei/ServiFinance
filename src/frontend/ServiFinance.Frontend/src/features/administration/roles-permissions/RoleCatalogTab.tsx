import type { RolePermissionRoleRow, RolePermissionWorkspaceResponse } from "@/shared/api/contracts";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import {
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import { MetricCard } from "@/shared/records/MetricCard";

type RoleCatalogTabProps = {
  workspace: RolePermissionWorkspaceResponse;
  alternateWorkspace?: RolePermissionWorkspaceResponse;
  showAlternatePlatform: boolean;
  onEditRole: (roleId: string, platformScope: string) => void;
  onViewUsers: (roleId: string, platformScope: string) => void;
};

export function RoleCatalogTab({
  workspace,
  alternateWorkspace,
  showAlternatePlatform,
  onEditRole,
  onViewUsers
}: RoleCatalogTabProps) {
  const visibleRoles = mergeRoles(workspace.roles, showAlternatePlatform ? alternateWorkspace?.roles : undefined);
  const lockedRoles = visibleRoles.filter(role => role.isPermissionSetLocked).length;
  const mutableRoles = visibleRoles.length - lockedRoles;
  const assignedUsers = visibleRoles.reduce((total, role) => total + role.assignedUserCount, 0);

  return (
    <WorkspaceKpiRailLayout
      kpis={(
        <>
          <MetricCard
            label="Scope"
            value={showAlternatePlatform && alternateWorkspace ? formatCombinedScopeLabel(workspace, alternateWorkspace) : workspace.scopeLabel}
            description="The role catalog stays scoped, but the table can combine tenant SMS and MLS roles for review."
          />
          <MetricCard
            label="Locked roles"
            value={lockedRoles}
            description="System authority roles with permission sets that cannot be changed."
          />
          <MetricCard
            label="Mutable roles"
            value={mutableRoles}
            description="Operational roles that can receive adjusted permission sets."
          />
          <MetricCard
            label="Assignments"
            value={assignedUsers}
            description="Current user-role links counted across the visible role catalog."
          />
        </>
      )}
    >
      <WorkspacePanel className="h-full">
        <WorkspacePanelHeader
          eyebrow="Role catalog"
          title="Ranked role register"
        />

        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Role</th>
                <th>Scope</th>
                <th>Rank</th>
                <th>Permission set</th>
                <th>Users</th>
                <th>Permissions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoles.length === 0 ? (
                <RecordTableStateRow colSpan={7}>
                  No roles are available for this scope.
                </RecordTableStateRow>
              ) : null}

              {visibleRoles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="grid gap-1">
                      <strong>{role.name}</strong>
                      <span className="text-sm text-base-content/65">{role.description}</span>
                    </div>
                  </td>
                  <td>{formatPlatformScope(role.platformScope)}</td>
                  <td>
                    <WorkspaceStatusPill tone={role.rank <= 10 ? "warning" : "neutral"}>
                      {role.rank}
                    </WorkspaceStatusPill>
                  </td>
                  <td>
                    <WorkspaceStatusPill tone={role.isPermissionSetLocked ? "warning" : "active"}>
                      {role.isPermissionSetLocked ? "Locked" : "Editable"}
                    </WorkspaceStatusPill>
                  </td>
                  <td>{role.assignedUserCount}</td>
                  <td>{role.permissionKeys.length}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <RecordTableActionButton
                        disabled={!role.canEditPermissions}
                        onClick={() => onEditRole(role.id, role.platformScope)}
                      >
                        Edit
                      </RecordTableActionButton>
                      <RecordTableActionButton onClick={() => onViewUsers(role.id, role.platformScope)}>
                        View users
                      </RecordTableActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </WorkspacePanel>
    </WorkspaceKpiRailLayout>
  );
}

function mergeRoles(
  primaryRoles: RolePermissionRoleRow[],
  alternateRoles?: RolePermissionRoleRow[]
) {
  return Array.from(new Map([...primaryRoles, ...(alternateRoles ?? [])].map(role => [role.id, role])).values())
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

function formatCombinedScopeLabel(
  workspace: RolePermissionWorkspaceResponse,
  alternateWorkspace: RolePermissionWorkspaceResponse
) {
  const alternateLabel = alternateWorkspace.scopeLabel.startsWith("Tenant ")
    ? alternateWorkspace.scopeLabel.replace("Tenant ", "")
    : alternateWorkspace.scopeLabel;

  return `${workspace.scopeLabel} + ${alternateLabel}`;
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
