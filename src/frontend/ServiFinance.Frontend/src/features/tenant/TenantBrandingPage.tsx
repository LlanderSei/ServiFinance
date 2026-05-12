import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type {
  TenantBrandingSettingsResponse,
  UpdateTenantBrandingSettingsRequest
} from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet, httpPostFormDataWithProgress, httpPutJson } from "@/shared/api/http";
import { getCurrentSession } from "@/shared/auth/session";
import {
  WorkspaceField,
  WorkspaceFileInput,
  WorkspaceFieldGrid,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceDetailGrid,
  WorkspaceDetailItem,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import {
  applyTenantBrandingToDocument,
  resolveReadableTextColors,
  tenantBrandingQueryKey,
  toTenantBranding
} from "@/shared/tenant/tenantBranding";
import { useToast } from "@/shared/toast/ToastProvider";
import { UploadProgressBar } from "@/shared/uploads/UploadProgressBar";

type BrandingDraft = UpdateTenantBrandingSettingsRequest;

const emptyDraft: BrandingDraft = {
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  headerBackgroundColor: null,
  pageBackgroundColor: null
};

export function TenantBrandingPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const workspaceScope = currentUser?.surface === "TenantDesktop" ? "mls" : "sms";
  const workspaceLabel = workspaceScope.toUpperCase();
  const brandingTenantSlug = tenantDomainSlug || currentUser?.tenantDomainSlug || "";
  const queryKey = ["tenant", brandingTenantSlug, workspaceScope, "branding"];
  const [draft, setDraft] = useState<BrandingDraft>(emptyDraft);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
  const brandingQuery = useQuery({
    queryKey,
    queryFn: () => httpGet<TenantBrandingSettingsResponse>(`/api/tenants/${brandingTenantSlug}/branding?scope=${workspaceScope}`),
    enabled: Boolean(brandingTenantSlug)
  });
  const brandingMutation = useMutation({
    mutationFn: (payload: BrandingDraft) =>
      httpPutJson<TenantBrandingSettingsResponse, BrandingDraft>(
        `/api/tenants/${brandingTenantSlug}/branding?scope=${workspaceScope}`,
        payload
      ),
    onSuccess: (response) => {
      applyBrandingResponse(response);
      toast.success({
        title: "Branding updated",
        message: "Tenant theme and branding options were saved successfully."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to save branding",
        message: getApiErrorMessage(error, "Tenant branding could not be saved.")
      });
    }
  });
  const logoUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const payload = new FormData();
      payload.append("logoFile", file);
      setLogoUploadProgress(0);
      return httpPostFormDataWithProgress<TenantBrandingSettingsResponse>(
        `/api/tenants/${brandingTenantSlug}/branding/logo?scope=${workspaceScope}`,
        payload,
        setLogoUploadProgress
      );
    },
    onSuccess: (response) => {
      applyBrandingResponse(response);
      setSelectedLogoFile(null);
      setLogoInputKey((current) => current + 1);
      toast.success({
        title: "Logo uploaded",
        message: "The tenant logo was uploaded through ImgBB and applied to the workspace."
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to upload logo",
        message: getApiErrorMessage(error, "Tenant logo could not be uploaded.")
      });
    },
    onSettled: () => {
      setLogoUploadProgress(null);
    }
  });

  useEffect(() => {
    if (brandingQuery.data) {
      setDraft(toDraft(brandingQuery.data));
    }
  }, [brandingQuery.data]);

  function submitBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    brandingMutation.mutate({
      displayName: normalizeNullable(draft.displayName),
      logoUrl: normalizeNullable(draft.logoUrl),
      primaryColor: normalizeNullable(draft.primaryColor),
      secondaryColor: normalizeNullable(draft.secondaryColor),
      headerBackgroundColor: normalizeNullable(draft.headerBackgroundColor),
      pageBackgroundColor: normalizeNullable(draft.pageBackgroundColor)
    });
  }

  function applyBrandingResponse(response: TenantBrandingSettingsResponse) {
    queryClient.setQueryData(queryKey, response);
    queryClient.setQueryData(tenantBrandingQueryKey(brandingTenantSlug), toTenantBranding(response, brandingTenantSlug));
    setDraft(toDraft(response));
    applyTenantBrandingToDocument(toTenantBranding(response, brandingTenantSlug));
  }

  function resetDraft() {
    setDraft(brandingQuery.data ? toDraft(brandingQuery.data) : emptyDraft);
  }

  const tenantName = draft.displayName?.trim() || brandingQuery.data?.tenantName || brandingTenantSlug || "Tenant";
  const avatarText = tenantName.slice(0, 2).toUpperCase();
  const previewHeaderBackground = draft.headerBackgroundColor ?? "#ffffff";
  const previewHeaderTextColors = resolveReadableTextColors(previewHeaderBackground);
  const previewAccentBackground = draft.secondaryColor ?? "#14b8a6";
  const previewAccentTextColors = resolveReadableTextColors(previewAccentBackground);

  return (
    <RecordWorkspace
      breadcrumbs={`${brandingTenantSlug || "Tenant"} / ${workspaceLabel} / Branding`}
      title="Tenant branding"
      description="Update tenant-facing display identity, logo reference, and theme color tokens used across the authenticated workspace."
    >
      <RecordContentStack>
        {!brandingTenantSlug ? (
          <WorkspaceNotice tone="error" className="m-4 mb-0">
            No tenant context is available for branding management.
          </WorkspaceNotice>
        ) : null}
        {brandingQuery.isError ? (
          <WorkspaceNotice tone="error" className="m-4 mb-0">
            Unable to load tenant branding settings right now.
          </WorkspaceNotice>
        ) : null}

        <RecordScrollRegion className="px-4 pt-4">
          <WorkspacePanelGrid className="xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Brand controls" title="Theme and identity" />
              <form id="tenant-branding-form" className="grid gap-4" onSubmit={submitBranding}>
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Display name" wide>
                    <WorkspaceInput
                      value={draft.displayName ?? ""}
                      maxLength={200}
                      placeholder={brandingQuery.data?.tenantName ?? "Tenant display name"}
                      onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Logo URL" wide>
                    <WorkspaceInput
                      value={draft.logoUrl ?? ""}
                      maxLength={500}
                      placeholder="/assets/logo.svg or https://..."
                      onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value }))}
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Upload logo through ImgBB" wide>
                    <div className="grid gap-2 rounded-2xl border border-dashed border-base-300/80 bg-base-100/70 p-3">
                      <WorkspaceFileInput
                        key={logoInputKey}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => setSelectedLogoFile(event.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="max-w-[34rem] text-xs leading-5 text-base-content/60">
                          Logos are uploaded by the API using the tenant ImgBB key. JPG, PNG, or WebP only; 2 MB max.
                        </p>
                        <WorkspaceModalButton
                          type="button"
                          tone="primary"
                          disabled={!selectedLogoFile || logoUploadMutation.isPending || !brandingTenantSlug}
                          onClick={() => {
                            if (selectedLogoFile) {
                              logoUploadMutation.mutate(selectedLogoFile);
                            }
                          }}
                        >
                          {logoUploadMutation.isPending ? "Uploading..." : "Upload logo"}
                        </WorkspaceModalButton>
                      </div>
                      {logoUploadMutation.isPending ? (
                        <UploadProgressBar label="Uploading logo" progress={logoUploadProgress} />
                      ) : null}
                    </div>
                  </WorkspaceField>
                  <ColorField
                    label="Primary color"
                    value={draft.primaryColor}
                    fallback="#2563eb"
                    onChange={(value) => setDraft((current) => ({ ...current, primaryColor: value }))}
                  />
                  <ColorField
                    label="Secondary color"
                    value={draft.secondaryColor}
                    fallback="#14b8a6"
                    onChange={(value) => setDraft((current) => ({ ...current, secondaryColor: value }))}
                  />
                  <ColorField
                    label="Header background"
                    value={draft.headerBackgroundColor}
                    fallback="#ffffff"
                    onChange={(value) => setDraft((current) => ({ ...current, headerBackgroundColor: value }))}
                  />
                  <ColorField
                    label="Page background"
                    value={draft.pageBackgroundColor}
                    fallback="#f6f7fb"
                    onChange={(value) => setDraft((current) => ({ ...current, pageBackgroundColor: value }))}
                  />
                </WorkspaceFieldGrid>
              </form>
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Preview" title="Workspace look" />
              <section
                className="overflow-hidden rounded-[1.5rem] border border-base-300/70 shadow-sm"
                style={{ backgroundColor: draft.pageBackgroundColor ?? "#f6f7fb" }}
              >
                <div
                  className="flex items-center justify-between gap-4 border-b border-base-300/70 px-4 py-4"
                  style={{ backgroundColor: previewHeaderBackground }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {draft.logoUrl ? (
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-base-300/70 bg-base-100 shadow-sm">
                        <img src={draft.logoUrl} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : (
                      <span
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-extrabold text-white shadow-sm"
                        style={{ backgroundColor: draft.primaryColor ?? "#2563eb" }}
                      >
                        {avatarText}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p
                        className="truncate text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55"
                        style={{ color: previewHeaderTextColors.muted ?? undefined }}
                      >
                        {workspaceLabel} workspace
                      </p>
                      <strong
                        className="block truncate text-base-content"
                        style={{ color: previewHeaderTextColors.foreground ?? undefined }}
                      >
                        {tenantName}
                      </strong>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-extrabold text-white"
                    style={{
                      backgroundColor: previewAccentBackground,
                      color: previewAccentTextColors.foreground ?? "#ffffff"
                    }}
                  >
                    Live preview
                  </span>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="rounded-2xl border border-base-300/70 bg-base-100/92 p-4">
                    <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">
                      Sample card
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-base-content">
                      Brand tokens apply to shell surfaces.
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-base-content/65">
                      The same tenant theme is used by the public tenant entry and authenticated workspace shell.
                    </p>
                  </div>
                </div>
              </section>

              <WorkspaceDetailGrid>
                <WorkspaceDetailItem label="Tenant name" value={brandingQuery.data?.tenantName ?? "-"} />
                <WorkspaceDetailItem label="Domain" value={brandingQuery.data?.tenantDomainSlug ?? brandingTenantSlug} />
                <WorkspaceDetailItem label="Logo" value={draft.logoUrl ? "Configured" : "Not set"} />
                <WorkspaceDetailItem label="Scope" value={workspaceLabel} />
              </WorkspaceDetailGrid>
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </RecordScrollRegion>

        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-wrap justify-end gap-2">
          <WorkspaceModalButton
            className="pointer-events-auto"
            onClick={resetDraft}
            disabled={brandingMutation.isPending || brandingQuery.isLoading}
          >
            Reset
          </WorkspaceModalButton>
          <WorkspaceModalButton
            className="pointer-events-auto"
            form="tenant-branding-form"
            type="submit"
            tone="primary"
            disabled={brandingMutation.isPending || brandingQuery.isLoading || !brandingTenantSlug}
          >
            {brandingMutation.isPending ? "Saving..." : "Save branding"}
          </WorkspaceModalButton>
        </div>
      </RecordContentStack>
    </RecordWorkspace>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <WorkspaceField label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-base-300/70 bg-base-100 p-1"
          value={toColorInputValue(value, fallback)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <WorkspaceInput
          value={value ?? ""}
          maxLength={20}
          placeholder={fallback}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </WorkspaceField>
  );
}

function toDraft(response: TenantBrandingSettingsResponse): BrandingDraft {
  return {
    displayName: response.displayName,
    logoUrl: response.logoUrl,
    primaryColor: response.primaryColor,
    secondaryColor: response.secondaryColor,
    headerBackgroundColor: response.headerBackgroundColor,
    pageBackgroundColor: response.pageBackgroundColor
  };
}

function normalizeNullable(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toColorInputValue(value: string | null, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value! : fallback;
}
