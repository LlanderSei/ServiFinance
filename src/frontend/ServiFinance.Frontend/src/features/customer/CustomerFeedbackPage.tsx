import { useCustomerRequests } from "./useCustomerRequests";
import { Link } from "react-router-dom";
import { getCurrentCustomerSession } from "./customerAuth";

export function CustomerFeedbackPage() {
  const { data: requests, isLoading } = useCustomerRequests();
  const session = getCurrentCustomerSession();

  const requestsNeedingFeedback = requests?.filter(
    r => (r.currentStatus === "Completed" || r.currentStatus === "Closed") && r.rating == null
  ) || [];

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Feedback</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Ratings and follow-up</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          We value your feedback. Please rate any completed service requests so we can continue to improve.
        </p>
      </section>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : requestsNeedingFeedback.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 px-5 py-10 text-center shadow-[0_14px_30px_rgba(35,46,76,0.04)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-emerald-600">All Caught Up</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">No pending feedback</h2>
          <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-slate-600">
            You don't have any completed service requests awaiting feedback.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 px-2">Awaiting Your Review</h2>
          {requestsNeedingFeedback.map(request => (
            <article key={request.id} className="rounded-[1.8rem] border border-amber-200/80 bg-amber-50/50 px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)] flex justify-between items-center">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{request.requestNumber}</p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{request.itemType}</h3>
              </div>
               <Link to={`/t/${session?.user?.tenantDomainSlug}/c/requests`} className="btn bg-slate-900 text-white rounded-xl hover:bg-slate-800">
                Leave Feedback
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
