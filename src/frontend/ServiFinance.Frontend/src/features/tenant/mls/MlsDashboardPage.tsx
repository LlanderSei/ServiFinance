import { useParams } from "react-router-dom";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspacePanel, WorkspacePanelHeader, WorkspaceScrollStack } from "@/shared/records/WorkspacePanel";

export function MlsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Dashboard`}
        title="Micro-Lending System"
        description={`Tenant-specific desktop placeholder surface for ${tenantDomainSlug}.`}
      >
        <WorkspaceScrollStack>
          <WorkspacePanel>
            <WorkspacePanelHeader eyebrow="Current scope" title="Desktop placeholder only" />
            <p className="text-base-content/70">
              This route documents the tenant-aware desktop entry point until the MAUI client is wired to shared auth.
            </p>
          </WorkspacePanel>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
