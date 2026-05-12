import type { FormEvent } from "react";
import type { CustomerRequestDetailsData } from "./CustomerRequestDetailsShared";
import {
  EmptyState,
  MetricCard,
  Panel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRequestAddress,
  formatScheduleRange
} from "./CustomerRequestDetailsShared";

type CustomerRequestOverviewTabProps = {
  details: CustomerRequestDetailsData;
  cancelReason: string;
  cancelError?: string;
  isCancelling: boolean;
  onCancelReasonChange: (value: string) => void;
  onCancelSubmit: () => void;
};

export function CustomerRequestOverviewTab({
  details,
  cancelReason,
  cancelError,
  isCancelling,
  onCancelReasonChange,
  onCancelSubmit
}: CustomerRequestOverviewTabProps) {
  const { request } = details;
  const invoice = request.invoice;
  const costSheet = request.costSheet;

  function handleCancelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCancelSubmit();
  }

  return (
    <div className="grid min-w-0 max-w-full gap-5">
      <section className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-2 md:overflow-visible md:pb-0">
        <div className="flex w-max max-w-none gap-3 pr-6 md:grid md:w-full md:max-w-full md:grid-cols-2 md:gap-4 md:pr-0 xl:grid-cols-5">
          <MetricCard className="w-[min(17rem,calc(100vw-4rem))] max-w-[17rem] shrink-0 md:w-auto md:max-w-none" label="Item" value={request.itemType} description={request.itemDescription} />
          <MetricCard className="w-[min(17rem,calc(100vw-4rem))] max-w-[17rem] shrink-0 md:w-auto md:max-w-none" label="Priority" value={request.priority} description={`Opened ${formatDateTime(request.createdAtUtc)}`} />
          <MetricCard
            className="w-[min(17rem,calc(100vw-4rem))] max-w-[17rem] shrink-0 md:w-auto md:max-w-none"
            label="Service mode"
            value={request.serviceMode || "Drop-off"}
            description={formatRequestAddress(request)}
          />
          <MetricCard
            className="w-[min(17rem,calc(100vw-4rem))] max-w-[17rem] shrink-0 md:w-auto md:max-w-none"
            label="Needed by"
            value={formatDate(request.neededByUtc ?? request.requestedServiceDate)}
            description={formatScheduleRange(request.preferredScheduleStartUtc, request.preferredScheduleEndUtc)}
          />
          <MetricCard
            className="w-[min(17rem,calc(100vw-4rem))] max-w-[17rem] shrink-0 md:w-auto md:max-w-none"
            label="Finance"
            value={invoice ? invoice.invoiceStatus : costSheet ? `${costSheet.status} draft` : "Not invoiced"}
            description={
              invoice
                ? `${formatCurrency(invoice.outstandingAmount)} outstanding`
                : costSheet
                  ? `${formatCurrency(costSheet.totalAmount)} draft total`
                  : "Invoice will appear here after tenant finalization."
            }
          />
        </div>
      </section>

      <Panel title="Issue summary" eyebrow="Intake">
        <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{request.issueDescription}</p>
      </Panel>

      <Panel title="Visit and contact" eyebrow="Customer logistics">
        <dl className="grid min-w-0 gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <dt className="font-semibold text-slate-900">Service mode</dt>
            <dd className="mt-2 min-w-0 break-words [overflow-wrap:anywhere]">{request.serviceMode || "Drop-off"}</dd>
          </div>
          <div className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <dt className="font-semibold text-slate-900">Contact</dt>
            <dd className="mt-2 min-w-0 break-words [overflow-wrap:anywhere]">
              {request.contactName || "Not provided"}
              {request.contactPhone ? ` / ${request.contactPhone}` : ""}
            </dd>
          </div>
          <div className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 md:col-span-2">
            <dt className="font-semibold text-slate-900">Service address</dt>
            <dd className="mt-2 min-w-0 break-words [overflow-wrap:anywhere]">{formatRequestAddress(request)}</dd>
          </div>
          <div className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <dt className="font-semibold text-slate-900">Preferred schedule</dt>
            <dd className="mt-2 min-w-0 break-words [overflow-wrap:anywhere]">{formatScheduleRange(request.preferredScheduleStartUtc, request.preferredScheduleEndUtc)}</dd>
          </div>
          <div className="min-w-0 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <dt className="font-semibold text-slate-900">Needed by</dt>
            <dd className="mt-2 min-w-0 break-words [overflow-wrap:anywhere]">{formatDateTime(request.neededByUtc, "No due preference")}</dd>
          </div>
        </dl>
      </Panel>

      {(request.canCancelDirectly || request.canRequestCancellation || request.cancellationReason) ? (
        <Panel title="Cancellation" eyebrow="Request control">
          {request.cancellationReason ? (
            <div className="min-w-0 break-words rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800 [overflow-wrap:anywhere]">
              <strong>{request.cancelledAtUtc ? "Cancelled" : "Cancellation note"}:</strong> {request.cancellationReason}
              {request.cancellationRequestedAtUtc ? <p className="mt-1">Requested {formatDateTime(request.cancellationRequestedAtUtc)}</p> : null}
              {request.cancelledAtUtc ? <p className="mt-1">Cancelled {formatDateTime(request.cancelledAtUtc)}</p> : null}
            </div>
          ) : null}
          {(request.canCancelDirectly || request.canRequestCancellation) ? (
            <form
              className="mt-4 grid gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"
              onSubmit={handleCancelSubmit}
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
                onChange={(event) => onCancelReasonChange(event.target.value)}
                required
              />
              {cancelError ? <p className="text-sm text-rose-600">{cancelError}</p> : null}
              <button className="btn w-full rounded-full bg-rose-600 text-white hover:bg-rose-700 sm:w-max" disabled={isCancelling}>
                {isCancelling ? "Sending..." : request.canCancelDirectly ? "Cancel request" : "Send cancellation request"}
              </button>
            </form>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Cancellation" eyebrow="Request control">
          <EmptyState message="This request is no longer cancellable from the customer portal." />
        </Panel>
      )}
    </div>
  );
}
