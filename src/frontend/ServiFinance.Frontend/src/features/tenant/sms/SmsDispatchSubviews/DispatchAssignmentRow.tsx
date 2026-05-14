import { useState } from "react";
import { createPortal } from "react-dom";
import type { TenantDispatchAssignmentRow } from "@/shared/api/contracts";
import { RecordTableActionButton } from "@/shared/records/RecordTable";
import { WorkspaceActionButton, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

type DispatchAssignmentAction = {
  key: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
};

type DispatchAssignmentRowProps = {
  assignment: TenantDispatchAssignmentRow;
  onView: () => void;
  secondaryActions?: DispatchAssignmentAction[];
  formatDateTime: (value: string | null) => string;
  getFinanceTone: (status: string) => "active" | "warning" | "progress" | "neutral";
};

const dispatchTableActionClass = "h-8 min-h-8 w-full justify-center px-3 text-xs leading-none";

export function DispatchAssignmentRow({
  assignment,
  onView,
  secondaryActions = [],
  formatDateTime,
  getFinanceTone
}: DispatchAssignmentRowProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const totalActions = 1 + secondaryActions.length;
  const directMobileAction = secondaryActions.length === 1 ? secondaryActions[0] : null;

  return (
    <>
      <tr>
        <td>
          <div className="grid gap-3 lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-sm text-base-content">{assignment.requestNumber}</strong>
                <span className="block text-xs text-base-content/70">{assignment.customerName}</span>
                <span className="block text-xs text-base-content/60">{assignment.assignedUserName}</span>
                <span className="block text-xs text-base-content/60">
                  {formatDateTime(assignment.scheduledStartUtc)} - {formatDateTime(assignment.scheduledEndUtc)}
                </span>
                <span className="block text-xs text-base-content/60">{assignment.serviceStatus}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                <WorkspaceStatusPill tone={getFinanceTone(assignment.financeHandoffStatus)}>
                  {assignment.financeHandoffStatus}
                </WorkspaceStatusPill>
                <WorkspaceStatusPill tone={assignment.scheduleConflictCount > 0 ? "warning" : "neutral"}>
                  {assignment.scheduleConflictCount > 0 ? `${assignment.scheduleConflictCount} overlap(s)` : "Clear"}
                </WorkspaceStatusPill>
              </div>
            </div>
          </div>
          <span className="hidden lg:inline">{assignment.requestNumber}</span>
        </td>
        <td className="max-lg:hidden">{assignment.customerName}</td>
        <td className="max-lg:hidden">{assignment.assignedUserName}</td>
        <td className="max-lg:hidden">{formatDateTime(assignment.scheduledStartUtc)}</td>
        <td className="max-lg:hidden">{formatDateTime(assignment.scheduledEndUtc)}</td>
        <td className="max-lg:hidden">
          <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
        </td>
        <td className="max-lg:hidden">{assignment.serviceStatus}</td>
        <td className="max-lg:hidden">
          <WorkspaceStatusPill tone={getFinanceTone(assignment.financeHandoffStatus)}>
            {assignment.financeHandoffStatus}
          </WorkspaceStatusPill>
        </td>
        <td className="max-lg:hidden">
          <WorkspaceStatusPill tone={assignment.scheduleConflictCount > 0 ? "warning" : "neutral"}>
            {assignment.scheduleConflictCount > 0 ? `${assignment.scheduleConflictCount} overlap(s)` : "Clear"}
          </WorkspaceStatusPill>
        </td>
        <td>
          <div className={totalActions > 1 ? "grid w-full grid-cols-2 gap-2 lg:hidden" : "grid w-full grid-cols-1 gap-2 lg:hidden"}>
            <RecordTableActionButton className={dispatchTableActionClass} onClick={onView}>
              View
            </RecordTableActionButton>
            {directMobileAction ? (
              <WorkspaceActionButton
                className={`${dispatchTableActionClass} ${resolveActionToneClass(directMobileAction.tone)}`}
                onClick={directMobileAction.onClick}
                disabled={directMobileAction.disabled}
              >
                {directMobileAction.label}
              </WorkspaceActionButton>
            ) : null}
            {secondaryActions.length > 1 ? (
              <WorkspaceActionButton className={dispatchTableActionClass} onClick={() => setIsOptionsOpen(true)}>
                Options
              </WorkspaceActionButton>
            ) : null}
          </div>

          <div className="hidden w-28 flex-col items-stretch gap-1 lg:flex">
            <RecordTableActionButton className={dispatchTableActionClass} onClick={onView}>
              View
            </RecordTableActionButton>
            {secondaryActions.map((action) => (
              <WorkspaceActionButton
                key={action.key}
                className={`${dispatchTableActionClass} ${resolveActionToneClass(action.tone)}`}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </WorkspaceActionButton>
            ))}
          </div>
        </td>
      </tr>

      {isOptionsOpen ? createPortal((
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dispatch assignment options"
          onClick={() => setIsOptionsOpen(false)}
        >
          <section
            className="w-full rounded-[1.35rem] border border-base-300/70 bg-base-100 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Assignment options</p>
            <h2 className="mt-1 text-lg font-bold text-base-content">{assignment.requestNumber}</h2>
            <div className="mt-4 grid gap-2">
              {secondaryActions.map((action) => (
                <WorkspaceActionButton
                  key={action.key}
                  className={`w-full justify-center ${resolveActionToneClass(action.tone)}`}
                  onClick={() => {
                    action.onClick();
                    setIsOptionsOpen(false);
                  }}
                  disabled={action.disabled}
                >
                  {action.label}
                </WorkspaceActionButton>
              ))}
              <WorkspaceActionButton className="w-full justify-center" onClick={() => setIsOptionsOpen(false)}>
                Close
              </WorkspaceActionButton>
            </div>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

function resolveActionToneClass(tone: DispatchAssignmentAction["tone"]) {
  if (tone === "success") {
    return "text-success hover:bg-success/10";
  }

  if (tone === "warning") {
    return "text-warning hover:bg-warning/10";
  }

  if (tone === "danger") {
    return "text-error hover:bg-error/10";
  }

  return "";
}
