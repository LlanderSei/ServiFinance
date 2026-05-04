import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerRequests, useCreateCustomerRequest, useSubmitCustomerFeedback, useUploadCustomerRequestAttachments } from "./useCustomerRequests";
import type { CustomerRequest } from "./useCustomerRequests";

function RequestRow({ request, tenantDomainSlug }: { request: CustomerRequest; tenantDomainSlug: string }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("");
  const submitFeedback = useSubmitCustomerFeedback();

  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  const hasFeedback = request.rating != null;
  const feedbackExpired = isCompleted && !hasFeedback && isFeedbackExpired(request.feedbackExpiresAtUtc);
  const canSubmitFeedback = isCompleted && !hasFeedback && !feedbackExpired;

  return (
    <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{request.requestNumber}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{request.itemType}</h2>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
          {request.currentStatus}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        <strong>Issue:</strong> {request.issueDescription}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        <strong>Item:</strong> {request.itemDescription}
      </p>
      <div className="mt-5">
        <Link
          className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
          to={`/t/${tenantDomainSlug}/c/requests/${request.id}`}
        >
          Track request
        </Link>
      </div>

      {canSubmitFeedback && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">How was our service?</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Feedback stays open for 7 days after completion{request.feedbackExpiresAtUtc ? `, until ${formatFeedbackDeadline(request.feedbackExpiresAtUtc)}` : ""}.
          </p>
          <div className="mt-3 grid gap-3">
            <label className="flex items-center gap-3">
              <span className="text-sm text-slate-700">Rating (1-5):</span>
              <input 
                type="number" 
                min="1" 
                max="5" 
                className="input input-sm input-bordered w-20 rounded-xl"
                value={rating} 
                onChange={e => setRating(Number(e.target.value))} 
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm text-slate-700">Suggestion type (optional)</span>
              <select
                className="select select-bordered w-full rounded-xl bg-white"
                value={suggestionCategory}
                onChange={e => setSuggestionCategory(e.target.value)}
              >
                <option value="">No category</option>
                {feedbackSuggestionOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <textarea 
              className="textarea textarea-bordered w-full rounded-xl bg-white" 
              placeholder="Leave a comment or suggestion (optional)"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
            <button 
              className="btn btn-sm bg-slate-900 text-white rounded-xl w-max"
              disabled={submitFeedback.isPending}
              onClick={() => submitFeedback.mutate({ id: request.id, rating, feedbackComments: feedback, suggestionCategory })}
            >
              {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
            </button>
            {submitFeedback.isError && (
              <p className="text-sm text-red-600">
                Feedback could not be submitted. The feedback window may have expired or the rating was already recorded.
              </p>
            )}
          </div>
        </div>
      )}

      {isCompleted && !hasFeedback && feedbackExpired && (
        <div className="mt-6 rounded-2xl bg-slate-100 p-4 border border-slate-200 text-sm text-slate-700">
          Feedback window expired{request.feedbackExpiresAtUtc ? ` on ${formatFeedbackDeadline(request.feedbackExpiresAtUtc)}` : ""}.
        </div>
      )}

      {isCompleted && hasFeedback && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-sm text-emerald-800">
          <strong>You rated this {request.rating}/5.</strong>
          {request.feedbackSuggestionCategory && <p className="mt-1">Suggestion: {request.feedbackSuggestionCategory}</p>}
          {request.feedbackComments && <p className="mt-1">{request.feedbackComments}</p>}
        </div>
      )}
    </article>
  );
}

const feedbackSuggestionOptions = [
  "Service quality",
  "Technician conduct",
  "Scheduling",
  "Pricing or billing",
  "Follow-up",
  "Other suggestion"
];

function isFeedbackExpired(feedbackExpiresAtUtc?: string | null) {
  return Boolean(feedbackExpiresAtUtc && new Date(feedbackExpiresAtUtc).getTime() < Date.now());
}

function formatFeedbackDeadline(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function CustomerRequestsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const { data: requests, isLoading } = useCustomerRequests();
  const createRequest = useCreateCustomerRequest();
  const uploadAttachments = useUploadCustomerRequestAttachments();
  
  const [showForm, setShowForm] = useState(false);
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const createdRequest = await createRequest.mutateAsync({ itemType, itemDescription, issueDescription });

      if (attachments.length) {
        const payload = new FormData();
        attachments.forEach(file => payload.append("files", file));
        await uploadAttachments.mutateAsync({ id: createdRequest.id, payload });
      }

      setShowForm(false);
      setItemType("");
      setItemDescription("");
      setIssueDescription("");
      setAttachments([]);
    } catch {
      // Mutation state already exposes the error message context in the form.
    }
  };

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)] flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer requests</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">My service requests</h1>
          <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
            View your service history, current status, and submit new requests.
          </p>
        </div>
        <button 
          className="btn bg-blue-600 text-white hover:bg-blue-700 rounded-full border-none px-6"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "New Request"}
        </button>
      </section>

      {showForm && (
        <section className="rounded-[2rem] border border-slate-200/80 bg-slate-50 px-5 py-6 shadow-inner">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Create New Service Request</h2>
          <form onSubmit={handleCreate} className="grid w-full gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Item Type</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" placeholder="e.g. Laptop, Commercial Oven" value={itemType} onChange={e => setItemType(e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Item Description</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" placeholder="e.g. 15-inch gaming laptop" value={itemDescription} onChange={e => setItemDescription(e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Issue Description</span>
              <textarea required className="textarea textarea-bordered min-h-32 w-full rounded-xl bg-white" placeholder="Describe the problem..." value={issueDescription} onChange={e => setIssueDescription(e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Pictures (optional)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="file-input file-input-bordered w-full rounded-xl bg-white"
                onChange={event => setAttachments(Array.from(event.target.files ?? []))}
              />
              <span className="text-xs leading-5 text-slate-500">Upload issue photos now so tenant staff can inspect them from SMS. Each file must be 5 MB or smaller.</span>
            </label>
            {(createRequest.isError || uploadAttachments.isError) && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                {createRequest.error?.message ?? uploadAttachments.error?.message ?? "Unable to create the service request."}
              </p>
            )}
            <button disabled={createRequest.isPending || uploadAttachments.isPending} type="submit" className="btn w-full rounded-full bg-slate-900 px-8 text-white hover:bg-slate-800 sm:w-max md:col-span-2">
              {createRequest.isPending || uploadAttachments.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </section>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading requests...</div>
      ) : (
        <section className="grid gap-4">
          {requests?.length === 0 ? (
            <div className="rounded-[1.8rem] border border-slate-200 border-dashed p-8 text-center text-slate-500">
              You haven't made any service requests yet.
            </div>
          ) : (
            requests?.map((req) => <RequestRow key={req.id} request={req} tenantDomainSlug={tenantDomainSlug} />)
          )}
        </section>
      )}
    </div>
  );
}
