import { useMemo, useState } from "react";
import { SuperadminModuleRow } from "@/shared/api/contracts";
import { useSuperadminModules } from "@/shared/api/useSuperadminModules";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";

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
    <ProtectedRoute requireRole="SuperAdmin">
      <>
        <RecordWorkspace
          breadcrumbs="SaaS / Modules"
          title="Module catalog"
          description="Inspect the platform module inventory, its delivery channel, and how many subscription tiers currently unlock each module."
          recordCount={rows.length}
          singularLabel="module"
        >
          <div className="record-table-shell">
            <table className="record-table">
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
                  <tr>
                    <td className="record-table__state" colSpan={6}>Loading module catalog...</td>
                  </tr>
                ) : null}

                {query.isError ? (
                  <tr>
                    <td className="record-table__state record-table__state--error" colSpan={6}>Unable to load module catalog.</td>
                  </tr>
                ) : null}

                {!query.isLoading && !query.isError && !rows.length ? (
                  <tr>
                    <td className="record-table__state" colSpan={6}>No modules found.</td>
                  </tr>
                ) : null}

                {rows.map((module) => (
                  <tr key={module.id}>
                    <td>{module.name}</td>
                    <td>{module.code}</td>
                    <td>{module.channel}</td>
                    <td>{module.assignedTierCount}</td>
                    <td>{module.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      <button type="button" className="record-table__action" onClick={() => setSelectedModule(module)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RecordWorkspace>

        <RecordDetailsModal
          open={selectedModule !== null}
          eyebrow="Platform module"
          title={selectedModule?.name ?? ""}
          sections={moduleDetails}
          onClose={() => setSelectedModule(null)}
        />
      </>
    </ProtectedRoute>
  );
}
