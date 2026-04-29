import { useParams } from "react-router-dom";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceActionLink } from "@/shared/records/WorkspaceControls";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
} from "@/shared/records/WorkspacePanel";

export function SmsDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / SMS / Dashboard`}
      title="Service operations"
      description="Monitor customer intake, service requests, dispatch assignments, and operational reports from one tenant-scoped workspace."
    >
      <WorkspaceScrollStack>
        <WorkspaceMetricGrid className="2xl:grid-cols-4">
          <MetricCard
            label="Customers"
            value="Live records"
            description="Customer profiles in the service register"
          />
          <MetricCard
            label="Service requests"
            value="Live intake"
            description="Service requests being tracked"
          />
          <MetricCard
            label="Dispatch"
            value="Active assignments"
            description="Scheduled and in-progress work"
          />
          <MetricCard
            label="Reports"
            value="Operational"
            description="Analytics and turnover metrics"
          />
        </WorkspaceMetricGrid>

        <WorkspacePanel>
          <WorkspacePanelHeader
            eyebrow="Quick actions"
            title="Tenant SMS modules"
            actions={
              <>
                <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/customers`}>Customers</WorkspaceActionLink>
                <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/service-requests`}>Service Requests</WorkspaceActionLink>
                <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/dispatch`}>Dispatch</WorkspaceActionLink>
                <WorkspaceActionLink to={`/t/${tenantDomainSlug}/sms/reports`}>Reports</WorkspaceActionLink>
              </>
            }
          />
          <WorkspaceEmptyState>
            The SMS workspace provides full service management from customer intake through dispatch and reporting. Each module is production-ready.
          </WorkspaceEmptyState>
        </WorkspacePanel>
      </WorkspaceScrollStack>
    </RecordWorkspace>
  );
}
