import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatFullAddress } from "@/shared/location/formatAddress";
import { useCancelCustomerRequest, useCustomerRequestDetails, useSubmitCustomerFeedback } from "./useCustomerRequests";

const feedbackSuggestionOptions = [
  "Service quality",
  "Technician conduct",
  "Scheduling",
  "Pricing or billing",
  "Follow-up",
  "Other suggestion"
];

function formatDateTime(value?: string | null, fallback = "Not scheduled") {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("completed") || normalized.includes("paid") || normalized.includes("closed")) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized.includes("progress") || normalized.includes("service")) {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized.includes("hold") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function isFeedbackExpired(feedbackExpiresAtUtc?: string | null) {
  return Boolean(feedbackExpiresAtUtc && new Date(feedbackExpiresAtUtc).getTime() < Date.now());
}

function formatScheduleRange(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "No preferred schedule";
  }

  if (start && end) {
    return `${formatDateTime(start)} to ${formatDateTime(end)}`;
  }

  return formatDateTime(start ?? end);
}

export function CustomerRequestDetailsPage() {
  const { requestId = "", tenantDomainSlug = "" } = useParams();
  const detailsQuery = useCustomerRequestDetails(requestId || null);
  const cancelRequest = useCancelCustomerRequest();
  const submitFeedback = useSubmitCustomerFeedback();
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("");

  if (detailsQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-6 py-10 text-center text-slate-500 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        Loading request tracking...
      </section>
    );
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <section className="grid gap-4 rounded-[2rem] border border-rose-200/80 bg-white px-6 py-10 text-center shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-rose-600">Unavailable</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Request details could not be loaded</h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-slate-600">
            The selected service request may no longer exist for this customer account, or the session needs to be refreshed.
          </p>
        </div>
        <div>
          <Link
            className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
            to={`/t/${tenantDomainSlug}/c/requests`}
          >
            Back to requests
          </Link>
        </div>
      </section>
    );
  }

  const { request, timeline, assignments, attachments } = detailsQuery.data;
  const invoice = request.invoice;
  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  const hasFeedback = request.rating != null;
  const feedbackExpired = isCompleted && !hasFeedback && isFeedbackExpired(request.feedbackExpiresAtUtc);
  const canSubmitFeedback = isCompleted && !hasFeedback && !feedbackExpired;

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Request tracking</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{request.requestNumber}</h1>
            <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
              Follow the service timeline, dispatch activity, and finance handoff for this request without entering the tenant SMS workspace.
            </p>
          </div>
          <div className="grid gap-2 justify-items-start sm:justify-items-end">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(request.currentStatus)}`}>
              {request.currentStatus}
            </span>
            <Link
              className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
              to={`/t/${tenantDomainSlug}/c/requests`}
            >
              Back to requests
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Item" value={request.itemType} description={request.itemDescription} />
          <MetricCard label="Priority" value={request.priority} description={`Opened ${formatDateTime(request.createdAtUtc)}`} />
          <MetricCard
            label="Service mode"
            value={request.serviceMode || "Drop-off"}
            description={formatFullAddress(request.serviceAddress, request.serviceAddressDetails)}
          />
          <MetricCard
            label="Needed by"
            value={formatDate(request.neededByUtc ?? request.requestedServiceDate)}
            description={formatScheduleRange(request.preferredScheduleStartUtc, request.preferredScheduleEndUtc)}
          />
          <MetricCard
            label="Finance"
            value={invoice ? invoice.invoiceStatus : "Not invoiced"}
            description={invoice ? `${formatCurrency(invoice.outstandingAmount)} outstanding` : "Invoice will appear here after tenant finalization."}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div className="grid gap-5">
          <Panel title="Issue summary" eyebrow="Intake">
            <p className="text-sm leading-7 text-slate-700">{request.issueDescription}</p>
          </Panel>

          <Panel title="Visit and contact" eyebrow="Customer logistics">
            <dl className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <dt className="font-semibold text-slate-900">Service mode</dt>
                <dd className="mt-2">{request.serviceMode || "Drop-off"}</dd>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <dt className="font-semibold text-slate-900">Contact</dt>
                <dd className="mt-2">
                  {request.contactName || "Not provided"}
                  {request.contactPhone ? ` / ${request.contactPhone}` : ""}
                </dd>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 md:col-span-2">
                <dt className="font-semibold text-slate-900">Service address</dt>
                <dd className="mt-2">{formatFullAddress(request.serviceAddress, request.serviceAddressDetails)}</dd>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <dt className="font-semibold text-slate-900">Preferred schedule</dt>
                <dd className="mt-2">{formatScheduleRange(request.preferredScheduleStartUtc, request.preferredScheduleEndUtc)}</dd>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <dt className="font-semibold text-slate-900">Needed by</dt>
                <dd className="mt-2">{formatDateTime(request.neededByUtc, "No due preference")}</dd>
              </div>
            </dl>
          </Panel>

          {(request.canCancelDirectly || request.canRequestCancellation || request.cancellationReason) && (
            <Panel title="Cancellation" eyebrow="Request control">
              {request.cancellationReason && (
                <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  <strong>{request.cancelledAtUtc ? "Cancelled" : "Cancellation note"}:</strong> {request.cancellationReason}
                  {request.cancellationRequestedAtUtc && <p className="mt-1">Requested {formatDateTime(request.cancellationRequestedAtUtc)}</p>}
                  {request.cancelledAtUtc && <p className="mt-1">Cancelled {formatDateTime(request.cancelledAtUtc)}</p>}
                </div>
              )}
              {(request.canCancelDirectly || request.canRequestCancellation) && (
                <form
                  className="mt-4 grid gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"
                  onSubmit={event => {
                    event.preventDefault();
                    cancelRequest.mutate({ id: request.id, reason: cancelReason });
                  }}
                >
                  <p className="text-sm leading-6 text-slate-600">
                    {request.canCancelDirectly
                      ? "This request has not been assigned yet. Cancellation applies immediately."
                      : "Work may already be scheduled. The tenant team must review this cancellation request."}
                  </p>
                  <textarea
                    className="textarea textarea-bordered w-full rounded-xl bg-white"
                    placeholder="Reason for cancellation"
                    value={cancelReason}
                    onChange={event => setCancelReason(event.target.value)}
                    required
                  />
                  {cancelRequest.isError && <p className="text-sm text-rose-600">{cancelRequest.error.message}</p>}
                  <button className="btn w-full rounded-full bg-rose-600 text-white hover:bg-rose-700 sm:w-max" disabled={cancelRequest.isPending}>
                    {cancelRequest.isPending ? "Sending..." : request.canCancelDirectly ? "Cancel request" : "Send cancellation request"}
                  </button>
                </form>
              )}
            </Panel>
          )}

          <Panel title="Customer pictures" eyebrow="Intake evidence">
            {attachments.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.relativeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white no-underline shadow-[0_10px_24px_rgba(35,46,76,0.05)]"
                  >
                    <img
                      src={attachment.relativeUrl}
                      alt={attachment.originalFileName}
                      className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-950">{attachment.originalFileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(attachment.createdAtUtc)}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState message="No customer pictures were uploaded for this request." />
            )}
          </Panel>

          <Panel title="Feedback window" eyebrow="Post-service">
            {request.rating != null ? (
              <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
                <strong>You rated this service {request.rating}/5.</strong>
                {request.feedbackSuggestionCategory && <p className="mt-1">Suggestion: {request.feedbackSuggestionCategory}</p>}
                {request.feedbackComments && <p className="mt-1">{request.feedbackComments}</p>}
                {request.feedbackSubmittedAtUtc && <p className="mt-2 text-emerald-700">Submitted {formatDateTime(request.feedbackSubmittedAtUtc)}</p>}
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
                    onChange={(event) => setRating(Number(event.target.value))}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Suggestion type (optional)</span>
                  <select
                    className="select select-bordered w-full rounded-xl bg-white"
                    value={suggestionCategory}
                    onChange={(event) => setSuggestionCategory(event.target.value)}
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
                    onChange={(event) => setFeedbackComments(event.target.value)}
                  />
                </label>
                {submitFeedback.isError && (
                  <p className="text-sm text-rose-600">
                    Feedback could not be submitted. The feedback window may have expired or this request was already rated.
                  </p>
                )}
                <button
                  type="button"
                  className="btn w-full rounded-full bg-slate-900 text-white hover:bg-slate-800 sm:w-max"
                  disabled={submitFeedback.isPending}
                  onClick={() => submitFeedback.mutate({
                    id: request.id,
                    rating,
                    feedbackComments,
                    suggestionCategory
                  })}
                >
                  {submitFeedback.isPending ? "Submitting..." : "Submit feedback"}
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

        <div className="grid gap-5">
          <Panel title="Dispatch activity" eyebrow="Assignments">
            <div className="grid gap-4">
              {assignments.length === 0 ? (
                <EmptyState message="No technician assignment has been scheduled for this request yet." />
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

          <Panel title="Invoice and settlement" eyebrow="Finance">
            {invoice ? (
              <div className="grid gap-4">
                <article className="rounded-[1.4rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(35,46,76,0.05)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{invoice.invoiceNumber}</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{formatCurrency(invoice.totalAmount)}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${statusTone(invoice.invoiceStatus)}`}>
                      {invoice.invoiceStatus}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-4">
                      <dt>Invoice date</dt>
                      <dd className="text-right text-slate-900">{formatDate(invoice.invoiceDateUtc)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Outstanding</dt>
                      <dd className="text-right text-slate-900">{formatCurrency(invoice.outstandingAmount)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Settlement mode</dt>
                      <dd className="text-right text-slate-900">{invoice.hasMicroLoan ? "MLS loan account" : "Cashier confirmation"}</dd>
                    </div>
                    {invoice.hasMicroLoan && (
                      <div className="flex items-center justify-between gap-4">
                        <dt>Loan status</dt>
                        <dd className="text-right text-slate-900">{invoice.microLoanStatus ?? "In review"}</dd>
                      </div>
                    )}
                  </dl>
                </article>
                <p className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  {invoice.hasMicroLoan
                    ? "This invoice has already been handed into MLS financing. Collections and amortization are tracked under the linked loan account."
                    : invoice.outstandingAmount > 0
                      ? "Direct online payment is not enabled yet. Use the tenant's cashier or finance instructions, then watch this status for settlement confirmation."
                      : "This invoice is fully settled in the current tenant ledger."}
                </p>
                <Link
                  className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
                  to={`/t/${tenantDomainSlug}/c/invoices`}
                >
                  Open invoices
                </Link>
              </div>
            ) : (
              <EmptyState message="An invoice has not been finalized for this request yet." />
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50 px-4 py-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <strong className="mt-3 block text-lg tracking-[-0.03em] text-slate-950">{value}</strong>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
      {message}
    </div>
  );
}
