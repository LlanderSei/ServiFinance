export function CustomerInvoicesPage() {
  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Invoices</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Service invoices</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          This workspace will host customer invoice review, payment status, and future settlement flows without exposing MLS staff operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Invoice placeholder</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Invoice list</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Finalized service invoices will be listed here by tenant-scoped customer account.</p>
        </article>

        <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Payment placeholder</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Settlement actions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Payment readiness, proof submission, or online checkout handoff can plug into this panel next.</p>
        </article>
      </section>
    </div>
  );
}
