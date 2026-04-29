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
    </div>
  );
}
