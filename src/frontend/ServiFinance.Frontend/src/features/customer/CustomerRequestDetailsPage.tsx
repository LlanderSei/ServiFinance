import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, Clock, CreditCard, Image, Truck } from "lucide-react";
import { useToast } from "@/shared/toast/ToastProvider";
import { CustomerBottomTabs } from "./CustomerBottomTabs";
import { useCreateCustomerInvoiceStripeCheckout } from "./useCustomerInvoices";
import { useCancelCustomerRequest, useCustomerRequestDetails, useSubmitCustomerFeedback } from "./useCustomerRequests";
import { CustomerRequestDispatchTab } from "./request-details/CustomerRequestDispatchTab";
import { CustomerRequestEvidenceTab } from "./request-details/CustomerRequestEvidenceTab";
import { CustomerRequestFinanceTab } from "./request-details/CustomerRequestFinanceTab";
import { CustomerRequestOverviewTab } from "./request-details/CustomerRequestOverviewTab";
import { CustomerRequestTimelineTab } from "./request-details/CustomerRequestTimelineTab";
import { statusTone } from "./request-details/CustomerRequestDetailsShared";

type TrackingTab = "overview" | "dispatch" | "finance" | "evidence" | "timeline";

export function CustomerRequestDetailsPage() {
  const { requestId = "", tenantDomainSlug = "" } = useParams();
  const toast = useToast();
  const detailsQuery = useCustomerRequestDetails(requestId || null);
  const cancelRequest = useCancelCustomerRequest();
  const submitFeedback = useSubmitCustomerFeedback();
  const createStripeCheckout = useCreateCustomerInvoiceStripeCheckout();
  const [activeTab, setActiveTab] = useState<TrackingTab>("overview");
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("");

  function handleStartOnlinePayment(invoiceId: string) {
    createStripeCheckout.mutate(
      { invoiceId },
      {
        onSuccess: (response) => {
          window.location.assign(response.checkoutUrl);
        },
        onError: (error) => {
          toast.error({
            title: "Unable to open Stripe Checkout",
            message: error.message
          });
        }
      }
    );
  }

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

  const details = detailsQuery.data;
  const { request, timeline, assignments, attachments } = details;
  const tabOptions = [
    { key: "overview" as const, label: "Overview", icon: Activity },
    { key: "dispatch" as const, label: "Dispatch", count: assignments.length, icon: Truck },
    { key: "finance" as const, label: "Finance", count: request.invoice ? 1 : request.costSheet ? 1 : 0, icon: CreditCard },
    { key: "evidence" as const, label: "Evidence", count: attachments.length, icon: Image },
    { key: "timeline" as const, label: "Timeline", count: timeline.length, icon: Clock }
  ];

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Request tracking</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{request.requestNumber}</h1>
            <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
              Follow request movement through focused tabs for overview, dispatch, finance, evidence, and timeline updates.
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
      </section>

      {activeTab === "overview" ? (
        <CustomerRequestOverviewTab
          details={details}
          cancelReason={cancelReason}
          cancelError={cancelRequest.error?.message}
          isCancelling={cancelRequest.isPending}
          onCancelReasonChange={setCancelReason}
          onCancelSubmit={() => cancelRequest.mutate({ id: request.id, reason: cancelReason })}
        />
      ) : null}

      {activeTab === "dispatch" ? (
        <CustomerRequestDispatchTab assignments={assignments} />
      ) : null}

      {activeTab === "finance" ? (
        <CustomerRequestFinanceTab
          details={details}
          tenantDomainSlug={tenantDomainSlug}
          isOpeningCheckout={createStripeCheckout.isPending}
          onStartOnlinePayment={handleStartOnlinePayment}
        />
      ) : null}

      {activeTab === "evidence" ? (
        <CustomerRequestEvidenceTab attachments={attachments} />
      ) : null}

      {activeTab === "timeline" ? (
        <CustomerRequestTimelineTab
          request={request}
          timeline={timeline}
          rating={rating}
          feedbackComments={feedbackComments}
          suggestionCategory={suggestionCategory}
          isSubmittingFeedback={submitFeedback.isPending}
          hasFeedbackError={submitFeedback.isError}
          onRatingChange={setRating}
          onFeedbackCommentsChange={setFeedbackComments}
          onSuggestionCategoryChange={setSuggestionCategory}
          onSubmitFeedback={() => submitFeedback.mutate({
            id: request.id,
            rating,
            feedbackComments,
            suggestionCategory
          })}
        />
      ) : null}

      <CustomerBottomTabs tabs={tabOptions} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
