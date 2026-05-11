import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthSessionResponse, MfaChallengeResponse } from "@/shared/api/contracts";
import { readApiErrorMessage } from "@/shared/api/http";
import { CaptchaField } from "@/shared/auth/CaptchaField";
import { PasswordResetPanel } from "@/shared/auth/PasswordResetPanel";
import { applySession, getCurrentSession, refreshSession } from "@/shared/auth/session";
import { useCaptchaChallenge } from "@/shared/auth/useCaptchaChallenge";
import { PublicButton } from "@/shared/public/PublicPrimitives";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";

type LoginMode = "tenant" | "root";

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
  const [loginMode, setLoginMode] = useState<LoginMode>("tenant");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const captcha = useCaptchaChallenge(!showPasswordReset && !mfaChallenge);
  const { data: session } = useQuery({
    queryKey: ["auth", "refresh", "optional"],
    queryFn: refreshSession,
    retry: false
  });

  const returnUrl = useMemo(
    () => sanitizeReturnUrl(searchParams.get("returnUrl")),
    [searchParams]
  );
  const isRootMode = loginMode === "root";

  if (session?.user.surface === "TenantDesktop") {
    return <Navigate to={returnUrl} replace />;
  }

  if (session?.user.surface === "Root") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setLocalNotice(null);

    try {
      const isMfaContinuation = mfaChallenge !== null;
      const response = await fetch(await resolveApiUrl(isRootMode ? "/api/auth/root/login" : "/api/auth/tenant/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "omit",
        body: JSON.stringify(isRootMode
          ? {
              email,
              password,
              rememberMe: false,
              useCookieSession: false,
              returnUrl: "/dashboard",
              captcha: isMfaContinuation ? null : captcha.proof,
              mfaChallengeId: mfaChallenge?.challengeId,
              mfaCode: isMfaContinuation ? mfaCode : null
            }
          : {
              email,
              password,
              targetSystem: "mls",
              useCookieSession: false,
              returnUrl,
              captcha: isMfaContinuation ? null : captcha.proof,
              mfaChallengeId: mfaChallenge?.challengeId,
              mfaCode: isMfaContinuation ? mfaCode : null
            })
      });

      if (response.status === 202) {
        const challenge = await response.json() as MfaChallengeResponse;
        setMfaChallenge(challenge);
        setMfaCode("");
        setLocalError(challenge.developmentCode
          ? `${challenge.message} Development code: ${challenge.developmentCode}`
          : challenge.message);
        return;
      }

      if (!response.ok) {
        const errorMessage = await readApiErrorMessage(response);
        setLocalError(errorMessage ?? (isRootMode ? "Invalid superadmin email or password." : "Invalid MLS email or password."));
        await captcha.refresh();
        return;
      }

      const payload = await response.json() as AuthSessionResponse;
      await applySession(payload);
      const session = getCurrentSession();
      queryClient.setQueryData(["auth", "refresh"], session);
      queryClient.setQueryData(["auth", "refresh", "optional"], session);
      const destination = payload.user.surface === "Root" ? "/dashboard" : returnUrl;

      if (isDesktopShell()) {
        navigate(destination, { replace: true });
        return;
      }

      window.location.assign(toPlatformRoute(destination));
    }
    catch {
      setLocalError(isRootMode
        ? "Unable to reach the superadmin authentication endpoint."
        : "Unable to reach the MLS authentication endpoint.");
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
              Sign in with tenant owner or tenant member credentials for finance work, or switch to the isolated superadmin mode when the desktop app is being used as an operations terminal.
            </p>

            <div className="mt-10 grid gap-4 text-sm text-[rgba(236,244,255,0.78)] sm:grid-cols-2">
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
              <div className="border-t border-white/16 pt-4">
                <strong className="block text-white">Separate root access</strong>
                <span className="mt-2 block">Superadmin sign-in opens the root control plane and does not inherit tenant MLS state.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mls-login__panel relative flex items-center px-6 py-8 sm:px-8 lg:px-10">
          <div className="mls-login__panel-shell mx-auto w-full max-w-[30rem] rounded-[2rem] border border-white/60 bg-[rgba(255,255,255,0.82)] p-6 shadow-[0_28px_65px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.2em] text-slate-500">MLS operator access</p>
              <h2 className="mt-2 text-[2.15rem] leading-[1.02] tracking-[-0.05em] text-slate-950">
                {isRootMode ? "Superadmin desktop sign in" : "Tenant desktop sign in"}
              </h2>
              <p className="mt-3 max-w-[24rem] text-[0.98rem] leading-[1.7] text-slate-600">
                {isRootMode
                  ? "Enter root credentials to open the superadmin control plane inside the desktop app. Tenant MLS state stays separate."
                  : "Enter your email and password to open the MLS desktop workspace. Tenant records are resolved from your authenticated account."}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${!isRootMode ? "bg-[#152540] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                onClick={() => {
                  setLoginMode("tenant");
                  setLocalError(null);
                  setLocalNotice(null);
                  setShowPasswordReset(false);
                  setMfaChallenge(null);
                  setMfaCode("");
                }}
              >
                Tenant MLS
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isRootMode ? "bg-[#152540] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                onClick={() => {
                  setLoginMode("root");
                  setLocalError(null);
                  setLocalNotice(null);
                  setShowPasswordReset(false);
                  setMfaChallenge(null);
                  setMfaCode("");
                }}
              >
                Superadmin
              </button>
            </div>

            {showPasswordReset ? (
              <div className="mt-8">
                <PasswordResetPanel
                  surface={isRootMode ? "root" : "mls"}
                  defaultEmail={email}
                  onCancel={() => setShowPasswordReset(false)}
                  onCompleted={() => {
                    setShowPasswordReset(false);
                    setLocalNotice("Password reset successfully. Sign in with the new password.");
                    setLocalError(null);
                  }}
                />
              </div>
            ) : (
            <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
              {localError ? (
                <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {localError}
                </div>
              ) : null}

              {localNotice ? (
                <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {localNotice}
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

              {mfaChallenge ? (
                <label className="grid gap-2">
                  <span className="text-[0.88rem] font-medium text-slate-600">MFA code</span>
                  <input
                    className="h-13 rounded-[1.1rem] border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/8"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                  />
                </label>
              ) : (
                <CaptchaField
                  answer={captcha.answer}
                  challenge={captcha.challenge}
                  disabled={submitting}
                  error={captcha.error}
                  isLoading={captcha.isLoading}
                  onAnswerChange={captcha.setAnswer}
                  onRefresh={captcha.refresh}
                />
              )}

              <button
                type="button"
                className="w-fit text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                onClick={() => {
                  setLocalError(null);
                  setLocalNotice(null);
                  setMfaChallenge(null);
                  setMfaCode("");
                  setShowPasswordReset(true);
                }}
              >
                Forgot password?
              </button>

              <button
                type="submit"
                className="mt-2 inline-flex min-h-13 items-center justify-center rounded-full bg-[#152540] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(21,37,64,0.22)] hover:-translate-y-px hover:bg-[#0f1e36] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : isRootMode ? "Open Superadmin Desktop" : "Open MLS Desktop"}
              </button>
            </form>
            )}

            <div className="mt-8 border-t border-slate-200 pt-4 text-sm leading-[1.7] text-slate-500">
              {isRootMode
                ? "Superadmin sessions use the root surface and cannot access tenant MLS pages unless a tenant user signs in."
                : "Tenant MLS sessions use the desktop finance surface. Switch to Superadmin only for root platform operations."}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
