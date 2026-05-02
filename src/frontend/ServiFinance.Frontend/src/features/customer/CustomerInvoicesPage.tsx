import { Link, useParams } from "react-router-dom";
import { useCustomerInvoices } from "./useCustomerInvoices";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

function describeSettlement(invoiceStatus: string, outstandingAmount: number, hasMicroLoan: boolean, microLoanStatus?: string | null) {
  if (hasMicroLoan) {
    return microLoanStatus ? `Converted to MLS loan: ${microLoanStatus}` : "Converted to MLS loan account";
  }

  if (invoiceStatus === "Paid" || outstandingAmount <= 0) {
    return "Settled and cleared in the tenant ledger.";
  }

  return "Direct online payment is not enabled yet. Watch this status for cashier or finance confirmation.";
}

export function CustomerInvoicesPage() {
  const { tenantDomainSlug = "" } = useParams();
  const { data: invoices, isLoading } = useCustomerInvoices();

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Invoices</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Service invoices</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          Review finalized invoices, current settlement state, and any linked service-request tracking from one customer workspace.
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
            invoices?.map((invoice) => (
              <article key={invoice.id} className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{invoice.invoiceNumber}</p>
                    <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
                      {formatCurrency(invoice.totalAmount)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(invoice.invoiceDateUtc).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                      {invoice.serviceRequestNumber && ` • For ${invoice.serviceRequestNumber}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {invoice.invoiceStatus}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="block text-xs uppercase tracking-wider text-slate-500">Outstanding</span>
                    <strong className="text-slate-900">{formatCurrency(invoice.outstandingAmount)}</strong>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {describeSettlement(invoice.invoiceStatus, invoice.outstandingAmount, invoice.hasMicroLoan, invoice.microLoanStatus)}
                  </p>
                  {invoice.serviceRequestId && (
                    <Link
                      className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
                      to={`/t/${tenantDomainSlug}/c/requests/${invoice.serviceRequestId}`}
                    >
                      Track linked request
                    </Link>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
