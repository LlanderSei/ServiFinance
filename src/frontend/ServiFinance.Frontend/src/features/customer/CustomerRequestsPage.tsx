import { useState } from "react";
import { useCustomerRequests, useCreateCustomerRequest, useSubmitCustomerFeedback } from "./useCustomerRequests";
import type { CustomerRequest } from "./useCustomerRequests";

function RequestRow({ request }: { request: CustomerRequest }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const submitFeedback = useSubmitCustomerFeedback();

  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  const hasFeedback = request.rating != null;

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

      {isCompleted && !hasFeedback && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">How was our service?</h3>
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
            <textarea 
              className="textarea textarea-bordered w-full rounded-xl bg-white" 
              placeholder="Leave a comment (optional)"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
            <button 
              className="btn btn-sm bg-slate-900 text-white rounded-xl w-max"
              disabled={submitFeedback.isPending}
              onClick={() => submitFeedback.mutate({ id: request.id, rating, feedbackComments: feedback })}
            >
              {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}

      {isCompleted && hasFeedback && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-sm text-emerald-800">
          <strong>You rated this {request.rating}/5.</strong>
          {request.feedbackComments && <p className="mt-1">{request.feedbackComments}</p>}
        </div>
      )}
    </article>
  );
}

export function CustomerRequestsPage() {
  const { data: requests, isLoading } = useCustomerRequests();
  const createRequest = useCreateCustomerRequest();
  
  const [showForm, setShowForm] = useState(false);
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRequest.mutate({ itemType, itemDescription, issueDescription }, {
      onSuccess: () => {
        setShowForm(false);
        setItemType("");
        setItemDescription("");
        setIssueDescription("");
      }
    });
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
          <form onSubmit={handleCreate} className="grid gap-4 max-w-xl">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Item Type</span>
              <input required type="text" className="input input-bordered rounded-xl bg-white" placeholder="e.g. Laptop, Commercial Oven" value={itemType} onChange={e => setItemType(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Item Description</span>
              <input required type="text" className="input input-bordered rounded-xl bg-white" placeholder="e.g. 15-inch gaming laptop" value={itemDescription} onChange={e => setItemDescription(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Issue Description</span>
              <textarea required className="textarea textarea-bordered rounded-xl bg-white" placeholder="Describe the problem..." value={issueDescription} onChange={e => setIssueDescription(e.target.value)} />
            </label>
            <button disabled={createRequest.isPending} type="submit" className="btn bg-slate-900 text-white hover:bg-slate-800 rounded-full w-max px-8">
              {createRequest.isPending ? "Creating..." : "Submit Request"}
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
            requests?.map((req) => <RequestRow key={req.id} request={req} />)
          )}
        </section>
      )}
    </div>
  );
}
