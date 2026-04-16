import { useParams } from "react-router-dom";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceActionLink } from "@/shared/records/WorkspaceControls";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";

export function SmsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();

  return (
    <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / SMS / Dashboard`}
        title="Service operations workspace"
        description="Run customer intake, request tracking, dispatch planning, reporting, and staff oversight from one tenant-scoped service management surface."
    >
        <WorkspaceScrollStack>
          <WorkspaceMetricGrid className="2xl:grid-cols-4">
            <MetricCard
              label="Customers"
              value="Live records"
              description="Customer records now anchor service intake and repeat work visibility."
            />
            <MetricCard
              label="Service requests"
              value="Live intake"
              description="Intake, priority, and status tracking now run inside the shared request register."
            />
            <MetricCard
              label="Dispatch"
              value="Live dispatch"
              description="Assignments, technician ownership, and task progression now run inside the tenant SMS rail."
            />
            <MetricCard
              label="Reports"
              value="Phase 4"
              description="Operational visibility will consolidate service throughput and status summaries."
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Module rollout" title="Phase 1 interface coverage" />

              <WorkspaceSubtableShell>
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Surface</th>
                      <th>Current state</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Customers</td>
                      <td>Record table + create modal</td>
                      <td>Active</td>
                    </tr>
                    <tr>
                      <td>Service requests</td>
                      <td>Record table + intake modal</td>
                      <td>Active</td>
                    </tr>
                    <tr>
                      <td>Dispatch</td>
                      <td>Assignment register + scheduling</td>
                      <td>Active</td>
                    </tr>
                    <tr>
                      <td>Reports</td>
                      <td>Operational reporting shell</td>
                      <td>Scaffolded</td>
                    </tr>
                    <tr>
                      <td>Staff accounts</td>
                      <td>Live tenant user management</td>
                      <td>Active</td>
                    </tr>
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Next slices" title="Service workflow roadmap" />

              <WorkspaceNoteList
                items={[
                  "Customer editing and richer profile maintenance tied directly to intake records.",
                  "Service request status history, technician photo attachments, and invoice handoff visibility.",
                  "Dispatch reassignment, calendar density, and technician completion evidence.",
                  "Operational report views for volume, workload, and completion throughput."
                ]}
              />
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid singleColumn>
            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Quick actions"
                title="Open tenant modules"
                actions={(
                  <>
                    <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/customers`}>Customers</WorkspaceActionLink>
                    <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/service-requests`}>Service Requests</WorkspaceActionLink>
                    <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/dispatch`}>Dispatch</WorkspaceActionLink>
                    <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/reports`}>Reports</WorkspaceActionLink>
                  </>
                )}
              />

              <WorkspaceEmptyState>
                The tenant SMS surface now has live customer intake, service request tracking, and dispatch scheduling.
                The next slice should focus on reporting depth and execution evidence rather than more scaffolding.
              </WorkspaceEmptyState>
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
    </RecordWorkspace>
  );
}
