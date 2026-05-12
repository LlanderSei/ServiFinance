import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AuthSessionResponse, MfaChallengeResponse } from "@/shared/api/contracts";
import { readApiErrorMessage } from "@/shared/api/http";
import { CaptchaField } from "@/shared/auth/CaptchaField";
import { PasswordResetPanel } from "@/shared/auth/PasswordResetPanel";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";
import { applySession } from "@/shared/auth/session";
import { useCaptchaChallenge } from "@/shared/auth/useCaptchaChallenge";
import { PublicButton } from "@/shared/public/PublicPrimitives";

type Props = {
  open: boolean;
  error?: string | null;
  onClose: () => void;
};

export function RootLoginModal({ open, error, onClose }: Props) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("superadmin@local.servifinance");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const captcha = useCaptchaChallenge(open && !mfaChallenge && !showPasswordReset);
  const returnUrl = useMemo(() => "/dashboard", []);

  useEffect(() => {
    if (!open) {
      setMfaChallenge(null);
      setMfaCode("");
      setLocalError(null);
      setLocalNotice(null);
      setShowPasswordReset(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setLocalNotice(null);

    try {
      const isMfaContinuation = mfaChallenge !== null;
      const response = await fetch(await resolveApiUrl("/api/auth/root/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: isDesktopShell() ? "omit" : "include",
        body: JSON.stringify({
          email,
          password,
          rememberMe,
          useCookieSession: !isDesktopShell(),
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
        setLocalError(errorMessage ?? "Invalid superadmin email or password.");
        await captcha.refresh();
        return;
      }

      const payload = await response.json() as AuthSessionResponse;
      await applySession(payload, { rememberOnWeb: rememberMe && !isDesktopShell() });
      window.location.assign(toPlatformRoute(returnUrl));
    } catch {
      setLocalError("Unable to reach the authentication endpoint.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[linear-gradient(180deg,rgba(20,24,39,0.18),rgba(20,24,39,0.28)),radial-gradient(circle_at_top,rgba(214,231,255,0.25),transparent_30%)] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative z-[81] w-full max-w-[34rem] rounded-[1.8rem] border border-primary/20 bg-[rgba(251,252,255,0.98)] p-6 shadow-[0_24px_54px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.78)]"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Superadmin Access</p>
            <h2 className="mt-1 text-[2.1rem] tracking-[-0.04em] text-slate-950">Platform sign in</h2>
          </div>
          <button
            type="button"
            className="btn btn-circle btn-ghost border border-slate-900/10 bg-white/75 text-slate-950"
            onClick={onClose}
            aria-label="Close login"
          >
            ×
          </button>
        </div>

        {showPasswordReset ? (
          <PasswordResetPanel
            surface="root"
            defaultEmail={email}
            onCancel={() => setShowPasswordReset(false)}
            onCompleted={() => {
              setShowPasswordReset(false);
              setLocalNotice("Password reset successfully. Sign in with the new password.");
            }}
          />
        ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {(localError || error) && <div className="alert alert-error/80 rounded-2xl">{localError || error}</div>}
          {localNotice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{localNotice}</div>}

          <label className="grid gap-2">
            <span className="text-[0.92rem] text-slate-500">Email</span>
            <input
              className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              spellCheck={false}
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[0.92rem] text-slate-500">Password</span>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <input
                className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                spellCheck={false}
                required
              />
              <PublicButton tone="ghost" size="small" onClick={() => setPasswordVisible((value) => !value)}>
                {passwordVisible ? "Hide" : "View"}
              </PublicButton>
            </div>
          </label>

          {mfaChallenge ? (
            <label className="grid gap-2">
              <span className="text-[0.92rem] text-slate-500">MFA code</span>
              <input
                className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
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

          <label className="inline-flex items-center gap-2 text-slate-500">
            <input className="checkbox checkbox-sm border-slate-400/60" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me on this device</span>
          </label>

          <button
            type="button"
            className="w-fit text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
            onClick={() => {
              setLocalError(null);
              setLocalNotice(null);
              setMfaChallenge(null);
              setShowPasswordReset(true);
            }}
          >
            Forgot password?
          </button>

          <div className="flex justify-end gap-3">
            <PublicButton tone="ghost" onClick={onClose}>Cancel</PublicButton>
            <PublicButton type="submit" tone="primary">
              {submitting ? "Signing in..." : "Sign in"}
            </PublicButton>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
