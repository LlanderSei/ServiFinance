import type { RolePermissionDefinition, RolePermissionWorkspaceResponse } from "@/shared/api/contracts";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { WorkspaceKpiRailLayout, WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";

type PermissionCatalogTabProps = {
  workspace: RolePermissionWorkspaceResponse;
  alternateWorkspace?: RolePermissionWorkspaceResponse;
  showAlternatePlatform: boolean;
};

export function PermissionCatalogTab({
  workspace,
  alternateWorkspace,
  showAlternatePlatform
}: PermissionCatalogTabProps) {
  const workspaces = [
    workspace,
    ...(showAlternatePlatform && alternateWorkspace ? [alternateWorkspace] : [])
  ];
  const permissions = workspaces.flatMap(item => item.permissions);
  const primaryCount = workspace.permissions.length;
  const alternateCount = showAlternatePlatform ? alternateWorkspace?.permissions.length ?? 0 : 0;
  const primaryCategoryCount = new Set(workspace.permissions.map(permission => permission.category)).size;
  const alternateCategoryCount = showAlternatePlatform && alternateWorkspace
    ? new Set(alternateWorkspace.permissions.map(permission => permission.category)).size
    : 0;
  const primaryEditableRoles = workspace.roles.filter(role => !role.isPermissionSetLocked).length;
  const alternateEditableRoles = showAlternatePlatform && alternateWorkspace
    ? alternateWorkspace.roles.filter(role => !role.isPermissionSetLocked).length
    : 0;

  return (
    <WorkspaceKpiRailLayout
      kpis={(
        <>
          <MetricCard
            label="Permissions"
            value={showAlternatePlatform && alternateWorkspace ? `${primaryCount} + ${alternateCount}` : primaryCount}
            description="Permission keys defined for the visible scope set."
          />
          <MetricCard
            label="Categories"
            value={showAlternatePlatform && alternateWorkspace ? `${primaryCategoryCount} + ${alternateCategoryCount}` : primaryCategoryCount}
            description="Functional groupings used by the matrix editor."
          />
          <MetricCard
            label="Editable roles"
            value={showAlternatePlatform && alternateWorkspace ? `${primaryEditableRoles} + ${alternateEditableRoles}` : primaryEditableRoles}
            description="Roles below the current authority rank can be edited."
          />
          <MetricCard
            label="Policy"
            value="Ranked"
            description={workspace.rankPolicy}
          />
        </>
      )}
    >
      <WorkspacePanel className="h-full">
        <WorkspacePanelHeader
          eyebrow="Permission catalog"
          title="Scoped permission register"
        />
        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Category</th>
                <th>Permission name</th>
                <th>Description</th>
                <th>Permission key</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {permissions.length === 0 ? (
                <RecordTableStateRow colSpan={5}>No permissions are available.</RecordTableStateRow>
              ) : null}

              {workspaces.map((item) => (
                <PermissionScopeRows
                  key={item.scope}
                  workspace={item}
                  showScopeHeader={showAlternatePlatform && Boolean(alternateWorkspace)}
                />
              ))}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </WorkspacePanel>
    </WorkspaceKpiRailLayout>
  );
}

function PermissionScopeRows({
  workspace,
  showScopeHeader
}: {
  workspace: RolePermissionWorkspaceResponse;
  showScopeHeader: boolean;
}) {
  const rows = workspace.permissions
    .slice()
    .sort((left, right) =>
      left.category.localeCompare(right.category) ||
      left.name.localeCompare(right.name));

  return (
    <>
      {showScopeHeader ? (
        <tr>
          <td colSpan={5} className="bg-base-200/70 font-extrabold uppercase tracking-[0.1em] text-base-content/60">
            {workspace.scopeLabel} Permissions
          </td>
        </tr>
      ) : null}

      {rows.map((permission: RolePermissionDefinition) => (
        <tr key={permission.key}>
          <td>{permission.category}</td>
          <td>
            <strong>{permission.name}</strong>
          </td>
          <td className="max-w-[28rem] text-base-content/68">{permission.description}</td>
          <td className="font-mono text-xs">{permission.key}</td>
          <td>{permission.scope}</td>
        </tr>
      ))}
    </>
  );
}
