import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthSessionResponse } from "@/shared/api/contracts";
import { readApiErrorMessage } from "@/shared/api/http";
import { applySession, getCurrentSession, refreshSession } from "@/shared/auth/session";
import { PublicButton } from "@/shared/public/PublicPrimitives";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";

function sanitizeReturnUrl(returnUrl: string | null) {
  if (!returnUrl || !returnUrl.startsWith("/t/mls")) {
    return "/t/mls/dashboard";
  }

  return returnUrl;
}

export function MlsDesktopLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("admin@local.servifinance");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { data: session } = useQuery({
    queryKey: ["auth", "refresh", "optional"],
    queryFn: refreshSession,
    retry: false
  });

  const returnUrl = useMemo(
    () => sanitizeReturnUrl(searchParams.get("returnUrl")),
    [searchParams]
  );

  if (session?.user.surface === "TenantDesktop") {
    return <Navigate to={returnUrl} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);

    try {
      const response = await fetch(await resolveApiUrl("/api/auth/tenant/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "omit",
        body: JSON.stringify({
          email,
          password,
          targetSystem: "mls",
          useCookieSession: false,
          returnUrl
        })
      });

      if (!response.ok) {
        const errorMessage = await readApiErrorMessage(response);
        setLocalError(errorMessage ?? "Invalid MLS email or password.");
        return;
      }

      const payload = await response.json() as AuthSessionResponse;
      await applySession(payload);
      const session = getCurrentSession();
      queryClient.setQueryData(["auth", "refresh"], session);
      queryClient.setQueryData(["auth", "refresh", "optional"], session);

      if (isDesktopShell()) {
        navigate(returnUrl, { replace: true });
        return;
      }

      window.location.assign(toPlatformRoute(returnUrl));
    }
    catch {
      setLocalError("Unable to reach the MLS authentication endpoint.");
    }
    finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mls-login min-h-dvh overflow-hidden bg-[linear-gradient(135deg,#f4f8ff_0%,#edf2fb_42%,#f5f2ec_100%)] text-slate-950">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,32rem)]">
        <section className="mls-login__hero relative isolate flex min-h-[22rem] items-end overflow-hidden px-7 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(132,185,255,0.35),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(255,223,171,0.34),transparent_26%),linear-gradient(155deg,#0f172a_0%,#10213e_42%,#183864_100%)]" />
          <div className="absolute inset-y-0 right-[10%] hidden w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,transparent_68%)] blur-2xl lg:block" />
          <div className="absolute left-[12%] top-[12%] h-24 w-24 rounded-full border border-white/12 bg-white/6 blur-[2px]" />
          <div className="absolute bottom-[12%] right-[14%] h-40 w-40 rounded-full border border-white/10 bg-white/5 blur-[3px]" />

          <div className="mls-login__hero-content relative z-[1] max-w-[36rem] text-white">
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.26em] text-white/68">ServiFinance MLS</p>
            <h1 className="mt-4 max-w-[9ch] font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(3.3rem,6vw,5.9rem)] leading-[0.9] tracking-[-0.06em] text-balance">
              Micro-Lending System
            </h1>
            <p className="mt-4 text-[1rem] font-semibold uppercase tracking-[0.18em] text-[rgba(236,244,255,0.84)]">
              Desktop Login Dashboard
            </p>
            <p className="mt-5 max-w-[30rem] text-[1.05rem] leading-[1.8] text-[rgba(236,244,255,0.82)]">
              Sign in with tenant owner or tenant member credentials. MLS automatically loads the correct tenant records after authentication, so this desktop surface never uses the superadmin login.
            </p>

            <div className="mt-10 grid gap-4 text-sm text-[rgba(236,244,255,0.78)] sm:grid-cols-3">
              <div className="border-t border-white/16 pt-4">
                <strong className="block text-white">Tenant-aware by session</strong>
                <span className="mt-2 block">Your workspace resolves from your MLS account, not from a typed route.</span>
              </div>
              <div className="border-t border-white/16 pt-4">
                <strong className="block text-white">Desktop-only finance surface</strong>
                <span className="mt-2 block">Use this terminal for lending, amortization, payment posting, and ledger work.</span>
              </div>
              <div className="border-t border-white/16 pt-4">
                <strong className="block text-white">Shared tenant credentials</strong>
                <span className="mt-2 block">Tenant owners and approved staff can use the same account set across SMS and MLS.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mls-login__panel relative flex items-center px-6 py-8 sm:px-8 lg:px-10">
          <div className="mls-login__panel-shell mx-auto w-full max-w-[30rem] rounded-[2rem] border border-white/60 bg-[rgba(255,255,255,0.82)] p-6 shadow-[0_28px_65px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.2em] text-slate-500">MLS operator access</p>
              <h2 className="mt-2 text-[2.15rem] leading-[1.02] tracking-[-0.05em] text-slate-950">Tenant desktop sign in</h2>
              <p className="mt-3 max-w-[24rem] text-[0.98rem] leading-[1.7] text-slate-600">
                Enter your email and password to open the MLS desktop workspace. This page accepts tenant credentials only.
              </p>
            </div>

            <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
              {localError ? (
                <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {localError}
                </div>
              ) : null}

              <label className="grid gap-2">
                <span className="text-[0.88rem] font-medium text-slate-600">Email</span>
                <input
                  className="h-13 rounded-[1.1rem] border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/8"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[0.88rem] font-medium text-slate-600">Password</span>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <input
                    className="h-13 rounded-[1.1rem] border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/8"
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    spellCheck={false}
                    required
                  />
                  <PublicButton
                    tone="ghost"
                    size="small"
                    className="min-w-[4.5rem]"
                    onClick={() => setPasswordVisible((value) => !value)}
                  >
                    {passwordVisible ? "Hide" : "View"}
                  </PublicButton>
                </div>
              </label>

              <button
                type="submit"
                className="mt-2 inline-flex min-h-13 items-center justify-center rounded-full bg-[#152540] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(21,37,64,0.22)] hover:-translate-y-px hover:bg-[#0f1e36] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Open MLS Desktop"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-4 text-sm leading-[1.7] text-slate-500">
              This MLS login dashboard is separate from the superadmin control plane. Use the web app for SMS, and this desktop surface for MLS.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
