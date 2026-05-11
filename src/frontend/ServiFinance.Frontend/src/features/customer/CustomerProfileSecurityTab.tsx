import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { resolveApiUrl } from "@/platform/runtime";
import { PasswordPolicyChecklist } from "@/shared/auth/PasswordPolicyChecklist";
import { useToast } from "@/shared/toast/ToastProvider";
import {
  useChangeCustomerPassword,
  useCustomerSecurity,
  useDisableCustomerMfa,
  useEnableCustomerMfa,
  useUnlinkCustomerGoogle
} from "./useCustomerProfile";
import type { CustomerProfile } from "./useCustomerProfile";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

type CustomerProfileSecurityTabProps = {
  profile: CustomerProfile;
};

export function CustomerProfileSecurityTab({ profile }: CustomerProfileSecurityTabProps) {
  const toast = useToast();
  const securityQuery = useCustomerSecurity();
  const changePassword = useChangeCustomerPassword();
  const enableMfa = useEnableCustomerMfa();
  const disableMfa = useDisableCustomerMfa();
  const unlinkGoogle = useUnlinkCustomerGoogle();
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const googleLinkStatus = searchParams.get("googleLink");
    if (!googleLinkStatus) {
      return;
    }

    showGoogleLinkToast(googleLinkStatus, toast);
    void securityQuery.refetch();
    searchParams.delete("googleLink");

    const nextSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [securityQuery, toast]);

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordNotice(null);
    try {
      const response = await changePassword.mutateAsync(passwordForm);
      setPasswordForm(emptyPasswordForm);
      setPasswordNotice(response.message);
    } catch {
      // The mutation error is rendered next to the form.
    }
  }

  async function startGoogleLink() {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(await resolveApiUrl(`/api/customer-portal/google/link?returnUrl=${encodeURIComponent(returnUrl)}`));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Account security</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Google recovery and MFA</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] ${securityQuery.data?.mfaEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {securityQuery.data?.mfaEnabled ? "MFA enabled" : "MFA off"}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">Linked Google account</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {securityQuery.isLoading
                    ? "Checking Google link status..."
                    : securityQuery.data?.googleLinked
                      ? `Linked to ${securityQuery.data.googleEmail ?? "a Google account"}.`
                      : securityQuery.data?.googleConfigured
                        ? "Link Google to allow password recovery and MFA codes through your Google email."
                        : "Google OAuth is not configured on the API host."}
                </p>
                {securityQuery.data?.googleName ? (
                  <p className="mt-1 text-xs text-slate-500">Google profile: {securityQuery.data.googleName}</p>
                ) : null}
                {securityQuery.data?.mfaEnabled && securityQuery.data?.googleLinked ? (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                    Unlinking account is disabled because MFA is enabled. Disable MFA first if you need to unlink Google.
                  </p>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${securityQuery.data?.googleLinked ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                {securityQuery.data?.googleLinked ? "Linked" : "Not linked"}
              </span>
            </div>
            {securityQuery.data && !securityQuery.data.mfaEnabled ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {securityQuery.data.googleLinked ? (
                  <button
                    type="button"
                    className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none"
                    disabled={unlinkGoogle.isPending}
                    onClick={() => unlinkGoogle.mutate()}
                  >
                    {unlinkGoogle.isPending ? "Unlinking..." : "Unlink Google"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm rounded-full bg-slate-900 text-white hover:bg-slate-800"
                    disabled={!securityQuery.data.googleConfigured}
                    onClick={() => void startGoogleLink()}
                  >
                    Link Google
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <h3 className="font-semibold text-slate-950">Email MFA</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              When enabled, sign-in requires a one-time code sent to the linked Google email after your password is accepted.
            </p>
            {securityQuery.data && !securityQuery.data.googleLinked ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                Link a Google account first to enable MFA.
              </p>
            ) : null}
            {securityQuery.data?.googleLinked ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {securityQuery.data.mfaEnabled ? (
                  <button
                    type="button"
                    className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none"
                    disabled={enableMfa.isPending || disableMfa.isPending}
                    onClick={() => disableMfa.mutate()}
                  >
                    {disableMfa.isPending ? "Disabling..." : "Disable MFA"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm rounded-full bg-blue-600 text-white hover:bg-blue-700"
                    disabled={enableMfa.isPending || disableMfa.isPending}
                    onClick={() => enableMfa.mutate()}
                  >
                    {enableMfa.isPending ? "Enabling..." : "Enable MFA"}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {securityQuery.isError || enableMfa.isError || disableMfa.isError || unlinkGoogle.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {securityQuery.error?.message ??
                enableMfa.error?.message ??
                disableMfa.error?.message ??
                unlinkGoogle.error?.message ??
                "Unable to update account security."}
            </p>
          ) : null}
        </div>
      </section>

      <form
        onSubmit={handlePasswordSubmit}
        className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]"
      >
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Password</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Change password</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Current password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-xl bg-white"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-xl bg-white"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Confirm new password</span>
            <input
              type="password"
              className="input input-bordered w-full rounded-xl bg-white"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              autoComplete="new-password"
              required
            />
          </label>
          <PasswordPolicyChecklist
            password={passwordForm.newPassword}
            confirmPassword={passwordForm.confirmPassword}
            email={profile.email}
            fullName={profile.fullName}
            tenantDomainSlug={profile.tenantDomainSlug}
          />
          {passwordNotice ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {passwordNotice}
            </p>
          ) : null}
          {changePassword.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {changePassword.error.message}
            </p>
          ) : null}
          <button className="btn w-full rounded-full bg-slate-900 text-white hover:bg-slate-800 sm:w-max" disabled={changePassword.isPending}>
            {changePassword.isPending ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function showGoogleLinkToast(status: string, toast: ReturnType<typeof useToast>) {
  switch (status) {
    case "linked":
      toast.success({
        title: "Google linked",
        message: "Your Google account is now linked. You can enable MFA from Account security."
      });
      break;
    case "already-linked":
      toast.error({
        title: "Google already linked",
        message: "That Google account is already linked to another ServiFinance account."
      });
      break;
    case "missing-profile":
      toast.error({
        title: "Google profile unavailable",
        message: "Google did not return the email profile needed for linking."
      });
      break;
    default:
      toast.error({
        title: "Google link failed",
        message: "The Google account could not be linked. Try again."
      });
      break;
  }
}
