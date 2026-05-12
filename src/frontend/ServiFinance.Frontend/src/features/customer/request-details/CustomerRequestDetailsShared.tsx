import type { ReactNode } from "react";
import { formatFullAddress } from "@/shared/location/formatAddress";
import type {
  CustomerRequest,
  CustomerRequestDetailsResponse
} from "../useCustomerRequests";

export type CustomerRequestDetailsData = CustomerRequestDetailsResponse;

export const feedbackSuggestionOptions = [
  "Service quality",
  "Technician conduct",
  "Scheduling",
  "Pricing or billing",
  "Follow-up",
  "Other suggestion"
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDateTime(value?: string | null, fallback = "Not scheduled") {
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

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

export function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("partial")) {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized.includes("completed") || normalized.includes("paid") || normalized.includes("closed")) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-700";
  }

  if (normalized.includes("progress") || normalized.includes("service")) {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized.includes("hold") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function hasPendingManualReview(statuses: Array<{ status: string }>) {
  return statuses.some((submission) =>
    submission.status === "Payment Submitted" || submission.status === "Pending Review"
  );
}

export function isFeedbackExpired(feedbackExpiresAtUtc?: string | null) {
  return Boolean(feedbackExpiresAtUtc && new Date(feedbackExpiresAtUtc).getTime() < Date.now());
}

export function formatScheduleRange(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "No preferred schedule";
  }

  if (start && end) {
    return `${formatDateTime(start)} to ${formatDateTime(end)}`;
  }

  return formatDateTime(start ?? end);
}

export function formatRequestAddress(request: CustomerRequest) {
  return formatFullAddress(request.serviceAddress, request.serviceAddressDetails);
}

export function MetricCard({
  label,
  value,
  description,
  className
}: {
  label: string;
  value: string;
  description: string;
  className?: string;
}) {
  return (
    <article className={joinClasses("min-w-0 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-slate-50 px-4 py-4", className)}>
      <p className="min-w-0 break-words text-[0.68rem] font-bold uppercase tracking-[0.2em] text-slate-500 [overflow-wrap:anywhere]">{label}</p>
      <strong className="mt-3 block break-words text-lg tracking-[-0.03em] text-slate-950 [overflow-wrap:anywhere]">{value}</strong>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{description}</p>
    </article>
  );
}

export function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
      <p className="min-w-0 break-words text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500 [overflow-wrap:anywhere]">{eyebrow}</p>
      <h2 className="mt-2 min-w-0 break-words text-2xl font-semibold tracking-[-0.04em] text-slate-950 [overflow-wrap:anywhere]">{title}</h2>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="min-w-0 break-words rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
      {message}
    </div>
  );
}
