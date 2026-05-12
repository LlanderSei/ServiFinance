import type { CustomerRequestAssignment } from "../useCustomerRequests";
import { EmptyState, Panel, formatDateTime, statusTone } from "./CustomerRequestDetailsShared";

type CustomerRequestDispatchTabProps = {
  assignments: CustomerRequestAssignment[];
};

export function CustomerRequestDispatchTab({ assignments }: CustomerRequestDispatchTabProps) {
  return (
    <Panel title="Dispatch activity" eyebrow="Assignments">
      <div className="grid gap-4 md:grid-cols-2">
        {assignments.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState message="No technician assignment has been scheduled for this request yet." />
          </div>
        ) : (
          assignments.map((assignment) => (
            <article key={assignment.id} className="rounded-[1.4rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(35,46,76,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{assignment.assignedUserName}</p>
                  <p className="mt-1 text-sm text-slate-600">Assigned by {assignment.assignedByUserName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${statusTone(assignment.assignmentStatus)}`}>
                  {assignment.assignmentStatus}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <dt>Scheduled start</dt>
                  <dd className="text-right text-slate-900">{formatDateTime(assignment.scheduledStartUtc)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Scheduled end</dt>
                  <dd className="text-right text-slate-900">{formatDateTime(assignment.scheduledEndUtc)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Created</dt>
                  <dd className="text-right text-slate-900">{formatDateTime(assignment.createdAtUtc)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}
