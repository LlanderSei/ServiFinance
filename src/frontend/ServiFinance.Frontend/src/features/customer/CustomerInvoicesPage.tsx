import { useCustomerInvoices } from "./useCustomerInvoices";

export function CustomerInvoicesPage() {
  const { data: invoices, isLoading } = useCustomerInvoices();

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Invoices</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Service invoices</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          Review your finalized service invoices, payment status, and balances here.
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
              <article key={invoice.id} className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)] flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{invoice.invoiceNumber}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {invoice.invoiceStatus}
                    </span>
                  </div>
                  <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
                    PHP {invoice.totalAmount.toLocaleString()}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(invoice.invoiceDateUtc).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                    {invoice.serviceRequestNumber && ` • For ${invoice.serviceRequestNumber}`}
                  </p>
                </div>
                
                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-slate-500 block text-xs uppercase tracking-wider">Outstanding</span>
                    <strong className="text-slate-900">PHP {invoice.outstandingAmount.toLocaleString()}</strong>
                  </div>
                  {invoice.outstandingAmount > 0 && invoice.invoiceStatus !== "Paid" && (
                    <button className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 border-none rounded-xl">
                      Pay Now
                    </button>
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
