import { useMemo } from "react";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceMetricGrid } from "@/shared/records/WorkspacePanel";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";

interface OverviewProps {
  assignments: TenantDispatchAssignmentRow[];
  currentUserId: string | null;
}

export function SmsDispatchOverview({ assignments, currentUserId }: OverviewProps) {
  const summary = useMemo(() => {
    return {
      scheduled: assignments.filter((a) => a.assignmentStatus === "Scheduled").length,
      inProgress: assignments.filter((a) => a.assignmentStatus === "In Progress").length,
      onHold: assignments.filter((a) => a.assignmentStatus === "On Hold").length,
      completed: assignments.filter((a) => a.assignmentStatus === "Completed").length,
      mine: currentUserId ? assignments.filter((a) => a.assignedUserId === currentUserId).length : 0,
    };
  }, [assignments, currentUserId]);

  return (
    <div className="grid gap-4">
      <WorkspaceMetricGrid className="2xl:grid-cols-5">
        <MetricCard label="Scheduled" value={summary.scheduled} description="Queued assignments" />
        <MetricCard label="In progress" value={summary.inProgress} description="Currently active" />
        <MetricCard label="On hold" value={summary.onHold} description="Temporarily paused" />
        <MetricCard label="Completed" value={summary.completed} description="Finished work" />
        <MetricCard label="My tasks" value={summary.mine} description="Assigned to you" />
      </WorkspaceMetricGrid>

      {/* Additional summary sections can go here */}
      <div className="rounded-xl border border-base-300/70 bg-base-100 px-4 py-3">
        <p className="text-sm text-base-content/70">
          Overview shows key metrics across all assignments. Use the tabs above to drill into specific views.
        </p>
      </div>
    </div>
  );
}
