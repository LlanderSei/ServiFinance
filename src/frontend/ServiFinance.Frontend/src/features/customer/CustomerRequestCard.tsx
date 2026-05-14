import { Link } from "react-router-dom";
import type { CustomerRequest } from "./useCustomerRequests";

const historyStatuses = new Set(["Completed", "Closed", "Cancelled"]);

export function isHistoryRequest(status: string) {
  return historyStatuses.has(status);
}

export function isFeedbackExpired(feedbackExpiresAtUtc?: string | null) {
  return Boolean(feedbackExpiresAtUtc && new Date(feedbackExpiresAtUtc).getTime() < Date.now());
}

export function isCompletedOrClosedRequest(request: CustomerRequest) {
  return request.currentStatus === "Completed" || request.currentStatus === "Closed";
}

export function hasOpenFeedbackRequest(request: CustomerRequest) {
  return isCompletedOrClosedRequest(request) && request.rating == null && !isFeedbackExpired(request.feedbackExpiresAtUtc);
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(value?: string | null, fallback = "Unknown time") {
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

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("completed") || normalized.includes("closed")) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800";
  }

  if (normalized.includes("progress") || normalized.includes("service") || normalized.includes("scheduled")) {
    return "bg-blue-100 text-blue-800";
  }

  if (normalized.includes("pending") || normalized.includes("hold")) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

function buildRequestMeta(request: CustomerRequest) {
  if (request.currentStatus === "Cancelled") {
    return `Cancelled ${formatDateTime(request.cancelledAtUtc, formatDateTime(request.createdAtUtc))}`;
  }

  if (request.currentStatus === "Cancellation Requested") {
    return `Cancellation requested ${formatDateTime(request.cancellationRequestedAtUtc, formatDateTime(request.createdAtUtc))}`;
  }

  if ((request.currentStatus === "Completed" || request.currentStatus === "Closed") && request.completedAtUtc) {
    return `Completed ${formatDateTime(request.completedAtUtc)}`;
  }

  return `Opened ${formatDateTime(request.createdAtUtc)}`;
}

function RequestBadge({ request }: { request: CustomerRequest }) {
  if (request.rating != null) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">
        Rated {request.rating}/5
      </span>
    );
  }

  if (hasOpenFeedbackRequest(request)) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-700">
        Feedback open
      </span>
    );
  }

  return null;
}

type CustomerRequestCardProps = {
  request: CustomerRequest;
  tenantDomainSlug: string;
};

export function CustomerRequestCard({ request, tenantDomainSlug }: CustomerRequestCardProps) {
  const isOngoing = !isHistoryRequest(request.currentStatus);
  const actionLabel = isOngoing ? "Track request" : "View";
  const sourceTab = isOngoing ? "ongoing" : "history";

  return (
    <article className="rounded-[1.6rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(35,46,76,0.06)] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">{request.requestNumber}</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
            {request.itemType}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            {buildRequestMeta(request)}
          </p>
        </div>

        <span className={joinClasses(
          "rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
          statusTone(request.currentStatus)
        )}>
          {request.currentStatus}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-slate-200/80 pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <RequestBadge request={request} />
        </div>

        <Link
          className="btn btn-sm ml-auto shrink-0 rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
          to={`/t/${tenantDomainSlug}/c/requests/${request.id}?from=${sourceTab}`}
          state={{ requestsTab: sourceTab }}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
