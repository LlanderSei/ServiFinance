import { useMemo } from "react";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { RecordScrollRegion } from "@/shared/records/RecordWorkspace";
import { WorkspacePanel, WorkspacePanelHeader } from "@/shared/records/WorkspacePanel";
import { WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

interface SmsDispatchTimelineProps {
  assignments: TenantDispatchAssignmentRow[];
  currentUserId: string | null;
  viewMode: "all" | "mine";
  setViewMode: (mode: "all" | "mine") => void;
}

export function SmsDispatchTimeline({ assignments, currentUserId, viewMode, setViewMode }: SmsDispatchTimelineProps) {

  const filteredAssignments = useMemo(() => {
    if (viewMode === "mine" && currentUserId) {
      return assignments.filter((a) => a.assignedUserId === currentUserId);
    }
    return assignments;
  }, [assignments, currentUserId, viewMode]);

  const timelineGroups = useMemo(() => {
    const sorted = [...filteredAssignments].sort((a, b) => {
      const aTime = a.scheduledStartUtc ? new Date(a.scheduledStartUtc).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledStartUtc ? new Date(b.scheduledStartUtc).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime || a.assignedUserName.localeCompare(b.assignedUserName);
    });

    const groups = new Map<string, { label: string; assignments: TenantDispatchAssignmentRow[] }>();
    for (const assignment of sorted) {
      const key = assignment.scheduledStartUtc
        ? new Date(assignment.scheduledStartUtc).toISOString().slice(0, 10)
        : "unscheduled";
      const label = assignment.scheduledStartUtc
        ? new Date(assignment.scheduledStartUtc).toLocaleDateString("en-PH", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })
        : "Unscheduled assignments";

      const existing = groups.get(key);
      if (existing) {
        existing.assignments.push(assignment);
      } else {
        groups.set(key, { label, assignments: [assignment] });
      }
    }
    return Array.from(groups.values());
  }, [filteredAssignments]);

  return (
    <RecordScrollRegion>
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Technician planning" title="Timeline view" />
        {timelineGroups.length === 0 ? (
          <p>No assignments available for the current filter.</p>
        ) : null}

        <div className="grid gap-4">
          {timelineGroups.map((group) => (
            <div key={group.label} className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-base-content">{group.label}</p>
                  <p className="text-sm text-base-content/60">{group.assignments.length} assignment(s)</p>
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="grid gap-3 rounded-box border border-base-300/70 bg-base-100/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="grid gap-1">
                        <strong className="text-base-content">{assignment.requestNumber}</strong>
                        <span className="text-sm text-base-content/70">{assignment.customerName}</span>
                      </div>
                      <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                    </div>
                     <div className="grid gap-1 text-sm text-base-content/75">
                       <span>{assignment.assignedUserName}</span>
                       <span>
                         {assignment.scheduledStartUtc && assignment.scheduledEndUtc
                           ? `${new Date(assignment.scheduledStartUtc).toLocaleString()} to ${new Date(assignment.scheduledEndUtc).toLocaleString()}`
                           : "Unscheduled"}
                       </span>
                       </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </RecordScrollRegion>
  );
}
