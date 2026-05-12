import type { CustomerRequest, CustomerRequestTimelineEntry } from "../useCustomerRequests";
import {
  EmptyState,
  Panel,
  feedbackSuggestionOptions,
  formatDateTime,
  isFeedbackExpired,
  statusTone
} from "./CustomerRequestDetailsShared";

type CustomerRequestTimelineTabProps = {
  request: CustomerRequest;
  timeline: CustomerRequestTimelineEntry[];
  rating: number;
  feedbackComments: string;
  suggestionCategory: string;
  isSubmittingFeedback: boolean;
  hasFeedbackError: boolean;
  onRatingChange: (value: number) => void;
  onFeedbackCommentsChange: (value: string) => void;
  onSuggestionCategoryChange: (value: string) => void;
  onSubmitFeedback: () => void;
};

export function CustomerRequestTimelineTab({
  request,
  timeline,
  rating,
  feedbackComments,
  suggestionCategory,
  isSubmittingFeedback,
  hasFeedbackError,
  onRatingChange,
  onFeedbackCommentsChange,
  onSuggestionCategoryChange,
  onSubmitFeedback
}: CustomerRequestTimelineTabProps) {
  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  const hasFeedback = request.rating != null;
  const feedbackExpired = isCompleted && !hasFeedback && isFeedbackExpired(request.feedbackExpiresAtUtc);
  const canSubmitFeedback = isCompleted && !hasFeedback && !feedbackExpired;

  return (
    <div className="grid gap-5">
      <Panel title="Feedback window" eyebrow="Post-service">
        {request.rating != null ? (
          <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
            <strong>You rated this service {request.rating}/5.</strong>
            {request.feedbackSuggestionCategory ? <p className="mt-1">Suggestion: {request.feedbackSuggestionCategory}</p> : null}
            {request.feedbackComments ? <p className="mt-1">{request.feedbackComments}</p> : null}
            {request.feedbackSubmittedAtUtc ? <p className="mt-2 text-emerald-700">Submitted {formatDateTime(request.feedbackSubmittedAtUtc)}</p> : null}
          </div>
        ) : canSubmitFeedback ? (
          <div className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">How was the service?</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Feedback stays open for 7 days after completion{request.feedbackExpiresAtUtc ? `, until ${formatDateTime(request.feedbackExpiresAtUtc)}` : ""}.
              </p>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Rating (1-5)</span>
              <input
                type="number"
                min="1"
                max="5"
                className="input input-bordered w-24 rounded-xl bg-white"
                value={rating}
                onChange={(event) => onRatingChange(Number(event.target.value))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Suggestion type (optional)</span>
              <select
                className="select select-bordered w-full rounded-xl bg-white"
                value={suggestionCategory}
                onChange={(event) => onSuggestionCategoryChange(event.target.value)}
              >
                <option value="">No category</option>
                {feedbackSuggestionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Comment (optional)</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full rounded-xl bg-white"
                placeholder="Share what worked well or what should improve."
                value={feedbackComments}
                onChange={(event) => onFeedbackCommentsChange(event.target.value)}
              />
            </label>
            {hasFeedbackError ? (
              <p className="text-sm text-rose-600">
                Feedback could not be submitted. The feedback window may have expired or this request was already rated.
              </p>
            ) : null}
            <button
              type="button"
              className="btn w-full rounded-full bg-slate-900 text-white hover:bg-slate-800 sm:w-max"
              disabled={isSubmittingFeedback}
              onClick={onSubmitFeedback}
            >
              {isSubmittingFeedback ? "Submitting..." : "Submit feedback"}
            </button>
          </div>
        ) : request.feedbackExpiresAtUtc ? (
          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            {isFeedbackExpired(request.feedbackExpiresAtUtc)
              ? `Feedback expired on ${formatDateTime(request.feedbackExpiresAtUtc)}.`
              : `Feedback is open until ${formatDateTime(request.feedbackExpiresAtUtc)}.`}
          </div>
        ) : (
          <EmptyState message="Feedback opens after the tenant marks this service request as completed." />
        )}
      </Panel>

      <Panel title="Service timeline" eyebrow="Status history">
        <div className="grid gap-4">
          {timeline.length === 0 ? (
            <EmptyState message="No service timeline entries have been recorded yet." />
          ) : (
            timeline.map((entry) => (
              <article key={entry.id} className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${statusTone(entry.status)}`}>
                      {entry.status}
                    </span>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{entry.remarks}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{formatDateTime(entry.changedAtUtc)}</p>
                    <p className="mt-1 font-medium text-slate-600">{entry.changedByLabel}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
