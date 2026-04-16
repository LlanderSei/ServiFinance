export function CustomerFeedbackPage() {
  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Feedback</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Ratings and follow-up</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          Customer feedback will stay tenant-scoped and can later flow back into SMS-side reporting once the service completion API is connected.
        </p>
      </section>

      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 px-5 py-10 text-center shadow-[0_14px_30px_rgba(35,46,76,0.04)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Next slice</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Completion-linked feedback form</h2>
        <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-slate-600">
          Add a rating selector, service notes, and submission endpoint here once completed-request gating is available on the customer portal API.
        </p>
      </section>
    </div>
  );
}
