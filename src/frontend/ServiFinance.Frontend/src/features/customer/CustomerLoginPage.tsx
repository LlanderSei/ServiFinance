import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getCurrentCustomerSession, loginCustomerAccount } from "./customerAuth";
import { getCustomerHomeRoute } from "./customerNav";

export function CustomerLoginPage() {
  const { tenantDomainSlug = "" } = useParams();
  const navigate = useNavigate();
  const currentSession = getCurrentCustomerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (currentSession && currentSession.user.tenantDomainSlug.toLowerCase() === tenantDomainSlug.toLowerCase()) {
    return <Navigate to={getCustomerHomeRoute(currentSession.user)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const session = await loginCustomerAccount({
        tenantDomainSlug,
        email,
        password
      });
      navigate(getCustomerHomeRoute(session), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_24rem]">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(17,29,63,0.96),rgba(39,72,171,0.92))] px-6 py-7 text-white shadow-[0_20px_50px_rgba(29,47,105,0.18)] sm:px-8 sm:py-9">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.22em] text-white/68">Customer Login</p>
        <h1 className="mt-3 max-w-[12ch] text-[clamp(2.5rem,5vw,4.3rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-balance">
          Re-enter your service history from the right tenant domain.
        </h1>
        <p className="mt-5 max-w-[36rem] text-base leading-7 text-white/74">
          Sign in to review request progress, invoices, and follow-up actions for <strong className="text-white">{tenantDomainSlug}</strong>.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/15 bg-white/8 px-4 py-4">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-white/55">Tenant scope</span>
            <p className="mt-2 text-sm leading-6 text-white/72">This login only authenticates customer accounts created inside this domain.</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/8 px-4 py-4">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-white/55">Service view</span>
            <p className="mt-2 text-sm leading-6 text-white/72">Track work status, invoice readiness, and next steps without entering the staff workspace.</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/8 px-4 py-4">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-white/55">Mobile-first</span>
            <p className="mt-2 text-sm leading-6 text-white/72">The same customer shell works on narrow screens with a closable drawer and task-focused pages.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 px-5 py-6 shadow-[0_16px_34px_rgba(35,46,76,0.07)] sm:px-6">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Access your account</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Login</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use the same tenant domain where your customer account was registered.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-slate-50/70"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@example.com"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-slate-50/70"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn rounded-full border-0 bg-slate-950 text-white shadow-none hover:bg-slate-800">
            Login to customer portal
          </button>
        </form>

        <div className="mt-6 rounded-[1.5rem] bg-slate-100 px-4 py-4 text-sm leading-6 text-slate-600">
          No account for this tenant yet?{" "}
          <Link className="font-semibold text-slate-950 no-underline" to={`/t/${tenantDomainSlug}/c/register`}>
            Register as a customer
          </Link>
        </div>
      </section>
    </div>
  );
}
