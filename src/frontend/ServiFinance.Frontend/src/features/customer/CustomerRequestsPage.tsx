import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerProfile } from "./useCustomerProfile";
import { useCancelCustomerRequest, useCustomerRequests, useCreateCustomerRequest, useSubmitCustomerFeedback, useUploadCustomerRequestAttachments } from "./useCustomerRequests";
import type { CustomerRequest } from "./useCustomerRequests";

function RequestRow({ request, tenantDomainSlug }: { request: CustomerRequest; tenantDomainSlug: string }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const submitFeedback = useSubmitCustomerFeedback();
  const cancelRequest = useCancelCustomerRequest();

  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  const hasFeedback = request.rating != null;
  const feedbackExpired = isCompleted && !hasFeedback && isFeedbackExpired(request.feedbackExpiresAtUtc);
  const canSubmitFeedback = isCompleted && !hasFeedback && !feedbackExpired;
  const canCancel = request.canCancelDirectly || request.canRequestCancellation;

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
      <dl className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-900">Service mode</dt>
          <dd className="mt-1">{request.serviceMode || "Drop-off"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Preferred window</dt>
          <dd className="mt-1">{formatScheduleRange(request.preferredScheduleStartUtc, request.preferredScheduleEndUtc)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Needed by</dt>
          <dd className="mt-1">{formatDateTime(request.neededByUtc, "No due preference")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Contact</dt>
          <dd className="mt-1">{request.contactName || "Not provided"}{request.contactPhone ? ` / ${request.contactPhone}` : ""}</dd>
        </div>
        {request.serviceAddress && (
          <div className="md:col-span-2">
            <dt className="font-semibold text-slate-900">Service address</dt>
            <dd className="mt-1">{request.serviceAddress}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5">
        <Link
          className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
          to={`/t/${tenantDomainSlug}/c/requests/${request.id}`}
        >
          Track request
        </Link>
      </div>

      {request.cancellationReason && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          <strong>{request.cancelledAtUtc ? "Cancellation reason" : "Cancellation note"}:</strong> {request.cancellationReason}
        </div>
      )}

      {canCancel && (
        <form
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          onSubmit={event => {
            event.preventDefault();
            cancelRequest.mutate({ id: request.id, reason: cancelReason });
          }}
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {request.canCancelDirectly ? "Cancel this request" : "Request cancellation"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {request.canCancelDirectly
                ? "This request has not been assigned yet, so cancellation applies immediately."
                : "Work may already be scheduled, so the tenant team must review this cancellation."}
            </p>
          </div>
          <textarea
            className="textarea textarea-bordered w-full rounded-xl bg-white"
            placeholder="Reason for cancellation"
            value={cancelReason}
            onChange={event => setCancelReason(event.target.value)}
            required
          />
          {cancelRequest.isError && (
            <p className="text-sm text-rose-600">{cancelRequest.error.message}</p>
          )}
          <button className="btn btn-sm w-full rounded-full bg-rose-600 text-white hover:bg-rose-700 sm:w-max" disabled={cancelRequest.isPending}>
            {cancelRequest.isPending ? "Sending..." : request.canCancelDirectly ? "Cancel request" : "Send cancellation request"}
          </button>
        </form>
      )}

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

function formatScheduleRange(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "No preferred schedule";
  }

  if (start && end) {
    return `${formatDateTime(start)} to ${formatDateTime(end)}`;
  }

  return formatDateTime(start ?? end);
}

function toUtcIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function CustomerRequestsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const { data: requests, isLoading } = useCustomerRequests();
  const profileQuery = useCustomerProfile();
  const createRequest = useCreateCustomerRequest();
  const uploadAttachments = useUploadCustomerRequestAttachments();
  
  const [showForm, setShowForm] = useState(false);
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [serviceMode, setServiceMode] = useState("Drop-off");
  const [selectedContactOptionId, setSelectedContactOptionId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [preferredScheduleStartUtc, setPreferredScheduleStartUtc] = useState("");
  const [preferredScheduleEndUtc, setPreferredScheduleEndUtc] = useState("");
  const [neededByUtc, setNeededByUtc] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    if (!showForm || !profileQuery.data || contactName || contactPhone || serviceAddress) {
      return;
    }

    const defaultOption = profileQuery.data.contactOptions.find(option => option.isDefault);
    if (defaultOption) {
      setSelectedContactOptionId(defaultOption.id);
      setContactName(defaultOption.contactName);
      setContactPhone(defaultOption.phoneNumber);
      setServiceAddress(defaultOption.address);
      return;
    }

    setContactName(profileQuery.data.fullName);
    setContactPhone(profileQuery.data.mobileNumber);
    setServiceAddress(profileQuery.data.address);
  }, [showForm, profileQuery.data, contactName, contactPhone, serviceAddress]);

  function applyContactOption(optionId: string) {
    setSelectedContactOptionId(optionId);
    const option = profileQuery.data?.contactOptions.find(candidate => candidate.id === optionId);
    if (!option) {
      setContactName(profileQuery.data?.fullName ?? "");
      setContactPhone(profileQuery.data?.mobileNumber ?? "");
      setServiceAddress(profileQuery.data?.address ?? "");
      return;
    }

    setContactName(option.contactName);
    setContactPhone(option.phoneNumber);
    setServiceAddress(option.address);
  }

  function resetForm() {
    setShowForm(false);
    setItemType("");
    setItemDescription("");
    setIssueDescription("");
    setServiceMode("Drop-off");
    setSelectedContactOptionId("");
    setContactName("");
    setContactPhone("");
    setServiceAddress("");
    setPreferredScheduleStartUtc("");
    setPreferredScheduleEndUtc("");
    setNeededByUtc("");
    setAttachments([]);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const createdRequest = await createRequest.mutateAsync({
        itemType,
        itemDescription,
        issueDescription,
        serviceMode,
        serviceAddress,
        contactName,
        contactPhone,
        preferredScheduleStartUtc: toUtcIso(preferredScheduleStartUtc),
        preferredScheduleEndUtc: toUtcIso(preferredScheduleEndUtc),
        neededByUtc: toUtcIso(neededByUtc)
      });

      if (attachments.length) {
        const payload = new FormData();
        attachments.forEach(file => payload.append("files", file));
        await uploadAttachments.mutateAsync({ id: createdRequest.id, payload });
      }

      resetForm();
    } catch {
      // Mutation state already exposes the error message context in the form.
    }
  };

  return (
    <div className="grid gap-5">
      <section className="flex flex-col items-stretch justify-between gap-4 rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)] sm:flex-row sm:items-start">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer requests</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">My service requests</h1>
          <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
            View your service history, current status, and submit new requests.
          </p>
        </div>
        <button 
          className="btn w-full rounded-full border-none bg-blue-600 px-6 text-white hover:bg-blue-700 sm:w-auto"
          onClick={() => {
            if (showForm) {
              resetForm();
              return;
            }

            setShowForm(true);
          }}
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
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Service Mode</span>
              <select className="select select-bordered w-full rounded-xl bg-white" value={serviceMode} onChange={event => setServiceMode(event.target.value)}>
                <option value="Drop-off">Drop-off / customer brings item</option>
                <option value="On-site">On-site visit</option>
                <option value="Pickup">Pickup request</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Saved contact/address</span>
              <select className="select select-bordered w-full rounded-xl bg-white" value={selectedContactOptionId} onChange={event => applyContactOption(event.target.value)}>
                <option value="">Use primary profile</option>
                {profileQuery.data?.contactOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Contact Name</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" value={contactName} onChange={event => setContactName(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Contact Phone</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" value={contactPhone} onChange={event => setContactPhone(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Service Address</span>
              <textarea
                className="textarea textarea-bordered min-h-24 w-full rounded-xl bg-white"
                placeholder="Required for on-site or pickup work. Optional for drop-off."
                value={serviceAddress}
                onChange={event => setServiceAddress(event.target.value)}
                required={serviceMode === "On-site" || serviceMode === "Pickup"}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Preferred Start</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={preferredScheduleStartUtc} onChange={event => setPreferredScheduleStartUtc(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Preferred End</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={preferredScheduleEndUtc} onChange={event => setPreferredScheduleEndUtc(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Needed By / Due Date</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={neededByUtc} onChange={event => setNeededByUtc(event.target.value)} />
              <span className="text-xs leading-5 text-slate-500">
                Use this for pre-order style requests or work that should notify tenant staff before a target date.
              </span>
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

      {!showForm && (
        isLoading ? (
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
        )
      )}
    </div>
  );
}
