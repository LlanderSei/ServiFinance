export function CustomerRequestsPage() {
  const items = [
    {
      code: "SR-24018",
      item: "Gaming laptop cooling service",
      status: "In Progress",
      update: "Technician evidence and work-status feed will appear here once customer APIs are wired."
    },
    {
      code: "SR-24009",
      item: "Display panel replacement",
      status: "Ready for invoice",
      update: "Invoice readiness and finance handoff status will surface from the SMS-side service record."
    }
  ];

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer requests</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">My service requests</h1>
        <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
          This screen is ready for customer-owned request history, timeline visibility, and service tracking endpoints.
        </p>
      </section>

      <section className="grid gap-4">
        {items.map((item) => (
          <article key={item.code} className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{item.code}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{item.item}</h2>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                {item.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{item.update}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
