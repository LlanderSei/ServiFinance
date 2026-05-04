import type { RolePermissionDefinition, RolePermissionWorkspaceResponse } from "@/shared/api/contracts";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceKpiRailLayout, WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";

type PermissionCatalogTabProps = {
  workspace: RolePermissionWorkspaceResponse;
};

export function PermissionCatalogTab({ workspace }: PermissionCatalogTabProps) {
  const categories = groupPermissionsByCategory(workspace.permissions);
  const mutableRoles = workspace.roles.filter(role => !role.isPermissionSetLocked).length;

  return (
    <WorkspaceKpiRailLayout
      kpis={(
        <>
          <MetricCard
            label="Permissions"
            value={workspace.permissions.length}
            description="Permission keys defined for this scope."
          />
          <MetricCard
            label="Categories"
            value={categories.length}
            description="Functional groupings used by the matrix editor."
          />
          <MetricCard
            label="Editable roles"
            value={mutableRoles}
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
      <div className="min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-4">
          {categories.map((category) => (
            <WorkspacePanel key={category.name}>
              <WorkspacePanelHeader
                eyebrow="Permission category"
                title={category.name}
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {category.permissions.map((permission) => (
                  <article
                    key={permission.key}
                    className="rounded-2xl border border-base-300/65 bg-base-200/45 p-4"
                  >
                    <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-base-content/55">
                      {permission.key}
                    </p>
                    <h3 className="mt-2 text-base font-bold text-base-content">{permission.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-base-content/68">{permission.description}</p>
                  </article>
                ))}
              </div>
            </WorkspacePanel>
          ))}
        </div>
      </div>
    </WorkspaceKpiRailLayout>
  );
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
