import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
import type {
  CreatePlatformTenantCheckoutRequest,
  CreatePlatformTenantCheckoutResponse,
  PlatformTenantRegistrationStatus
} from "@/shared/api/contracts";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicBadge,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell,
  PublicWorkflowList
} from "@/shared/public/PublicPrimitives";

type RegistrationFormState = {
  businessName: string;
  domainSlug: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  confirmPassword: string;
};

const TERMINAL_REGISTRATION_STATUSES = new Set([
  "Provisioned",
  "ProvisioningFailed",
  "CheckoutExpired",
  "CheckoutFailed"
]);

const initialFormState: RegistrationFormState = {
  businessName: "",
  domainSlug: "",
  ownerFullName: "",
  ownerEmail: "",
  ownerPassword: "",
  confirmPassword: ""
};

export function RegisterPage() {
  const { data } = useSubscriptionTiers();
  const tiers = data ?? [];
  const [searchParams] = useSearchParams();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [formState, setFormState] = useState<RegistrationFormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainSlugTouched, setDomainSlugTouched] = useState(false);

  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";

  const selectedTier = useMemo(() => {
    if (!tiers.length) {
      return null;
    }

    return tiers.find((tier) => tier.code === (selectedCode || tiers[0].code)) ?? tiers[0];
  }, [selectedCode, tiers]);

  const highlightedModules = selectedTier?.modules.slice(0, 5) ?? [];
  const remainingModuleCount = Math.max((selectedTier?.modules.length ?? 0) - highlightedModules.length, 0);

  useEffect(() => {
    if (!tiers.length) {
      return;
    }

    setSelectedCode((current) => current || tiers[0].code);
  }, [tiers]);

  useEffect(() => {
    if (domainSlugTouched || !formState.businessName.trim()) {
      return;
    }

    setFormState((current) => ({
      ...current,
      domainSlug: normalizeDomainSlug(current.businessName)
    }));
  }, [domainSlugTouched, formState.businessName]);

  const registrationStatusQuery = useQuery({
    queryKey: ["platform-registration-status", checkoutSessionId],
    queryFn: () =>
      httpGet<PlatformTenantRegistrationStatus>(
        `/api/platform/registration/status?sessionId=${encodeURIComponent(checkoutSessionId)}`
      ),
    enabled: checkoutState === "success" && checkoutSessionId.length > 0,
    refetchInterval: (query) =>
      TERMINAL_REGISTRATION_STATUSES.has(query.state.data?.status ?? "") ? false : 2000
  });

  const registrationMutation = useMutation({
    mutationFn: (payload: CreatePlatformTenantCheckoutRequest) =>
      httpPostJson<CreatePlatformTenantCheckoutResponse, CreatePlatformTenantCheckoutRequest>(
        "/api/platform/registration/checkout",
        payload
      ),
    onSuccess: (response) => {
      window.location.assign(response.checkoutUrl);
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to start the Stripe checkout right now."));
    }
  });

  function updateField<TKey extends keyof RegistrationFormState>(key: TKey, value: RegistrationFormState[TKey]) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleDomainSlugChange(value: string) {
    setDomainSlugTouched(true);
    updateField("domainSlug", normalizeDomainSlug(value));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!selectedTier) {
      setErrorMessage("Select an available subscription tier first.");
      return;
    }

    if (!formState.businessName.trim()) {
      setErrorMessage("Enter the business name.");
      return;
    }

    if (!formState.domainSlug.trim()) {
      setErrorMessage("Enter a tenant domain slug.");
      return;
    }

    if (!formState.ownerFullName.trim()) {
      setErrorMessage("Enter the owner full name.");
      return;
    }

    if (!formState.ownerEmail.trim()) {
      setErrorMessage("Enter the owner email.");
      return;
    }

    if (formState.ownerPassword.length < 8) {
      setErrorMessage("Owner password must be at least 8 characters.");
      return;
    }

    if (formState.ownerPassword !== formState.confirmPassword) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    registrationMutation.mutate({
      businessName: formState.businessName.trim(),
      domainSlug: formState.domainSlug.trim(),
      ownerFullName: formState.ownerFullName.trim(),
      ownerEmail: formState.ownerEmail.trim(),
      ownerPassword: formState.ownerPassword,
      subscriptionTierId: selectedTier.id
    });
  }

  const statusCard = renderRegistrationState({
    checkoutState,
    status: registrationStatusQuery.data,
    isLoading: registrationStatusQuery.isLoading,
    isError: registrationStatusQuery.isError
  });

  return (
    <PublicShell>
      <PublicHeader />

      <main className="py-10">
        {statusCard ? (
          <PublicContainer className="mb-5">
            {statusCard}
          </PublicContainer>
        ) : null}

        <PublicContainer className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.14fr)]">
          <PublicCard className="grid min-h-full gap-6 p-7">
            <div className="grid gap-4">
              <PublicSectionHeading
                eyebrow="Live onboarding"
                title="Register the tenant, collect the subscription, then provision the business workspace."
                description="This flow now creates a Stripe subscription checkout for the selected MSME tier and provisions the tenant after Stripe confirms the payment."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Business identity</strong>
                <p className="mt-2 text-slate-600">Business shell, tenant slug, and the owner account become the new operating tenant.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Stripe subscription</strong>
                <p className="mt-2 text-slate-600">The selected tier is charged through Stripe Checkout with recurring billing.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Workspace activation</strong>
                <p className="mt-2 text-slate-600">When Stripe confirms the checkout, the tenant admin account and access surface are provisioned automatically.</p>
              </div>
            </div>

            <PublicWorkflowList>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Choose the commercial tier</strong><span className="text-slate-600">The live backend catalog still drives MSME segment, edition, and unlocked modules.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Create the owner account</strong><span className="text-slate-600">The owner email and password become the first tenant administrator sign-in after provisioning.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Redirect to Stripe</strong><span className="text-slate-600">Checkout finishes the subscription payment and returns to this page while the platform finalizes tenant setup.</span></li>
            </PublicWorkflowList>

          </PublicCard>

          <PublicCard className="grid gap-5 p-7 bg-white/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Business</p>
                <h2 className="mt-2 font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(2.8rem,4vw,4.6rem)] leading-[0.94] tracking-[-0.055em] text-slate-950">Stripe-backed signup</h2>
              </div>
              {selectedTier ? (
                <div className="grid justify-items-start gap-2 lg:justify-items-end">
                  <PublicBadge>{selectedTier.highlightLabel || selectedTier.code}</PublicBadge>
                  <strong className="text-slate-950">{selectedTier.priceDisplay}</strong>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {tiers.map((tier) => {
                const isActive = selectedTier?.id === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={[
                      "grid gap-1 rounded-[1.15rem] border px-4 py-4 text-left transition",
                      isActive
                        ? "border-primary/30 bg-gradient-to-b from-sky-50 to-teal-50 shadow-[0_14px_26px_rgba(63,88,184,0.08)]"
                        : "border-slate-900/8 bg-white/90 text-slate-950"
                    ].join(" ")}
                    onClick={() => setSelectedCode(tier.code)}
                  >
                    <span className="text-[0.82rem] uppercase tracking-[0.08em] text-slate-500">{tier.businessSizeSegment}</span>
                    <strong className="text-base text-slate-950">{tier.subscriptionEdition}</strong>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.7fr)]">
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Business name</span>
                  <input
                    className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={formState.businessName}
                    onChange={(event) => updateField("businessName", event.target.value)}
                    placeholder="Example Domain Services"
                    disabled={registrationMutation.isPending}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Tenant domain slug</span>
                  <input
                    className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={formState.domainSlug}
                    onChange={(event) => handleDomainSlugChange(event.target.value)}
                    placeholder="exampledomain"
                    disabled={registrationMutation.isPending}
                  />
                  <span className="text-xs text-slate-500">This becomes the tenant route at `/t/{formState.domainSlug || "yourdomain"}/...`.</span>
                </label>

                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Owner full name</span>
                  <input
                    className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={formState.ownerFullName}
                    onChange={(event) => updateField("ownerFullName", event.target.value)}
                    placeholder="Business owner"
                    disabled={registrationMutation.isPending}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Owner email</span>
                  <input
                    type="email"
                    className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={formState.ownerEmail}
                    onChange={(event) => updateField("ownerEmail", event.target.value)}
                    placeholder="owner@business.com"
                    disabled={registrationMutation.isPending}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[0.92rem] text-slate-500">Owner password</span>
                    <input
                      type="password"
                      className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                      value={formState.ownerPassword}
                      onChange={(event) => updateField("ownerPassword", event.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={registrationMutation.isPending}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[0.92rem] text-slate-500">Confirm password</span>
                    <input
                      type="password"
                      className="input input-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                      value={formState.confirmPassword}
                      onChange={(event) => updateField("confirmPassword", event.target.value)}
                      placeholder="Repeat the password"
                      disabled={registrationMutation.isPending}
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-[0.92rem] text-slate-500">Subscription tier</span>
                  <select
                    className="select select-bordered w-full border-slate-900/10 bg-white/95 text-slate-950"
                    value={selectedTier?.code ?? ""}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    disabled={!tiers.length || registrationMutation.isPending}
                  >
                    {tiers.map((tier) => <option key={tier.id} value={tier.code}>{tier.displayName}</option>)}
                  </select>
                </label>

                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700">
                    {errorMessage}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-4 text-slate-700">
                    The checkout opens in Stripe. After payment, this page polls the platform until the tenant admin account is fully provisioned.
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full"
                  disabled={!selectedTier || registrationMutation.isPending}
                >
                  {registrationMutation.isPending ? "Preparing Stripe checkout..." : "Continue to Stripe"}
                </button>
              </form>

              <aside className="grid gap-4 rounded-[1.5rem] border border-primary/15 bg-gradient-to-b from-[rgba(218,248,244,0.84)] to-[rgba(255,255,255,0.88)] p-5">
                {selectedTier ? (
                  <>
                    <div className="grid gap-2">
                      <PublicBadge>{selectedTier.highlightLabel || selectedTier.code}</PublicBadge>
                      <h3 className="text-[2rem] tracking-[-0.04em] text-slate-950">{selectedTier.displayName}</h3>
                      <p className="text-[0.92rem] text-slate-500">{selectedTier.businessSizeSegment} business • {selectedTier.subscriptionEdition} edition</p>
                      <p className="text-slate-700">{selectedTier.audienceSummary}</p>
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-1 border-t border-slate-900/10 pt-3">
                        <small className="text-slate-500">Commercial view</small>
                        <strong className="text-slate-950">{selectedTier.priceDisplay}</strong>
                        <span className="text-slate-500">{selectedTier.billingLabel}</span>
                      </div>
                      <div className="grid gap-1 border-t border-slate-900/10 pt-3">
                        <small className="text-slate-500">Product shape</small>
                        <strong className="text-slate-950">{selectedTier.includesMicroLendingDesktop ? "Web + Desktop" : "Web Only"}</strong>
                        <span className="text-slate-500">{selectedTier.planSummary}</span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <h4 className="text-slate-950">Unlocked modules</h4>
                        <span className="text-slate-500">{selectedTier.modules.length} total</span>
                      </div>
                      <ul className="grid gap-3">
                        {highlightedModules.map((module) => (
                          <li key={module.moduleCode} className="flex items-start justify-between gap-4 border-t border-slate-900/8 pt-3">
                            <span className="text-slate-800">{module.moduleName}</span>
                            <span className={module.accessLevel === "Included"
                              ? "badge badge-success badge-soft border-0"
                              : "badge badge-warning badge-soft border-0"}>
                              {module.accessLevel}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {remainingModuleCount > 0 ? (
                        <p className="text-[0.92rem] text-slate-500">+ {remainingModuleCount} more modules unlocked after activation</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl text-slate-950">No active tiers</h3>
                    <p className="text-slate-600">The registration flow needs active seeded subscription tiers from the backend catalog.</p>
                  </>
                )}
              </aside>
            </div>
          </PublicCard>
        </PublicContainer>
      </main>

      <PublicFooter />
    </PublicShell>
  );
}

function renderRegistrationState({
  checkoutState,
  status,
  isLoading,
  isError
}: {
  checkoutState: string | null;
  status?: PlatformTenantRegistrationStatus;
  isLoading: boolean;
  isError: boolean;
}) {
  if (checkoutState === "canceled") {
    return (
      <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5 text-amber-800">
        Stripe checkout was canceled. The tenant was not provisioned, and you can resume the signup flow from this page.
      </div>
    );
  }

  if (checkoutState !== "success") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] border border-primary/15 bg-primary/8 px-5 py-5 text-slate-700">
        Stripe returned successfully. The platform is finalizing the tenant and owner account now.
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-5 text-rose-700">
        Stripe returned, but the platform could not confirm the tenant provisioning state yet. Refresh this page after a few seconds.
      </div>
    );
  }

  if (status.status === "Provisioned") {
    return (
      <div className="grid gap-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-900">
        <strong>{status.businessName} is now provisioned.</strong>
        <span className="text-sm text-emerald-800">Tenant route: `/t/{status.domainSlug}/sms/`</span>
        <span className="text-sm text-emerald-800">Owner account: {status.ownerEmail}</span>
        {status.tenantLoginUrl ? (
          <Link className="font-semibold text-emerald-900 hover:underline" to={status.tenantLoginUrl}>
            Open tenant login
          </Link>
        ) : null}
      </div>
    );
  }

  if (status.failureReason) {
    return (
      <div className="grid gap-2 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-5 text-rose-800">
        <strong>Provisioning stopped after checkout.</strong>
        <span className="text-sm">{status.failureReason}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-[1.5rem] border border-primary/15 bg-primary/8 px-5 py-5 text-slate-700">
      <strong>Stripe checkout is complete.</strong>
      <span className="text-sm">Current state: {status.status}</span>
      <span className="text-sm">The platform is waiting for Stripe confirmation before creating the tenant workspace.</span>
    </div>
  );
}

function normalizeDomainSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
