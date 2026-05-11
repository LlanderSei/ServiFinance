import { FormEvent, useState } from "react";
import type {
  PasswordResetCompleteRequest,
  PasswordResetCompleteResponse,
  PasswordResetStartRequest,
  PasswordResetStartResponse
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpPostJson } from "@/shared/api/http";
import { CaptchaField } from "./CaptchaField";
import { PasswordPolicyChecklist } from "./PasswordPolicyChecklist";
import { useCaptchaChallenge } from "./useCaptchaChallenge";

type PasswordResetPanelProps = {
  surface: "root" | "tenant" | "mls" | "customer";
  tenantDomainSlug?: string | null;
  defaultEmail?: string;
  onCancel?: () => void;
  onCompleted?: () => void;
};

export function PasswordResetPanel({
  surface,
  tenantDomainSlug,
  defaultEmail = "",
  onCancel,
  onCompleted
}: PasswordResetPanelProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [resetId, setResetId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captcha = useCaptchaChallenge(!resetId);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await httpPostJson<PasswordResetStartResponse, PasswordResetStartRequest>(
          "/api/auth/password-reset/start",
          {
            surface,
            tenantDomainSlug,
            email,
            captcha: captcha.proof
          });

      setResetId(response.resetId);
      setNotice(response.developmentCode
          ? `${response.message} Development code: ${response.developmentCode}`
          : response.emailDeliveryConfigured
            ? `${response.message} Check the inbox for ${email.trim()}.`
            : `${response.message} Email delivery is not configured in this environment.`);
    } catch (startError) {
      setError(getApiErrorMessage(startError, "Unable to start password reset."));
      await captcha.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (newPassword !== confirmPassword) {
      setSubmitting(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await httpPostJson<PasswordResetCompleteResponse, PasswordResetCompleteRequest>(
          "/api/auth/password-reset/complete",
          {
            resetId: resetId ?? "",
            code,
            newPassword
          });
      setNotice(response.message);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      onCompleted?.();
    } catch (completeError) {
      setError(getApiErrorMessage(completeError, "Unable to complete password reset."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!resetId) {
    return (
      <form className="grid gap-4" onSubmit={handleStart}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Enter your account email and complete the CAPTCHA. If the account exists and has a linked Google account, a reset code will be sent to that Google email.
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Account email</span>
          <input
            type="email"
            className="input input-bordered w-full rounded-2xl border-slate-200 bg-white text-slate-950"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            spellCheck={false}
            required
          />
        </label>

        <CaptchaField
          answer={captcha.answer}
          challenge={captcha.challenge}
          disabled={submitting}
          error={captcha.error}
          isLoading={captcha.isLoading}
          onAnswerChange={captcha.setAnswer}
          onRefresh={captcha.refresh}
        />

        {notice ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{notice}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="flex flex-wrap justify-end gap-3">
          {onCancel ? (
            <button type="button" className="btn btn-ghost rounded-full" onClick={onCancel}>
              Back to login
            </button>
          ) : null}
          <button type="submit" className="btn rounded-full border-0 bg-slate-950 text-white shadow-none hover:bg-slate-800" disabled={submitting}>
            {submitting ? "Sending code..." : "Send reset code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleComplete}>
      {notice ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{notice}</div> : null}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Reset code</span>
        <input
          className="input input-bordered w-full rounded-2xl border-slate-200 bg-white text-slate-950"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="one-time-code"
          inputMode="numeric"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">New password</span>
        <input
          type="password"
          className="input input-bordered w-full rounded-2xl border-slate-200 bg-white text-slate-950"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Confirm new password</span>
        <input
          type="password"
          className="input input-bordered w-full rounded-2xl border-slate-200 bg-white text-slate-950"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      <PasswordPolicyChecklist
        password={newPassword}
        confirmPassword={confirmPassword}
        email={email}
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn btn-ghost rounded-full"
          onClick={() => {
            setResetId(null);
            setNotice(null);
            setError(null);
            void captcha.refresh();
          }}
        >
          Request a new code
        </button>
        <button type="submit" className="btn rounded-full border-0 bg-slate-950 text-white shadow-none hover:bg-slate-800" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
        </button>
      </div>
    </form>
  );
}
