import type { ReactNode } from "react";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceNoteList, WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";

type TenantModuleScaffoldProps = {
  tenantSlug: string;
  breadcrumbs: string;
  title: string;
  description: string;
  columns: string[];
  emptyMessage: string;
  nextStepsTitle: string;
  nextSteps: string[];
  dock?: ReactNode;
  requireRole?: string;
};

export function TenantModuleScaffold({
  tenantSlug,
  breadcrumbs,
  title,
  description,
  columns,
  emptyMessage,
  nextStepsTitle,
  nextSteps,
  dock,
  requireRole
}: TenantModuleScaffoldProps) {
  return (
    <ProtectedRoute tenantSlug={tenantSlug} requireRole={requireRole}>
      <RecordWorkspace
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
      >
        <RecordContentStack>
          <RecordTableShell>
            <RecordTable>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <RecordTableStateRow colSpan={columns.length}>{emptyMessage}</RecordTableStateRow>
              </tbody>
            </RecordTable>
          </RecordTableShell>

          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Next slice" title={nextStepsTitle} />
            <WorkspaceNoteList items={nextSteps} />
          </WorkspacePanel>

          {dock}
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
