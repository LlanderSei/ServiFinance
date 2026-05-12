import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  type CustomerInvoice,
  type CustomerInvoicePaymentSubmission,
  useCreateCustomerInvoiceStripeCheckout,
  useCustomerInvoices,
  useSyncCustomerInvoiceStripeCheckout,
  useSubmitCustomerInvoicePaymentProof
} from "./useCustomerInvoices";
import { useToast } from "@/shared/toast/ToastProvider";
import { UploadProgressBar } from "@/shared/uploads/UploadProgressBar";

const paymentMethodOptions = [
  "GCash",
  "Maya",
  "Bank transfer",
  "Cash deposit",
  "Over-the-counter",
  "Other"
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not yet reviewed";
  }

  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("partial")) {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized.includes("paid") || normalized.includes("approved")) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized.includes("submitted") || normalized.includes("review")) {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized.includes("checkout")) {
    return "bg-sky-100 text-sky-700";
  }

  if (normalized.includes("reject")) {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

function hasPendingManualReview(invoice: CustomerInvoice) {
  return invoice.paymentSubmissions.some((submission) =>
    submission.status === "Payment Submitted" || submission.status === "Pending Review"
  );
}

function describeSettlement(invoice: CustomerInvoice) {
  if (invoice.hasMicroLoan) {
    return invoice.microLoanStatus
      ? `Converted to MLS loan: ${invoice.microLoanStatus}`
      : "Converted to MLS loan account";
  }

  if (invoice.outstandingAmount <= 0 || invoice.invoiceStatus === "Paid") {
    return "Settled and cleared in the tenant ledger.";
  }

  if (invoice.invoiceStatus === "Checkout Pending") {
    return "An online Stripe Checkout session is in progress for this invoice.";
  }

  if (invoice.canStartStripeCheckout) {
    return "Pay the full invoice online through Stripe Checkout or submit manual proof for offline settlement.";
  }

  if (invoice.canSubmitPaymentProof) {
    return "Submit your transfer receipt or payment proof here for tenant finance review.";
  }

  if (hasPendingManualReview(invoice)) {
    return "A settlement proof is already pending tenant finance review.";
  }

  return "Finance review is required before this invoice can be cleared.";
}

function buildInitialAmount(invoice: CustomerInvoice) {
  return invoice.outstandingAmount > 0 ? invoice.outstandingAmount.toFixed(2) : "";
}

export function CustomerInvoicesPage() {
  const { tenantDomainSlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { data: invoices, isLoading } = useCustomerInvoices();
  const submitPaymentProof = useSubmitCustomerInvoicePaymentProof();
  const createStripeCheckout = useCreateCustomerInvoiceStripeCheckout();
  const syncStripeCheckout = useSyncCustomerInvoiceStripeCheckout();
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [amountSubmitted, setAmountSubmitted] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethodOptions[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploadProgress, setProofUploadProgress] = useState<number | null>(null);
  const handledCheckoutTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const invoiceId = searchParams.get("invoice_id");
    const sessionId = searchParams.get("session_id");
    const redirectPath = `/t/${tenantDomainSlug}/c/invoices`;

    if (checkoutState === "canceled") {
      if (handledCheckoutTokenRef.current !== "canceled") {
        handledCheckoutTokenRef.current = "canceled";
        toast.info({
          title: "Checkout canceled",
          message: "The online payment window was closed before completion."
        });
      }
      navigate(redirectPath, { replace: true });
      return;
    }

    if (checkoutState !== "success" || !invoiceId || !sessionId) {
      return;
    }

    const checkoutToken = `${invoiceId}:${sessionId}`;
    if (handledCheckoutTokenRef.current === checkoutToken) {
      return;
    }
    handledCheckoutTokenRef.current = checkoutToken;

    syncStripeCheckout.mutate(
      { invoiceId, checkoutSessionId: sessionId },
      {
        onSuccess: (response) => {
          toast.success({
            title: response.paymentApplied ? "Online payment confirmed" : "Checkout synced",
            message: response.paymentApplied
              ? "Stripe confirmed the invoice payment and the outstanding balance has been refreshed."
              : "The checkout was synced, but this invoice is still waiting for a completed payment event."
          });
          navigate(redirectPath, { replace: true });
        },
        onError: (error) => {
          toast.error({
            title: "Unable to sync Stripe checkout",
            message: error.message
          });
          navigate(redirectPath, { replace: true });
        }
      }
    );
  }, [navigate, searchParams, syncStripeCheckout, tenantDomainSlug, toast]);

  function openSubmissionForm(invoice: CustomerInvoice) {
    setActiveInvoiceId(invoice.id);
    setAmountSubmitted(buildInitialAmount(invoice));
    setPaymentMethod(paymentMethodOptions[0]);
    setReferenceNumber("");
    setNote("");
    setProofFile(null);
    setProofUploadProgress(null);
  }

  function closeSubmissionForm() {
    setActiveInvoiceId(null);
    setAmountSubmitted("");
    setPaymentMethod(paymentMethodOptions[0]);
    setReferenceNumber("");
    setNote("");
    setProofFile(null);
    setProofUploadProgress(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>, invoice: CustomerInvoice) {
    event.preventDefault();

    if (!proofFile) {
      return;
    }

    const payload = new FormData();
    payload.append("AmountSubmitted", amountSubmitted);
    payload.append("PaymentMethod", paymentMethod);
    payload.append("ReferenceNumber", referenceNumber);
    payload.append("Note", note);
    payload.append("ProofFile", proofFile);
    setProofUploadProgress(0);

    submitPaymentProof.mutate(
      {
        invoiceId: invoice.id,
        serviceRequestId: invoice.serviceRequestId,
        payload,
        onProgress: setProofUploadProgress
      },
      {
        onSuccess: () => {
          closeSubmissionForm();
        },
        onSettled: () => {
          setProofUploadProgress(null);
        }
      }
    );
  }

  function handleStartOnlinePayment(invoice: CustomerInvoice) {
    createStripeCheckout.mutate(
      { invoiceId: invoice.id },
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

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Invoices</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Service invoices</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          Review finalized invoices, submit settlement proof, and track finance review without leaving the customer workspace.
        </p>
      </section>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading invoices...</div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {invoices?.length === 0 ? (
            <div className="md:col-span-2 rounded-[1.8rem] border border-slate-200 border-dashed p-8 text-center text-slate-500">
              You don't have any invoices yet.
            </div>
          ) : (
            invoices?.map((invoice) => {
              const isFormOpen = activeInvoiceId === invoice.id;

              return (
                <article key={invoice.id} className="grid gap-4 rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{invoice.invoiceNumber}</p>
                      <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
                        {formatCurrency(invoice.totalAmount)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(invoice.invoiceDateUtc).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                        {invoice.serviceRequestNumber ? ` / ${invoice.serviceRequestNumber}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(invoice.invoiceStatus)}`}>
                      {invoice.invoiceStatus}
                    </span>
                  </div>

                  <div className="grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs uppercase tracking-wider text-slate-500">Outstanding</span>
                      <strong className="text-slate-900">{formatCurrency(invoice.outstandingAmount)}</strong>
                    </div>
                    <p className="leading-6">{describeSettlement(invoice)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {invoice.canStartStripeCheckout ? (
                      <button
                        type="button"
                        className="btn btn-sm rounded-full bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => handleStartOnlinePayment(invoice)}
                        disabled={createStripeCheckout.isPending}
                      >
                        {createStripeCheckout.isPending ? "Opening checkout..." : "Pay online"}
                      </button>
                    ) : null}
                    {invoice.canSubmitPaymentProof ? (
                      <button
                        type="button"
                        className="btn btn-sm rounded-full bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => isFormOpen ? closeSubmissionForm() : openSubmissionForm(invoice)}
                      >
                        {isFormOpen ? "Hide settlement form" : "Submit payment proof"}
                      </button>
                    ) : null}
                    {invoice.serviceRequestId ? (
                      <Link
                        className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
                        to={`/t/${tenantDomainSlug}/c/requests/${invoice.serviceRequestId}`}
                      >
                        View linked request
                      </Link>
                    ) : null}
                  </div>

                  {isFormOpen ? (
                    <form
                      className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"
                      onSubmit={(event) => handleSubmit(event, invoice)}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Settlement proof</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Upload an image or PDF receipt. Tenant finance reviews one settlement proof at a time for this invoice.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">Amount submitted</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="input input-bordered w-full rounded-xl bg-white"
                            value={amountSubmitted}
                            onChange={(event) => setAmountSubmitted(event.target.value)}
                            required
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">Payment method</span>
                          <select
                            className="select select-bordered w-full rounded-xl bg-white"
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value)}
                          >
                            {paymentMethodOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">Reference number</span>
                          <input
                            className="input input-bordered w-full rounded-xl bg-white"
                            value={referenceNumber}
                            onChange={(event) => setReferenceNumber(event.target.value)}
                            required
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">Proof file</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="file-input file-input-bordered w-full rounded-xl bg-white"
                            onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                            required
                          />
                        </label>
                      </div>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Note (optional)</span>
                        <textarea
                          className="textarea textarea-bordered min-h-28 w-full rounded-xl bg-white"
                          placeholder="Any cashier note, sender name, or settlement context."
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </label>

                      {!proofFile ? (
                        <p className="text-sm text-slate-500">
                          Attach the receipt or proof before submitting.
                        </p>
                      ) : null}

                      {submitPaymentProof.isPending && isFormOpen ? (
                        <UploadProgressBar label="Uploading settlement proof" progress={proofUploadProgress} />
                      ) : null}

                      {submitPaymentProof.isError && isFormOpen ? (
                        <p className="text-sm text-rose-600">{submitPaymentProof.error.message}</p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="btn rounded-full bg-slate-900 text-white hover:bg-slate-800"
                          disabled={submitPaymentProof.isPending || !proofFile}
                        >
                          {submitPaymentProof.isPending ? "Submitting..." : "Send for review"}
                        </button>
                        <button
                          type="button"
                          className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100"
                          onClick={closeSubmissionForm}
                          disabled={submitPaymentProof.isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {invoice.paymentSubmissions.length ? (
                    <div className="grid gap-3 rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-4">
                      <div>
                        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Settlement history</p>
                        <p className="mt-1 text-sm text-slate-600">Customer-submitted proofs and tenant finance review outcomes for this invoice.</p>
                      </div>

                      <div className="grid gap-3">
                        {invoice.paymentSubmissions.map((submission) => (
                          <InvoiceSubmissionCard key={submission.id} submission={submission} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}

function InvoiceSubmissionCard({ submission }: { submission: CustomerInvoicePaymentSubmission }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200/80 bg-white px-4 py-4">
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
        {submission.reviewedAtUtc ? (
          <p>Reviewed {formatDateTime(submission.reviewedAtUtc)}</p>
        ) : null}
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
  );
}
