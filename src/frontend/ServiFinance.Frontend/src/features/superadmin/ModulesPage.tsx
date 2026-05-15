import { useMemo, useState } from "react";
import { SuperadminModuleRow } from "@/shared/api/contracts";
import { useSuperadminModules } from "@/shared/api/useSuperadminModules";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
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
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

export function ModulesPage() {
  const [selectedModule, setSelectedModule] = useState<SuperadminModuleRow | null>(null);
  const query = useSuperadminModules();
  const rows = query.data ?? [];
  const moduleDetails = useMemo(() => {
    if (!selectedModule) {
      return [];
    }

    return [
      {
        title: "Catalog identity",
        items: [
          { label: "Module name", value: selectedModule.name },
          { label: "Code", value: selectedModule.code },
          { label: "Channel", value: selectedModule.channel },
          { label: "Status", value: selectedModule.isActive ? "Active" : "Inactive" }
        ]
      },
      {
        title: "Commercial reach",
        items: [
          { label: "Assigned tiers", value: selectedModule.assignedTierCount },
          { label: "Summary", value: selectedModule.summary },
          { label: "Availability", value: selectedModule.isActive ? "Available for assignment" : "Not assignable" }
        ]
      }
    ];
  }, [selectedModule]);

  return (
    <>
      <RecordWorkspace
        breadcrumbs="SaaS / Modules"
        title="Module catalog"
        description="Inspect the platform module inventory, its delivery channel, and how many subscription tiers currently unlock each module."
        recordCount={rows.length}
        singularLabel="module"
      >
        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Channel</th>
                <th>Assigned tiers</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <RecordTableStateRow colSpan={6}>Loading module catalog...</RecordTableStateRow>
              ) : null}

              {query.isError ? (
                <RecordTableStateRow colSpan={6} tone="error">
                  Unable to load module catalog.
                </RecordTableStateRow>
              ) : null}

              {!query.isLoading && !query.isError && !rows.length ? (
                <RecordTableStateRow colSpan={6}>No modules found.</RecordTableStateRow>
              ) : null}

              {rows.map((module) => (
                <tr key={module.id}>
                  <td>
                    <MobileRecordCardLayout
                      upper={(
                        <div className="min-w-0">
                          <strong className="block text-sm text-base-content">{module.name}</strong>
                          <MobileRecordFieldGrid>
                            <MobileRecordField label="Code" value={module.code} />
                          </MobileRecordFieldGrid>
                        </div>
                      )}
                      middleColumns={2}
                      middle={(
                        <>
                          <MobileRecordFieldGrid>
                            <MobileRecordField label="Channel" value={module.channel} />
                            <MobileRecordField label="Assigned tiers" value={module.assignedTierCount} />
                          </MobileRecordFieldGrid>
                          <div className="grid justify-items-start gap-1.5">
                            <WorkspaceStatusPill tone={module.isActive ? "active" : "inactive"}>
                              {module.isActive ? "Active" : "Inactive"}
                            </WorkspaceStatusPill>
                          </div>
                        </>
                      )}
                    />
                    <span className="hidden lg:inline">{module.name}</span>
                  </td>
                  <td className="max-lg:hidden">{module.code}</td>
                  <td className="max-lg:hidden">{module.channel}</td>
                  <td className="max-lg:hidden">{module.assignedTierCount}</td>
                  <td className="max-lg:hidden">{module.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    <RecordTableActionButton className="w-full justify-center" onClick={() => setSelectedModule(module)}>
                      View
                    </RecordTableActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </RecordWorkspace>

      <RecordDetailsModal
        open={selectedModule !== null}
        eyebrow="Platform module"
        title={selectedModule?.name ?? ""}
        sections={moduleDetails}
        onClose={() => setSelectedModule(null)}
      />
    </>
  );
}
