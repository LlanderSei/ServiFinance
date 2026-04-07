import { FormEvent, useState } from "react";
import type { AuthSessionResponse } from "@/shared/api/contracts";
import { applySession } from "@/shared/auth/session";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";

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
        setLocalError("Invalid tenant email or password.");
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__header">
          <div>
            <p className="eyebrow">{tenantDomainSlug} / {system.toUpperCase()}</p>
            <h2>{system === "sms" ? "Service Management" : "Micro-Lending"} sign in</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close login">
            &times;
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {(localError || error) && <div className="form-error">{localError || error}</div>}

          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </label>

          <label>
            <span>Password</span>
            <div className="password-row">
              <input
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="button button--ghost button--small" onClick={() => setPasswordVisible((value) => !value)}>
                {passwordVisible ? "Hide" : "View"}
              </button>
            </div>
          </label>

          <div className="modal-card__actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary">
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
