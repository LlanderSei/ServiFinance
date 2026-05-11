import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountPasswordChangeResponse,
  AccountProfileResponse,
  AccountSecurityResponse,
  AuditWorkspaceResponse,
  ChangeAccountPasswordRequest,
  CurrentSessionUser,
  UpdateAccountProfileRequest
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
import { resolveApiUrl } from "@/platform/runtime";
import { PasswordPolicyChecklist } from "@/shared/auth/PasswordPolicyChecklist";
import { updateCurrentSessionUser } from "@/shared/auth/session";
import {
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { useToast } from "@/shared/toast/ToastProvider";

type AccountProfileModalProps = {
  user: CurrentSessionUser;
  open: boolean;
  onClose: () => void;
  onUserUpdated?: (patch: Partial<CurrentSessionUser>) => void;
  initialTab?: string;
};

const accountTabs = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "audit", label: "Audit" },
  { key: "access", label: "Access" }
];

const emptyPasswordDraft: ChangeAccountPasswordRequest = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function AccountProfileModal({ user, open, onClose, onUserUpdated, initialTab }: AccountProfileModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<UpdateAccountProfileRequest>({ fullName: user.fullName });
  const [passwordDraft, setPasswordDraft] = useState<ChangeAccountPasswordRequest>(emptyPasswordDraft);
  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => httpGet<AccountProfileResponse>("/api/account/profile"),
    enabled: open
  });
  const auditQuery = useQuery({
    queryKey: ["account", "audits"],
    queryFn: () => httpGet<AuditWorkspaceResponse>("/api/account/audits"),
    enabled: open && activeTab === "audit"
  });
  const securityQuery = useQuery({
    queryKey: ["account", "security"],
    queryFn: () => httpGet<AccountSecurityResponse>("/api/account/security"),
    enabled: open && activeTab === "security"
  });
  const profileMutation = useMutation({
    mutationFn: (payload: UpdateAccountProfileRequest) =>
      httpPutJson<AccountProfileResponse, UpdateAccountProfileRequest>("/api/account/profile", payload),
    onSuccess: (response) => {
      setIsEditingProfile(false);
      setProfileDraft({ fullName: response.fullName });
      updateCurrentSessionUser({ fullName: response.fullName });
      onUserUpdated?.({ fullName: response.fullName });
      queryClient.setQueryData(["account", "profile"], response);
      toast.success({
        title: "Profile updated",
        message: "Your profile details were saved successfully."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to update profile",
        message: getApiErrorMessage(error, "Profile details could not be saved.")
      });
    }
  });
  const passwordMutation = useMutation({
    mutationFn: (payload: ChangeAccountPasswordRequest) =>
      httpPostJson<AccountPasswordChangeResponse, ChangeAccountPasswordRequest>("/api/account/password", payload),
    onSuccess: (response) => {
      setPasswordDraft(emptyPasswordDraft);
      queryClient.invalidateQueries({ queryKey: ["account", "audits"] });
      toast.success({
        title: "Password updated",
        message: response.message
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to update password",
        message: getApiErrorMessage(error, "Password could not be changed.")
      });
    }
  });
  const enableMfaMutation = useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/account/mfa/enable", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["account", "security"], response);
      queryClient.invalidateQueries({ queryKey: ["account", "audits"] });
      toast.success({
        title: "MFA enabled",
        message: "Future sign-ins will require the one-time MFA code after the password is accepted."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to enable MFA",
        message: getApiErrorMessage(error, "MFA could not be enabled.")
      });
    }
  });
  const disableMfaMutation = useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/account/mfa/disable", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["account", "security"], response);
      queryClient.invalidateQueries({ queryKey: ["account", "audits"] });
      toast.success({
        title: "MFA disabled",
        message: "This account will use password-only sign-in until MFA is enabled again."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to disable MFA",
        message: getApiErrorMessage(error, "MFA could not be disabled.")
      });
    }
  });
  const unlinkGoogleMutation = useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/account/google/unlink", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["account", "security"], response);
      queryClient.invalidateQueries({ queryKey: ["account", "audits"] });
      toast.success({
        title: "Google unlinked",
        message: "The Google account link was removed."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to unlink Google",
        message: getApiErrorMessage(error, "Google account link could not be removed.")
      });
    }
  });

  const profile = profileQuery.data;
  const profileName = profile?.fullName ?? user.fullName;
  const profileRoles = profile?.roles ?? user.roles;
  const profileScopes = profile?.platformScopes ?? user.platformScopes;
  const trimmedProfileName = profileName.trim();
  const trimmedProfileDraftName = profileDraft.fullName.trim();
  const canSaveProfile = trimmedProfileDraftName.length > 0 && trimmedProfileDraftName !== trimmedProfileName;
  const passwordDraftIssue = getPasswordDraftIssue(passwordDraft);
  const canSubmitPassword = !passwordMutation.isPending && !passwordDraftIssue;

  useEffect(() => {
    if (!open) {
      setActiveTab("profile");
      setIsEditingProfile(false);
      setPasswordDraft(emptyPasswordDraft);
      return;
    }

    if (!isEditingProfile) {
      setProfileDraft({ fullName: profileName });
    }
  }, [isEditingProfile, open, profileName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(initialTab ?? "profile");
  }, [initialTab, open]);

  if (!open) {
    return null;
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveProfile) {
      return;
    }

    profileMutation.mutate({
      fullName: trimmedProfileDraftName
    });
  }

  function submitPassword(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (passwordMutation.isPending) {
      return;
    }

    if (passwordDraftIssue) {
      toast.warning({
        title: "Check password details",
        message: passwordDraftIssue
      });
      return;
    }

    passwordMutation.mutate(passwordDraft);
  }

  async function startGoogleLink() {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(await resolveApiUrl(`/api/account/google/link?returnUrl=${encodeURIComponent(returnUrl)}`));
  }

  function renderFooter() {
    if (activeTab === "profile") {
      if (isEditingProfile) {
        return (
          <>
            <WorkspaceModalButton
              onClick={() => {
                setIsEditingProfile(false);
                setProfileDraft({ fullName: profileName });
              }}
              disabled={profileMutation.isPending}
            >
              Cancel
            </WorkspaceModalButton>
            <WorkspaceModalButton
              type="submit"
              form="account-profile-form"
              tone="primary"
              disabled={profileMutation.isPending || !canSaveProfile}
            >
              {profileMutation.isPending ? "Saving..." : "Save"}
            </WorkspaceModalButton>
          </>
        );
      }

      return (
        <>
          <WorkspaceModalButton onClick={onClose}>Close</WorkspaceModalButton>
          <WorkspaceModalButton
            tone="primary"
            onClick={(event) => {
              event.currentTarget.blur();
              setIsEditingProfile(true);
            }}
          >
            Edit
          </WorkspaceModalButton>
        </>
      );
    }

    if (activeTab === "security") {
      return (
        <>
          <WorkspaceModalButton onClick={onClose}>Close</WorkspaceModalButton>
          <WorkspaceModalButton
            type="submit"
            form="account-password-form"
            tone="primary"
            disabled={!canSubmitPassword}
          >
            {passwordMutation.isPending ? "Updating..." : "Change password"}
          </WorkspaceModalButton>
        </>
      );
    }

    return <WorkspaceModalButton onClick={onClose}>Close</WorkspaceModalButton>;
  }

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Account profile"
      onClick={onClose}
    >
      <section
        className="grid h-[min(86vh,48rem)] w-full max-w-[74rem] grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded-[2rem] border border-base-300/70 bg-base-100 shadow-[0_30px_90px_rgba(15,23,42,0.34)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-4 border-b border-base-300/70 px-5 py-5 md:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
                Account center
              </p>
              <h2 className="mt-2 text-[clamp(1.8rem,3vw,2.45rem)] font-black tracking-[-0.05em] text-base-content">
                {profileName}
              </h2>
              <p className="mt-1 text-sm text-base-content/65">
                {profile?.email ?? user.email} · {formatSurface(profile?.surface ?? user.surface)}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-circle btn-sm border-base-300/70 bg-base-100 text-base-content shadow-none hover:bg-base-200"
              onClick={onClose}
              aria-label="Close account modal"
            >
              x
            </button>
          </div>
        </header>

        <WorkspaceTopTabs tabs={accountTabs} activeTab={activeTab} onChange={setActiveTab} />

        <main className="min-h-0 overflow-y-auto px-5 py-5 md:px-6">
          {activeTab === "profile" ? (
            <form id="account-profile-form" className="grid gap-4" onSubmit={submitProfile}>
              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Profile" title="Identity details" />
                  {isEditingProfile ? (
                    <WorkspaceFieldGrid>
                      <WorkspaceField label="Full name" wide>
                        <WorkspaceInput
                          value={profileDraft.fullName}
                          autoFocus
                          maxLength={200}
                          onChange={(event) => setProfileDraft({ fullName: event.target.value })}
                        />
                      </WorkspaceField>
                      <WorkspaceField label="Email" wide>
                        <WorkspaceInput value={profile?.email ?? user.email} disabled />
                      </WorkspaceField>
                    </WorkspaceFieldGrid>
                  ) : (
                    <WorkspaceDetailGrid>
                      <WorkspaceDetailItem label="Full name" value={profileName} />
                      <WorkspaceDetailItem label="Email" value={profile?.email ?? user.email} />
                      <WorkspaceDetailItem label="Tenant domain" value={profile?.tenantDomainSlug || "Platform"} />
                      <WorkspaceDetailItem label="Created" value={formatDateTime(profile?.createdAtUtc)} />
                    </WorkspaceDetailGrid>
                  )}
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Status" title="Account standing" />
                  <WorkspaceDetailGrid>
                    <WorkspaceDetailItem
                      label="State"
                      value={
                        <WorkspaceStatusPill tone={profile?.isActive ?? true ? "active" : "inactive"}>
                          {profile?.isActive ?? true ? "Active" : "Inactive"}
                        </WorkspaceStatusPill>
                      }
                    />
                    <WorkspaceDetailItem label="Surface" value={formatSurface(profile?.surface ?? user.surface)} />
                    <WorkspaceDetailItem
                      label="Roles"
                      value={profileRoles.length > 0 ? profileRoles.join(" / ") : "No roles assigned"}
                    />
                    <WorkspaceDetailItem
                      label="Scopes"
                      value={profileScopes.length > 0 ? profileScopes.join(" / ") : "No scopes assigned"}
                    />
                  </WorkspaceDetailGrid>
                </WorkspacePanel>
              </WorkspacePanelGrid>
            </form>
          ) : null}

          {activeTab === "security" ? (
            <form id="account-password-form" className="grid gap-4" onSubmit={submitPassword}>
              <WorkspacePanelGrid>
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Password" title="Change password" />
                  <WorkspaceFieldGrid>
                    <WorkspaceField label="Current password" wide>
                      <WorkspaceInput
                        type="password"
                        autoComplete="current-password"
                        required
                        value={passwordDraft.currentPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                    <WorkspaceField label="New password">
                      <WorkspaceInput
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        value={passwordDraft.newPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                    <WorkspaceField label="Confirm password">
                      <WorkspaceInput
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        value={passwordDraft.confirmPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                  </WorkspaceFieldGrid>
                  <PasswordPolicyChecklist
                    password={passwordDraft.newPassword}
                    confirmPassword={passwordDraft.confirmPassword}
                    email={profile?.email ?? user.email}
                    fullName={profileName}
                    tenantDomainSlug={profile?.tenantDomainSlug ?? user.tenantDomainSlug}
                  />
                  <p className={`text-sm leading-6 ${passwordDraftIssue ? "text-base-content/55" : "text-success"}`}>
                    {passwordDraftIssue ?? "Password details are ready to save."}
                  </p>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="MFA" title="Extra sign-in check" />
                  <div className="grid gap-3">
                    <div className="rounded-box border border-base-300/80 bg-base-200/35 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="text-base-content">Multi-factor authentication</strong>
                          <p className="mt-1 text-sm leading-6 text-base-content/65">
                            Status: {securityQuery.data?.mfaEnabled ? "Enabled" : "Disabled"} for {securityQuery.data?.surface ?? "this surface"}. Codes are emailed to the linked Google account.
                          </p>
                          {securityQuery.data && !securityQuery.data.googleLinked ? (
                            <p className="mt-3 rounded-box border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold leading-5 text-warning-content">
                              Link a Google account first to enable MFA.
                            </p>
                          ) : null}
                        </div>
                        <WorkspaceStatusPill tone={securityQuery.data?.mfaEnabled ? "active" : "inactive"}>
                          {securityQuery.data?.mfaEnabled ? "Enabled" : "Disabled"}
                        </WorkspaceStatusPill>
                      </div>
                      {securityQuery.data?.googleLinked ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {securityQuery.data.mfaEnabled ? (
                            <WorkspaceActionButton
                              onClick={() => disableMfaMutation.mutate()}
                              disabled={enableMfaMutation.isPending || disableMfaMutation.isPending}
                            >
                              {disableMfaMutation.isPending ? "Disabling MFA..." : "Disable MFA"}
                            </WorkspaceActionButton>
                          ) : (
                            <WorkspaceActionButton
                              onClick={() => enableMfaMutation.mutate()}
                              disabled={enableMfaMutation.isPending || disableMfaMutation.isPending}
                            >
                              {enableMfaMutation.isPending ? "Enabling MFA..." : "Enable MFA"}
                            </WorkspaceActionButton>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-box border border-base-300/80 bg-base-200/35 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="text-base-content">Google account linking</strong>
                          <p className="mt-1 text-sm leading-6 text-base-content/65">
                            {securityQuery.data?.googleLinked
                              ? `Linked to ${securityQuery.data.googleEmail ?? "a Google account"}.`
                              : securityQuery.data?.googleConfigured
                                ? "Link a Google account to enable MFA and password recovery."
                                : "Google OAuth is not configured on the API host."}
                          </p>
                          {securityQuery.data?.googleName ? (
                            <p className="mt-1 text-xs text-base-content/55">Google profile: {securityQuery.data.googleName}</p>
                          ) : null}
                          {securityQuery.data?.mfaEnabled && securityQuery.data?.googleLinked ? (
                            <p className="mt-3 rounded-box border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold leading-5 text-warning-content">
                              Unlinking account is disabled because MFA is enabled. Disable MFA first if you need to unlink Google.
                            </p>
                          ) : null}
                        </div>
                        <WorkspaceStatusPill tone={securityQuery.data?.googleLinked ? "active" : "inactive"}>
                          {securityQuery.data?.googleLinked ? "Linked" : "Not linked"}
                        </WorkspaceStatusPill>
                      </div>
                      {securityQuery.data && !securityQuery.data.mfaEnabled ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {securityQuery.data.googleLinked ? (
                            <WorkspaceActionButton
                              onClick={() => unlinkGoogleMutation.mutate()}
                              disabled={unlinkGoogleMutation.isPending}
                            >
                              {unlinkGoogleMutation.isPending ? "Unlinking Google..." : "Unlink Google"}
                            </WorkspaceActionButton>
                          ) : (
                            <WorkspaceActionButton
                              onClick={() => void startGoogleLink()}
                              disabled={!securityQuery.data.googleConfigured}
                            >
                              Link Google
                            </WorkspaceActionButton>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <FutureSecurityItem title="Trusted devices" detail="Reserved for reviewing active browsers and desktop terminals." />
                  </div>
                </WorkspacePanel>
              </WorkspacePanelGrid>
            </form>
          ) : null}

          {activeTab === "audit" ? (
            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="User audit"
                title="Activity linked to this account"
                actions={
                  <WorkspaceActionButton onClick={() => auditQuery.refetch()}>
                    Refresh
                  </WorkspaceActionButton>
                }
              />
              <div className="grid gap-3 md:grid-cols-4">
                <AuditKpi label="Total events" value={auditQuery.data?.summary.totalEvents ?? 0} />
                <AuditKpi label="System" value={auditQuery.data?.summary.systemEvents ?? 0} />
                <AuditKpi label="Security" value={auditQuery.data?.summary.securityEvents ?? 0} />
                <AuditKpi label="Failed/denied" value={auditQuery.data?.summary.failedEvents ?? 0} />
              </div>
              <WorkspaceSubtableShell className="max-h-[27rem] overflow-y-auto">
                <WorkspaceSubtable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Scope</th>
                      <th>Action</th>
                      <th>Outcome</th>
                      <th>Subject</th>
                      <th>Detail</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQuery.isLoading ? (
                      <tr>
                        <td colSpan={7}>Loading account audit events...</td>
                      </tr>
                    ) : null}
                    {auditQuery.isError ? (
                      <tr>
                        <td colSpan={7}>Unable to load account audit events.</td>
                      </tr>
                    ) : null}
                    {!auditQuery.isLoading && !auditQuery.isError && (auditQuery.data?.events ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={7}>No audit events linked to this account yet.</td>
                      </tr>
                    ) : null}
                    {(auditQuery.data?.events ?? []).map((event) => (
                      <tr key={`${event.scope}:${event.eventId}`}>
                        <td>{formatDateTime(event.occurredAtUtc)}</td>
                        <td>{event.scope}</td>
                        <td>{event.actionType}</td>
                        <td>{event.outcome}</td>
                        <td>{event.subjectLabel || event.subjectType}</td>
                        <td>{event.detail}</td>
                        <td>{event.ipAddress ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </WorkspaceSubtable>
              </WorkspaceSubtableShell>
            </WorkspacePanel>
          ) : null}

          {activeTab === "access" ? (
            <WorkspacePanelGrid>
              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Roles" title="Assigned access" />
                <div className="flex flex-wrap gap-2">
                  {profileRoles.map((role) => (
                    <WorkspaceStatusPill key={role} tone="progress">
                      {role}
                    </WorkspaceStatusPill>
                  ))}
                  {profileRoles.length === 0 ? <span className="text-base-content/65">No roles assigned.</span> : null}
                </div>
              </WorkspacePanel>

              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Permissions" title="Current session grants" />
                <WorkspaceDetailGrid>
                  <WorkspaceDetailItem label="Permission claims" value={user.permissionKeys.length} />
                  <WorkspaceDetailItem label="Module claims" value={user.moduleAccess.length} />
                  <WorkspaceDetailItem label="Surface" value={formatSurface(user.surface)} />
                  <WorkspaceDetailItem label="Tenant" value={user.tenantDomainSlug || "Platform"} />
                </WorkspaceDetailGrid>
              </WorkspacePanel>
            </WorkspacePanelGrid>
          ) : null}
        </main>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-base-300/70 bg-base-200/35 px-5 py-4 md:px-6">
          {renderFooter()}
        </footer>
      </section>
    </div>
  );
}

function FutureSecurityItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-box border border-dashed border-base-300/80 bg-base-200/35 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <strong className="text-base-content">{title}</strong>
        <span className="rounded-full border border-base-300/70 bg-base-100 px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-[0.08em] text-base-content/58">
          Future
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-base-content/65">{detail}</p>
    </div>
  );
}

function AuditKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-box border border-base-300/70 bg-base-200/45 px-4 py-3">
      <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{label}</p>
      <strong className="mt-1 block text-2xl text-base-content">{value}</strong>
    </div>
  );
}

function getPasswordDraftIssue(draft: ChangeAccountPasswordRequest) {
  if (!draft.currentPassword || !draft.newPassword || !draft.confirmPassword) {
    return "Fill in all password fields before changing password.";
  }

  if (draft.newPassword.length < 12) {
    return "New password must be at least 12 characters.";
  }

  if (draft.newPassword !== draft.confirmPassword) {
    return "New password and confirmation do not match.";
  }

  if (draft.currentPassword === draft.newPassword) {
    return "New password must be different from the current password.";
  }

  return null;
}

function formatSurface(surface: CurrentSessionUser["surface"]) {
  switch (surface) {
    case "TenantWeb":
      return "Tenant SMS web";
    case "TenantDesktop":
      return "Tenant MLS desktop";
    case "CustomerWeb":
      return "Customer portal";
    default:
      return "Superadmin root";
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
