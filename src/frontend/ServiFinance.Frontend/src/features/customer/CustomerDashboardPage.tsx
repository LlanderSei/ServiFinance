import { Link, useParams } from "react-router-dom";
import { getCurrentCustomerSession } from "./customerAuth";
import { useCustomerRequests } from "./useCustomerRequests";
import { useCustomerInvoices } from "./useCustomerInvoices";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(value);
}

export function CustomerDashboardPage() {
  const { tenantDomainSlug = "" } = useParams();
  const session = getCurrentCustomerSession();
  const user = session?.user;
  const requestsQuery = useCustomerRequests();
  const invoicesQuery = useCustomerInvoices();

  const requests = requestsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const activeRequests = requests.filter((item) => item.currentStatus !== "Completed" && item.currentStatus !== "Closed").length;
  const pendingFeedback = requests.filter((item) => (item.currentStatus === "Completed" || item.currentStatus === "Closed") && item.rating == null).length;
  const outstandingBalance = invoices.reduce((sum, item) => sum + item.outstandingAmount, 0);

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(12,22,46,0.96),rgba(26,69,188,0.9))] px-6 py-7 text-white shadow-[0_22px_48px_rgba(27,45,100,0.14)]">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.22em] text-white/62">Customer dashboard</p>
        <h1 className="mt-3 text-[clamp(2.4rem,4vw,3.9rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-balance">
          {user ? `${user.fullName.split(" ")[0]}, your service updates are live.` : "Customer workspace"}
        </h1>
        <p className="mt-4 max-w-[40rem] text-base leading-7 text-white/74">
          Review active service requests, finance handoff progress, invoice settlement state, and pending feedback from one tenant-scoped portal.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open requests" value={String(activeRequests)} description="Requests that are still awaiting closure or completion." />
        <MetricCard label="Invoices" value={String(invoices.length)} description="Finalized or in-progress invoices tied to this customer account." />
        <MetricCard label="Outstanding" value={formatCurrency(outstandingBalance)} description="Current unsettled balance across visible customer invoices." />
        <MetricCard label="Pending feedback" value={String(pendingFeedback)} description="Completed jobs that still need a customer rating or comment." />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)]">
        <article className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Account</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{user?.fullName ?? "Customer"}</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Tenant scope</dt>
              <dd className="text-right font-medium text-slate-900">{tenantDomainSlug}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-right font-medium text-slate-900">{user?.email ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Session surface</dt>
              <dd className="text-right font-medium text-slate-900">{user?.surface ?? "CustomerWeb"}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
          <div className="mt-5 grid gap-3">
            <Link className="btn rounded-full bg-slate-900 text-white hover:bg-slate-800 no-underline" to={`/t/${tenantDomainSlug}/c/requests`}>
              Review my requests
            </Link>
            <Link className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline" to={`/t/${tenantDomainSlug}/c/invoices`}>
              Check invoices
            </Link>
            <Link className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline" to={`/t/${tenantDomainSlug}/c/feedback`}>
              Leave feedback
            </Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            Customer access stays isolated to this tenant domain. Signing in here does not expose records from any other tenant workspace.
          </p>
        </article>
      </section>
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <article className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
      <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <strong className="mt-3 block text-2xl tracking-[-0.04em] text-slate-950">{value}</strong>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
