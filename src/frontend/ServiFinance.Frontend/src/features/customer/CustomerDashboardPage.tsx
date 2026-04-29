import { getCurrentCustomerSession } from "./customerAuth";

function formatSignedInDate(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function CustomerDashboardPage() {
  const session = getCurrentCustomerSession();
  const user = session?.user;

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(12,22,46,0.96),rgba(26,69,188,0.9))] px-6 py-7 text-white shadow-[0_22px_48px_rgba(27,45,100,0.14)]">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.22em] text-white/62">Customer dashboard</p>
        <h1 className="mt-3 text-[clamp(2.4rem,4vw,3.9rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-balance">
          {user ? `${user.fullName.split(" ")[0]}, your customer portal is ready.` : "Customer workspace"}
        </h1>
        <p className="mt-4 max-w-[38rem] text-base leading-7 text-white/74">
          This working slice gives the customer portal its own authenticated shell, route boundary, and mobile drawer before the request, invoice, and feedback APIs are connected.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Account</span>
          <strong className="mt-3 block text-2xl tracking-[-0.04em] text-slate-950">{user?.fullName ?? "Customer"}</strong>
          <p className="mt-2 text-sm leading-6 text-slate-600">{user?.email}</p>
        </article>
        <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Contact</span>
          <strong className="mt-3 block text-2xl tracking-[-0.04em] text-slate-950">-</strong>
          <p className="mt-2 text-sm leading-6 text-slate-600">Contact details not available</p>
        </article>
        <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Session</span>
          <strong className="mt-3 block text-2xl tracking-[-0.04em] text-slate-950">Active</strong>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Signed in just now.
          </p>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Implementation slice</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">What is live now</h2>
          <ul className="mt-5 grid gap-4 p-0 text-sm leading-6 text-slate-600">
            <li className="rounded-[1.4rem] bg-slate-50 px-4 py-4">Tenant-scoped customer login and registration routes under `/t/&lbrace;tenant&rbrace;/c/*`.</li>
            <li className="rounded-[1.4rem] bg-slate-50 px-4 py-4">Responsive customer shell with left drawer navigation for mobile screens.</li>
            <li className="rounded-[1.4rem] bg-slate-50 px-4 py-4">Protected customer dashboard, requests, invoices, and feedback surfaces ready for data wiring.</li>
          </ul>
        </article>

        <article className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Next backend hook</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Ready to connect</h2>
          <div className="mt-5 grid gap-4 text-sm leading-6 text-slate-600">
            <div className="rounded-[1.4rem] border border-slate-200 px-4 py-4">
              Service request list and per-request live status timeline
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 px-4 py-4">
              Invoice view, payment readiness, and customer settlement actions
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 px-4 py-4">
              Post-completion ratings and feedback capture for finished service work
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
