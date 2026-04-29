import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getCurrentCustomerSession, registerCustomerAccount } from "./customerAuth";
import { getCustomerHomeRoute } from "./customerNav";

type RegisterFormState = {
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  password: string;
  confirmPassword: string;
};

export function CustomerRegisterPage() {
  const { tenantDomainSlug = "" } = useParams();
  const navigate = useNavigate();
  const currentSession = getCurrentCustomerSession();
  const [form, setForm] = useState<RegisterFormState>({
    fullName: "",
    email: "",
    mobileNumber: "",
    address: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState<string | null>(null);

  if (currentSession && currentSession.user.tenantDomainSlug.toLowerCase() === tenantDomainSlug.toLowerCase()) {
    return <Navigate to={getCustomerHomeRoute(currentSession.user)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Password and confirmation must match.");
      return;
    }

    try {
      const session = await registerCustomerAccount({
        tenantDomainSlug,
        fullName: form.fullName,
        email: form.email,
        mobileNumber: form.mobileNumber,
        address: form.address,
        password: form.password
      });
      navigate(getCustomerHomeRoute(session), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create customer account.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 px-5 py-6 shadow-[0_16px_34px_rgba(35,46,76,0.07)] sm:px-6">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Tenant-scoped account</p>
        <h1 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.05em] text-slate-950">Register</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Create a customer account for <strong className="text-slate-900">{tenantDomainSlug}</strong>. This does not create access in any other tenant domain.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
            <strong className="block text-sm text-slate-950">Isolated customer identity</strong>
            <p className="mt-2 text-sm leading-6 text-slate-600">The same person can register in another tenant later, but each domain keeps a separate customer view.</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
            <strong className="block text-sm text-slate-950">Mobile-ready workspace</strong>
            <p className="mt-2 text-sm leading-6 text-slate-600">After registration, the customer shell opens with a collapsible left drawer for phone screens.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,250,255,0.92))] px-5 py-6 shadow-[0_20px_50px_rgba(29,47,105,0.1)] sm:px-6">
        <div className="max-w-[42rem]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer onboarding</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Create your portal access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This working frontend slice stores a tenant-scoped customer account locally so you can validate the route and interface flow immediately.
          </p>
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Full name</span>
            <input
              type="text"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="John Doe"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="john@example.com"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Mobile number</span>
            <input
              type="tel"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.mobileNumber}
              onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))}
              placeholder="+63 912 345 6789"
              required
            />
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <input
              type="text"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Street, barangay, city"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Create a password"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Confirm password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-2xl border-slate-200 bg-white"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              placeholder="Repeat the password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className="btn rounded-full border-0 bg-slate-950 text-white shadow-none hover:bg-slate-800">
              Register customer account
            </button>
            <Link className="btn rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline" to={`/t/${tenantDomainSlug}/c/login`}>
              I already have access
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
