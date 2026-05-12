import { Link } from "react-router-dom";
import type { CustomerRequestDetailsData } from "./CustomerRequestDetailsShared";
import {
  EmptyState,
  MetricCard,
  Panel,
  formatCurrency,
  formatDate,
  formatDateTime,
  hasPendingManualReview,
  statusTone
} from "./CustomerRequestDetailsShared";

type CustomerRequestFinanceTabProps = {
  details: CustomerRequestDetailsData;
  tenantDomainSlug: string;
  isOpeningCheckout: boolean;
  onStartOnlinePayment: (invoiceId: string) => void;
};

export function CustomerRequestFinanceTab({
  details,
  tenantDomainSlug,
  isOpeningCheckout,
  onStartOnlinePayment
}: CustomerRequestFinanceTabProps) {
  const { request } = details;
  const invoice = request.invoice;
  const costSheet = request.costSheet;

  return (
    <Panel title="Costing and settlement" eyebrow="Commercial">
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
            <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <FinanceItem label="Invoice date" value={formatDate(invoice.invoiceDateUtc)} />
              <FinanceItem label="Subtotal" value={formatCurrency(invoice.subtotalAmount)} />
              <FinanceItem label={costSheet?.taxLabel ?? "Tax"} value={formatCurrency(invoice.taxAmount)} />
              <FinanceItem label="Discount" value={formatCurrency(invoice.discountAmount)} />
              <FinanceItem label="Outstanding" value={formatCurrency(invoice.outstandingAmount)} />
              <FinanceItem label="Settlement mode" value={invoice.hasMicroLoan ? "MLS loan account" : "Direct settlement"} />
              {invoice.hasMicroLoan ? (
                <FinanceItem label="Loan status" value={invoice.microLoanStatus ?? "In review"} />
              ) : null}
            </dl>
          </article>

          {invoice.lines.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {invoice.lines.map((line) => (
                <LineItemCard key={line.id} line={line} />
              ))}
            </div>
          ) : null}

          {invoice.paymentSubmissions.length ? (
            <div className="grid gap-3 rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Settlement history</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Submitted payment proofs and tenant finance review activity for this service invoice.
                </p>
              </div>

              <div className="grid gap-3">
                {invoice.paymentSubmissions.map((submission) => (
                  <article key={submission.id} className="rounded-[1.2rem] border border-slate-200/80 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{formatCurrency(submission.amountSubmitted)} submitted</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {submission.paymentMethod} / {submission.referenceNumber}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${statusTone(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <p>Submitted {formatDateTime(submission.submittedAtUtc)}</p>
                      {submission.approvedAmount != null ? (
                        <p className="text-slate-900">Approved amount: {formatCurrency(submission.approvedAmount)}</p>
                      ) : null}
                      {submission.reviewedAtUtc ? <p>Reviewed {formatDateTime(submission.reviewedAtUtc)}</p> : null}
                      {submission.note ? <p>{submission.note}</p> : null}
                      {submission.reviewRemarks ? (
                        <p className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-700">
                          {submission.reviewRemarks}
                        </p>
                      ) : null}
                      {submission.proofRelativeUrl ? (
                        <a
                          className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
                          href={submission.proofRelativeUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open {submission.proofOriginalFileName ?? "payment proof"}
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <p className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            {invoice.hasMicroLoan
              ? "This invoice has already been handed into MLS financing. Collections and amortization are tracked under the linked loan account."
              : invoice.invoiceStatus === "Checkout Pending"
                ? "An online Stripe Checkout session is already open for this invoice. Return to the invoice workspace after payment so the status can refresh."
                : invoice.canStartStripeCheckout
                  ? "You can pay this invoice online through Stripe Checkout now, or submit manual settlement proof from the invoice workspace."
                  : invoice.canSubmitPaymentProof
                    ? "You can now submit payment proof from the invoice workspace so the tenant finance team can review and clear this balance."
                    : hasPendingManualReview(invoice.paymentSubmissions)
                      ? "A settlement proof is pending tenant finance review. Watch the service timeline and settlement history for the next update."
                      : invoice.outstandingAmount > 0
                        ? "Finance review is still required before this invoice can be cleared."
                        : "This invoice is fully settled in the current tenant ledger."}
          </p>
          <div className="flex flex-wrap gap-2">
            {invoice.canStartStripeCheckout ? (
              <button
                type="button"
                className="btn rounded-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onStartOnlinePayment(invoice.id)}
                disabled={isOpeningCheckout}
              >
                {isOpeningCheckout ? "Opening checkout..." : "Pay online"}
              </button>
            ) : null}
            <Link
              className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
              to={`/t/${tenantDomainSlug}/c/invoices`}
            >
              Open invoices
            </Link>
          </div>
        </div>
      ) : costSheet ? (
        <div className="grid gap-4">
          <article className="rounded-[1.4rem] border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-900">
            <strong>Draft commercial breakdown</strong>
            <p className="mt-2">
              The tenant team is still updating this service cost sheet. Totals may change until the invoice is finalized.
            </p>
            <p className="mt-2 text-sky-700">
              Updated {formatDateTime(costSheet.updatedAtUtc)} / {costSheet.status}
            </p>
          </article>

          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Subtotal" value={formatCurrency(costSheet.subtotalAmount)} description="Current draft labor, parts, and service charges." />
            <MetricCard label={costSheet.taxLabel} value={formatCurrency(costSheet.taxAmount)} description={costSheet.isTaxEnabled ? `Applied at ${costSheet.taxRate}%` : "Not applied on this draft"} />
            <MetricCard label="Draft total" value={formatCurrency(costSheet.totalAmount)} description="Projected total before any final approval or invoice changes." />
          </div>

          {costSheet.notes ? (
            <p className="rounded-[1.4rem] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
              {costSheet.notes}
            </p>
          ) : null}

          {costSheet.lines.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {costSheet.lines.map((line) => (
                <LineItemCard key={line.id} line={line} />
              ))}
            </div>
          ) : (
            <EmptyState message="The tenant has not added any draft cost lines yet." />
          )}
        </div>
      ) : (
        <EmptyState message="A cost breakdown or finalized invoice has not been added for this request yet." />
      )}
    </Panel>
  );
}

function FinanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function LineItemCard({
  line
}: {
  line: {
    id: string;
    category: string;
    name: string;
    specification?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  };
}) {
  return (
    <article className="rounded-[1.4rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(35,46,76,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="text-slate-950">{line.name}</strong>
          <p className="mt-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-500">{line.category}</p>
        </div>
        <span className="font-semibold text-slate-950">{formatCurrency(line.lineTotal)}</span>
      </div>
      {line.specification ? <p className="mt-2 text-sm leading-6 text-slate-600">{line.specification}</p> : null}
      <p className="mt-2 text-xs text-slate-500">
        Qty {line.quantity} / Unit {formatCurrency(line.unitPrice)}
      </p>
    </article>
  );
}
