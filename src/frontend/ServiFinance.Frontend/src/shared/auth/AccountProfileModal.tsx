import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountPasswordChangeResponse,
  AccountProfileResponse,
  AuditWorkspaceResponse,
  ChangeAccountPasswordRequest,
  CurrentSessionUser,
  UpdateAccountProfileRequest
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
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

export function AccountProfileModal({ user, open, onClose, onUserUpdated }: AccountProfileModalProps) {
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

  const profile = profileQuery.data;
  const profileName = profile?.fullName ?? user.fullName;
  const profileRoles = profile?.roles ?? user.roles;
  const profileScopes = profile?.platformScopes ?? user.platformScopes;

  useEffect(() => {
    if (!open) {
      setActiveTab("profile");
      setIsEditingProfile(false);
      setPasswordDraft(emptyPasswordDraft);
      return;
    }

    setProfileDraft({ fullName: profileName });
  }, [open, profileName]);

  if (!open) {
    return null;
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    profileMutation.mutate({
      fullName: profileDraft.fullName.trim()
    });
  }

  function submitPassword(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    passwordMutation.mutate(passwordDraft);
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
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? "Saving..." : "Save"}
            </WorkspaceModalButton>
          </>
        );
      }

      return (
        <>
          <WorkspaceModalButton onClick={onClose}>Close</WorkspaceModalButton>
          <WorkspaceModalButton tone="primary" onClick={() => setIsEditingProfile(true)}>
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
            disabled={passwordMutation.isPending}
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
                        value={passwordDraft.currentPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                    <WorkspaceField label="New password">
                      <WorkspaceInput
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={passwordDraft.newPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                    <WorkspaceField label="Confirm password">
                      <WorkspaceInput
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={passwordDraft.confirmPassword}
                        onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                      />
                    </WorkspaceField>
                  </WorkspaceFieldGrid>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Future hardening" title="Linked sign-in methods" />
                  <div className="grid gap-3">
                    <FutureSecurityItem title="Google account linking" detail="Reserved for account recovery and optional Google sign-in." />
                    <FutureSecurityItem title="Multi-factor authentication" detail="Reserved for owner/admin enforcement and sensitive action prompts." />
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
