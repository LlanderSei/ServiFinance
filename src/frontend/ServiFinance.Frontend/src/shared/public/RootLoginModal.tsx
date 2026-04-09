import { FormEvent, useMemo, useState } from "react";
import type { AuthSessionResponse } from "@/shared/api/contracts";
import { applySession } from "@/shared/auth/session";
import { isDesktopShell, resolveApiUrl, toPlatformRoute } from "@/platform/runtime";

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
  const returnUrl = useMemo(() => "/dashboard", []);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);

    try {
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
          returnUrl
        })
      });

      if (!response.ok) {
        setLocalError("Invalid superadmin email or password.");
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__header">
          <div>
            <p className="eyebrow">Superadmin Access</p>
            <h2>Platform sign in</h2>
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

          <label className="remember-row">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me on this device</span>
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
