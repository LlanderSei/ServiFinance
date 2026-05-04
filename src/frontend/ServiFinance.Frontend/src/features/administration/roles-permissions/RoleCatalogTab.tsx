import type { RolePermissionWorkspaceResponse } from "@/shared/api/contracts";
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
  onEditRole: (roleId: string) => void;
  onViewUsers: (roleId: string) => void;
};

export function RoleCatalogTab({
  workspace,
  onEditRole,
  onViewUsers
}: RoleCatalogTabProps) {
  const lockedRoles = workspace.roles.filter(role => role.isPermissionSetLocked).length;
  const mutableRoles = workspace.roles.length - lockedRoles;
  const assignedUsers = workspace.roles.reduce((total, role) => total + role.assignedUserCount, 0);

  return (
    <WorkspaceKpiRailLayout
      kpis={(
        <>
          <MetricCard
            label="Scope"
            value={workspace.scopeLabel}
            description="The role catalog is isolated by platform, tenant SMS, or tenant MLS scope."
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
              {workspace.roles.length === 0 ? (
                <RecordTableStateRow colSpan={7}>
                  No roles are available for this scope.
                </RecordTableStateRow>
              ) : null}

              {workspace.roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="grid gap-1">
                      <strong>{role.name}</strong>
                      <span className="text-sm text-base-content/65">{role.description}</span>
                    </div>
                  </td>
                  <td>{role.platformScope}</td>
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
                        onClick={() => onEditRole(role.id)}
                      >
                        Edit
                      </RecordTableActionButton>
                      <RecordTableActionButton onClick={() => onViewUsers(role.id)}>
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
