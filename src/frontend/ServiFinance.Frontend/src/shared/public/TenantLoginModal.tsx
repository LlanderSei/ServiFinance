import { FormEvent, useState } from "react";
import type { AuthSessionResponse } from "@/shared/api/contracts";
import { readApiErrorMessage } from "@/shared/api/http";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";
import { applySession } from "@/shared/auth/session";
import { PublicButton } from "@/shared/public/PublicPrimitives";

type Props = {
  open: boolean;
  tenantDomainSlug: string;
  system: "sms" | "mls";
  error?: string | null;
  onClose: () => void;
};

export function TenantLoginModal({ open, tenantDomainSlug, system, error, onClose }: Props) {
  const [email, setEmail] = useState("admin@local.servifinance");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const targetRoute = `/t/${tenantDomainSlug}/${system}/dashboard`;

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
        credentials: isDesktopShell() ? "omit" : "include",
        body: JSON.stringify({
          email,
          password,
          tenantDomainSlug,
          targetSystem: system,
          useCookieSession: !isDesktopShell(),
          returnUrl: targetRoute
        })
      });

      if (!response.ok) {
        const errorMessage = await readApiErrorMessage(response);
        setLocalError(errorMessage ?? "Invalid tenant email or password.");
        return;
      }

      const payload = await response.json() as AuthSessionResponse;
      await applySession(payload);
      window.location.assign(toPlatformRoute(targetRoute));
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
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">{tenantDomainSlug} / {system.toUpperCase()}</p>
            <h2 className="mt-1 text-[2.1rem] tracking-[-0.04em] text-slate-950">{system === "sms" ? "Service Management" : "Micro-Lending"} sign in</h2>
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

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {(localError || error) && <div className="alert alert-error/80 rounded-2xl">{localError || error}</div>}

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

          <div className="flex justify-end gap-3">
            <PublicButton tone="ghost" onClick={onClose}>Cancel</PublicButton>
            <PublicButton type="submit" tone="primary">
              {submitting ? "Signing in..." : "Sign in"}
            </PublicButton>
          </div>
        </form>
      </div>
    </div>
  );
}
