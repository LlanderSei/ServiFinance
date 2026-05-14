import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { BadgeDollarSign, Boxes, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, httpGet, httpPostJson } from "@/shared/api/http";
import { CaptchaField } from "@/shared/auth/CaptchaField";
import { PasswordPolicyChecklist } from "@/shared/auth/PasswordPolicyChecklist";
import { useCaptchaChallenge, type CaptchaChallenge } from "@/shared/auth/useCaptchaChallenge";
import type {
  CreatePlatformTenantCheckoutRequest,
  CreatePlatformTenantCheckoutResponse,
  PlatformTenantRegistrationStatus,
  SubscriptionTierCard
} from "@/shared/api/contracts";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicBadge,
  PublicButton,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell
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

const editionTabs = ["Standard", "Premium"];
const segmentOrder = ["Micro", "Small", "Medium"];
const accessLevelRank: Record<string, number> = {
  limited: 1,
  included: 2
};

type TierBenefitPresentation = {
  inheritedTierLabels: string[];
  incrementalModules: SubscriptionTierCard["modules"];
  totalModuleCount: number;
};

type RegistrationModalTabKey = "plan" | "modules" | "owner";

export function RegisterPage() {
  const { data } = useSubscriptionTiers();
  const tiers = useMemo(() => [...(data ?? [])].sort(compareTiers), [data]);
  const [searchParams] = useSearchParams();
  const [selectedEdition, setSelectedEdition] = useState("Standard");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [formState, setFormState] = useState<RegistrationFormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainSlugTouched, setDomainSlugTouched] = useState(false);
  const registrationCaptcha = useCaptchaChallenge(isRegistrationModalOpen);

  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";

  const editionTiers = useMemo(
    () => tiers.filter((tier) => tier.subscriptionEdition === selectedEdition),
    [selectedEdition, tiers]
  );

  const selectedTier = useMemo(() => {
    if (!tiers.length) {
      return null;
    }

    return tiers.find((tier) => tier.code === selectedCode) ?? editionTiers[0] ?? tiers[0];
  }, [editionTiers, selectedCode, tiers]);

  useEffect(() => {
    if (!tiers.length) {
      return;
    }

    setSelectedEdition((current) =>
      tiers.some((tier) => tier.subscriptionEdition === current) ? current : tiers[0].subscriptionEdition
    );
  }, [tiers]);

  useEffect(() => {
    if (!editionTiers.length) {
      return;
    }

    setSelectedCode((current) =>
      editionTiers.some((tier) => tier.code === current) ? current : editionTiers[0].code
    );
  }, [editionTiers]);

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
      void registrationCaptcha.refresh();
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

  function handleChooseTier(tier: SubscriptionTierCard) {
    setSelectedCode(tier.code);
    setErrorMessage(null);
    setIsRegistrationModalOpen(true);
  }

  function closeRegistrationModal() {
    if (registrationMutation.isPending) {
      return;
    }

    setIsRegistrationModalOpen(false);
    setErrorMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    if (formState.ownerPassword.length < 12) {
      setErrorMessage("Owner password must be at least 12 characters.");
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
      subscriptionTierId: selectedTier.id,
      captcha: registrationCaptcha.proof
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

        <PublicContainer className="grid gap-5">
          <PublicCard className="grid gap-7 p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:p-9">
            <PublicSectionHeading
              eyebrow="Live onboarding"
              title="Choose a tier, collect the subscription, then provision the tenant workspace."
              description="Registration is now driven by the active subscription catalog. The selected edition and tier determine what SMS and MLS modules the tenant can use after Stripe confirms payment."
            />

            <div className="grid content-start gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <OnboardingStep
                label="1"
                title="Tier entitlement"
                description="MSME segment, Standard or Premium edition, and module access are selected before checkout."
              />
              <OnboardingStep
                label="2"
                title="Stripe subscription"
                description="The first billing cycle is collected through Stripe Checkout with recurring renewal."
              />
              <OnboardingStep
                label="3"
                title="Workspace activation"
                description="After payment confirmation, the tenant domain and first owner account are provisioned."
              />
            </div>
          </PublicCard>

          <PublicCard className="grid gap-6 p-7 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Business catalog</p>
                <h2 className="mt-2 font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(2.65rem,4vw,4.25rem)] leading-[0.94] tracking-[-0.055em] text-slate-950">
                  Pick the operating shape
                </h2>
                <p className="mt-3 max-w-[46rem] text-slate-500">
                  Standard keeps the tenant on the SMS web workflow. Premium adds the MLS desktop finance terminal where the selected tier allows it.
                </p>
              </div>

              <div className="grid w-full grid-cols-2 rounded-full border border-slate-900/10 bg-slate-100/80 p-1 lg:inline-flex lg:w-auto">
                {editionTabs.map((edition) => (
                  <button
                    key={edition}
                    type="button"
                    className={[
                      "w-full rounded-full px-5 py-2 text-sm font-semibold transition",
                      selectedEdition === edition
                        ? "bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)]"
                        : "text-slate-600 hover:bg-white"
                    ].join(" ")}
                    onClick={() => setSelectedEdition(edition)}
                  >
                    {edition}
                  </button>
                ))}
              </div>
            </div>

            {editionTiers.length ? (
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
                {editionTiers.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    tiers={tiers}
                    isSelected={selectedTier?.id === tier.id}
                    onSelect={() => handleChooseTier(tier)}
                  />
                ))}
                <span className="w-1 shrink-0 lg:hidden" aria-hidden />
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5 text-amber-800">
                No active {selectedEdition.toLowerCase()} tiers are available right now. Add or reactivate a tier in Superadmin subscription management.
              </div>
            )}
          </PublicCard>
        </PublicContainer>
      </main>

      {isRegistrationModalOpen && selectedTier ? (
        <RegistrationModal
          selectedTier={selectedTier}
          tiers={tiers}
          formState={formState}
          errorMessage={errorMessage}
          isPending={registrationMutation.isPending}
          onClose={closeRegistrationModal}
          onSubmit={handleSubmit}
          onUpdateField={updateField}
          onDomainSlugChange={handleDomainSlugChange}
          captchaAnswer={registrationCaptcha.answer}
          captchaChallenge={registrationCaptcha.challenge}
          captchaError={registrationCaptcha.error}
          isCaptchaLoading={registrationCaptcha.isLoading}
          onCaptchaAnswerChange={registrationCaptcha.setAnswer}
          onCaptchaRefresh={registrationCaptcha.refresh}
        />
      ) : null}

      <PublicFooter />
    </PublicShell>
  );
}

function OnboardingStep({
  label,
  title,
  description
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-3 rounded-[1.4rem] border border-slate-900/10 bg-white/70 p-5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
        {label}
      </span>
      <div className="grid gap-1">
        <strong className="text-slate-950">{title}</strong>
        <span className="text-sm leading-6 text-slate-500">{description}</span>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  tiers,
  isSelected,
  onSelect
}: {
  tier: SubscriptionTierCard;
  tiers: SubscriptionTierCard[];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const benefitPresentation = getTierBenefitPresentation(tier, tiers);
  const featuredModules = benefitPresentation.incrementalModules.slice(0, 6);
  const remainingModuleCount = Math.max(benefitPresentation.incrementalModules.length - featuredModules.length, 0);
  const buttonLabel = `Get ${tier.subscriptionEdition} ${tier.businessSizeSegment}`;

  return (
    <article
      className={[
        "flex min-h-[34rem] min-w-[min(86vw,22rem)] snap-start flex-col gap-5 rounded-[1.6rem] border p-5 transition lg:min-w-0",
        isSelected
          ? "border-primary/30 bg-gradient-to-b from-sky-50 to-teal-50 shadow-[0_18px_34px_rgba(63,88,184,0.1)]"
          : "border-slate-900/10 bg-white/90"
      ].join(" ")}
    >
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <PublicBadge>{tier.highlightLabel || `${tier.businessSizeSegment} / ${tier.subscriptionEdition}`}</PublicBadge>
          <span className="rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-bold text-slate-600">
            {tier.includesMicroLendingDesktop ? "Web + Desktop" : "Web Only"}
          </span>
        </div>
        <div className="grid gap-2">
          <h3 className="text-[2rem] leading-none tracking-[-0.045em] text-slate-950">{tier.displayName}</h3>
          <p className="min-h-[3.75rem] text-sm leading-6 text-slate-500">{tier.audienceSummary}</p>
        </div>
      </div>

      <div className="grid gap-1 rounded-[1.2rem] border border-slate-900/10 bg-white/80 p-4">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Starts at</span>
        <strong className="text-2xl text-slate-950">{tier.priceDisplay}</strong>
        <span className="text-sm text-slate-500">{tier.billingLabel}</span>
      </div>

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <strong className="text-slate-950">Modules and benefits</strong>
          <span className="text-xs font-semibold text-slate-500">
            {benefitPresentation.incrementalModules.length
              ? `${benefitPresentation.incrementalModules.length} new / ${benefitPresentation.totalModuleCount} total`
              : `${benefitPresentation.totalModuleCount} total`}
          </span>
        </div>
        {benefitPresentation.inheritedTierLabels.length ? (
          <p className="rounded-[1rem] border border-primary/15 bg-primary/8 px-3 py-3 text-xs font-semibold leading-5 text-slate-700">
            Includes benefits from {formatTierList(benefitPresentation.inheritedTierLabels)}.
          </p>
        ) : null}
        {featuredModules.length ? (
          <ul className="grid gap-2">
            {featuredModules.map((module) => (
              <li key={module.moduleCode} className="grid gap-1 border-t border-slate-900/8 pt-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">{module.moduleName}</span>
                  <span className={module.accessLevel === "Included"
                    ? "badge badge-success badge-soft border-0"
                    : "badge badge-warning badge-soft border-0"}>
                    {module.accessLevel}
                  </span>
                </div>
                <span className="text-xs leading-5 text-slate-500">{module.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[1rem] border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
            No additional module entitlement beyond the inherited tier set.
          </p>
        )}
        {remainingModuleCount > 0 ? (
          <p className="text-sm text-slate-500">+ {remainingModuleCount} more new module entitlements after activation</p>
        ) : null}
      </div>

      <PublicButton tone="primary" className="mt-auto w-full" onClick={onSelect}>
        {buttonLabel}
      </PublicButton>
    </article>
  );
}

function RegistrationModal({
  selectedTier,
  tiers,
  formState,
  errorMessage,
  isPending,
  onClose,
  onSubmit,
  onUpdateField,
  onDomainSlugChange,
  captchaAnswer,
  captchaChallenge,
  captchaError,
  isCaptchaLoading,
  onCaptchaAnswerChange,
  onCaptchaRefresh
}: {
  selectedTier: SubscriptionTierCard;
  tiers: SubscriptionTierCard[];
  formState: RegistrationFormState;
  errorMessage: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <TKey extends keyof RegistrationFormState>(
    key: TKey,
    value: RegistrationFormState[TKey]
  ) => void;
  onDomainSlugChange: (value: string) => void;
  captchaAnswer: string;
  captchaChallenge: CaptchaChallenge | null;
  captchaError: string | null;
  isCaptchaLoading: boolean;
  onCaptchaAnswerChange: (value: string) => void;
  onCaptchaRefresh: () => void;
}) {
  const benefitPresentation = getTierBenefitPresentation(selectedTier, tiers);
  const webModules = selectedTier.modules.filter((module) => module.channel === "Web");
  const desktopModules = selectedTier.modules.filter((module) => module.channel === "Desktop");
  const [activeModalTab, setActiveModalTab] = useState<RegistrationModalTabKey>("plan");
  const modalTabs: Array<{ key: RegistrationModalTabKey; label: string; Icon: LucideIcon }> = [
    { key: "plan", label: "Plan", Icon: BadgeDollarSign },
    { key: "modules", label: "Modules", Icon: Boxes },
    { key: "owner", label: "Owner", Icon: UserRound }
  ];

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-2 backdrop-blur-sm sm:px-4 sm:py-6">
      <form
        className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[74rem] flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.35)] lg:h-[min(48rem,calc(100vh-3rem))] lg:rounded-[1.7rem]"
        onSubmit={onSubmit}
      >
        <header className="relative flex flex-col gap-3 border-b border-slate-900/10 px-5 py-4 pr-14 lg:flex-row lg:items-start lg:justify-between lg:px-6 lg:py-5 lg:pr-14">
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Tenant registration</p>
            <h2 className="mt-2 text-[clamp(1.65rem,3vw,2.4rem)] leading-none tracking-[-0.045em] text-slate-950">
              Register {selectedTier.displayName}
            </h2>
          </div>
          <PublicBadge>{selectedTier.subscriptionEdition} / {selectedTier.businessSizeSegment}</PublicBadge>
          <button
            type="button"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-slate-900/10 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close registration modal"
          >
            x
          </button>
        </header>

        <nav className="grid grid-cols-3 border-b border-slate-900/10 bg-slate-50/80 p-1.5 lg:hidden" aria-label="Registration sections">
          {modalTabs.map(({ key, label, Icon }) => {
            const isActive = activeModalTab === key;

            return (
              <button
                key={key}
                type="button"
                className={[
                  "grid min-h-[3.1rem] place-items-center gap-0.5 rounded-[1rem] px-2 py-2 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] transition",
                  isActive ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                ].join(" ")}
                onClick={() => setActiveModalTab(key)}
              >
                <Icon size={17} strokeWidth={2.2} aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 lg:grid-cols-[0.85fr_1fr_1.2fr] lg:p-4">
          <section
            className={[
              activeModalTab === "plan" ? "grid" : "hidden",
              "min-h-0 content-start gap-4 overflow-y-auto rounded-[1.35rem] border border-slate-900/10 bg-slate-50 p-4 lg:grid"
            ].join(" ")}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Selected plan</p>
              <h3 className="mt-2 text-3xl tracking-[-0.045em] text-slate-950">{selectedTier.displayName}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{selectedTier.description || selectedTier.audienceSummary}</p>
            </div>
            <div className="grid gap-3 rounded-[1.1rem] bg-white p-4">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Billing</span>
              <strong className="text-2xl text-slate-950">{selectedTier.priceDisplay}</strong>
              <span className="text-sm text-slate-500">{selectedTier.billingLabel}</span>
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <span><strong className="text-slate-950">Product:</strong> {selectedTier.includesMicroLendingDesktop ? "SMS web + MLS desktop" : "SMS web only"}</span>
              <span><strong className="text-slate-950">Tier code:</strong> {selectedTier.code}</span>
              <span><strong className="text-slate-950">Summary:</strong> {selectedTier.planSummary}</span>
            </div>
          </section>

          <section
            className={[
              activeModalTab === "modules" ? "flex" : "hidden",
              "min-h-0 flex-col gap-4 overflow-hidden rounded-[1.35rem] border border-slate-900/10 bg-white p-4 lg:flex"
            ].join(" ")}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Modules and benefits</p>
              <h3 className="mt-2 text-xl text-slate-950">All entitlements in this tier</h3>
            </div>
            {benefitPresentation.inheritedTierLabels.length ? (
              <p className="rounded-[1rem] border border-primary/15 bg-primary/8 px-3 py-3 text-xs font-semibold leading-5 text-slate-700">
                Includes benefits from {formatTierList(benefitPresentation.inheritedTierLabels)}.
              </p>
            ) : null}
            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="grid gap-4">
                <ModuleList title="Service Management System" modules={webModules} />
                <ModuleList title="Micro-Lending System" modules={desktopModules} />
              </div>
            </div>
          </section>

          <section
            className={[
              activeModalTab === "owner" ? "grid" : "hidden",
              "min-h-0 content-start gap-3 overflow-y-auto rounded-[1.35rem] border border-slate-900/10 bg-white p-4 sm:grid-cols-2 lg:grid"
            ].join(" ")}
          >
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Owner and tenant</p>
              <h3 className="mt-2 text-xl text-slate-950">Create the first administrator</h3>
            </div>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Business name</span>
              <input
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.businessName}
                onChange={(event) => onUpdateField("businessName", event.target.value)}
                placeholder="Example Domain Services"
                disabled={isPending}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Tenant domain slug</span>
              <input
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.domainSlug}
                onChange={(event) => onDomainSlugChange(event.target.value)}
                placeholder="exampledomain"
                disabled={isPending}
              />
              <span className="text-xs text-slate-500">This becomes `/t/{formState.domainSlug || "yourdomain"}/...`.</span>
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Owner full name</span>
              <input
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.ownerFullName}
                onChange={(event) => onUpdateField("ownerFullName", event.target.value)}
                placeholder="Business owner"
                disabled={isPending}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Owner email</span>
              <input
                type="email"
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.ownerEmail}
                onChange={(event) => onUpdateField("ownerEmail", event.target.value)}
                placeholder="owner@business.com"
                disabled={isPending}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Owner password</span>
              <input
                type="password"
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.ownerPassword}
                onChange={(event) => onUpdateField("ownerPassword", event.target.value)}
                placeholder="Minimum 12 characters"
                disabled={isPending}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm text-slate-500">Confirm password</span>
              <input
                type="password"
                className="input input-bordered input-sm w-full border-slate-900/10 bg-white/95 text-slate-950"
                value={formState.confirmPassword}
                onChange={(event) => onUpdateField("confirmPassword", event.target.value)}
                placeholder="Repeat the password"
                disabled={isPending}
              />
            </label>

            <div className="sm:col-span-2">
              <PasswordPolicyChecklist
                password={formState.ownerPassword}
                confirmPassword={formState.confirmPassword}
                email={formState.ownerEmail}
                fullName={formState.ownerFullName}
                tenantDomainSlug={formState.domainSlug}
                businessName={formState.businessName}
              />
            </div>

            <div className="sm:col-span-2">
              <CaptchaField
                answer={captchaAnswer}
                challenge={captchaChallenge}
                disabled={isPending}
                error={captchaError}
                isLoading={isCaptchaLoading}
                onAnswerChange={onCaptchaAnswerChange}
                onRefresh={onCaptchaRefresh}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">
                {errorMessage}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                Stripe checkout opens next. Tenant provisioning starts only after Stripe confirms the subscription.
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-900/10 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <PublicButton className="w-full sm:min-w-32 sm:w-auto" onClick={onClose} disabled={isPending}>
            Cancel
          </PublicButton>
          <PublicButton tone="primary" className="w-full sm:min-w-52 sm:w-auto" type="submit" disabled={isPending}>
            {isPending ? "Preparing Stripe checkout..." : "Continue to Stripe"}
          </PublicButton>
        </footer>
      </form>
    </div>
  );
}

function ModuleList({
  title,
  modules
}: {
  title: string;
  modules: SubscriptionTierCard["modules"];
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-900/10 pb-2">
        <strong className="text-sm text-slate-950">{title}</strong>
        <span className="text-xs font-semibold text-slate-500">{modules.length}</span>
      </div>
      {modules.length ? (
        <ul className="grid gap-2">
          {modules.map((module) => (
            <li key={module.moduleCode} className="grid gap-1 rounded-[1rem] border border-slate-900/8 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">{module.moduleName}</span>
                <span className={module.accessLevel === "Included"
                  ? "badge badge-success badge-soft border-0"
                  : "badge badge-warning badge-soft border-0"}>
                  {module.accessLevel}
                </span>
              </div>
              <span className="text-xs leading-5 text-slate-500">{module.summary}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[1rem] border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
          No modules from this channel are included in the selected tier.
        </p>
      )}
    </div>
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

function getTierBenefitPresentation(
  tier: SubscriptionTierCard,
  tiers: SubscriptionTierCard[]
): TierBenefitPresentation {
  const inheritedTiers = getInheritedTiers(tier, tiers);
  const inheritedAccess = new Map<string, number>();

  inheritedTiers.forEach((inheritedTier) => {
    inheritedTier.modules.forEach((module) => {
      const currentRank = inheritedAccess.get(module.moduleCode) ?? 0;
      const nextRank = getAccessRank(module.accessLevel);
      if (nextRank > currentRank) {
        inheritedAccess.set(module.moduleCode, nextRank);
      }
    });
  });

  return {
    inheritedTierLabels: inheritedTiers.map((inheritedTier) => getTierLabel(inheritedTier)),
    incrementalModules: tier.modules.filter((module) => {
      const inheritedRank = inheritedAccess.get(module.moduleCode) ?? 0;
      return getAccessRank(module.accessLevel) > inheritedRank;
    }),
    totalModuleCount: tier.modules.length
  };
}

function getInheritedTiers(tier: SubscriptionTierCard, tiers: SubscriptionTierCard[]) {
  const inheritedTiers: SubscriptionTierCard[] = [];
  const tierSegmentIndex = segmentOrder.indexOf(tier.businessSizeSegment);
  const previousSegment = tierSegmentIndex > 0 ? segmentOrder[tierSegmentIndex - 1] : null;

  if (tier.subscriptionEdition === "Standard" && previousSegment) {
    const previousStandardTier = findTier(tiers, "Standard", previousSegment);
    if (previousStandardTier) {
      inheritedTiers.push(previousStandardTier);
    }
  }

  if (tier.subscriptionEdition === "Premium") {
    const sameSegmentStandardTier = findTier(tiers, "Standard", tier.businessSizeSegment);
    if (sameSegmentStandardTier) {
      inheritedTiers.push(sameSegmentStandardTier);
    }

    if (previousSegment) {
      const previousPremiumTier = findTier(tiers, "Premium", previousSegment);
      if (previousPremiumTier) {
        inheritedTiers.push(previousPremiumTier);
      }
    }
  }

  return inheritedTiers.filter((inheritedTier, index, rows) =>
    rows.findIndex((row) => row.id === inheritedTier.id) === index
  );
}

function findTier(tiers: SubscriptionTierCard[], edition: string, segment: string) {
  return tiers.find((tier) =>
    tier.subscriptionEdition === edition &&
    tier.businessSizeSegment === segment
  );
}

function getTierLabel(tier: SubscriptionTierCard) {
  return `${tier.subscriptionEdition} ${tier.businessSizeSegment}`;
}

function getAccessRank(accessLevel: string) {
  return accessLevelRank[accessLevel.trim().toLowerCase()] ?? 0;
}

function formatTierList(tierLabels: string[]) {
  if (tierLabels.length <= 1) {
    return tierLabels[0] ?? "";
  }

  return `${tierLabels.slice(0, -1).join(", ")} and ${tierLabels[tierLabels.length - 1]}`;
}

function compareTiers(first: SubscriptionTierCard, second: SubscriptionTierCard) {
  const firstSegment = segmentOrder.indexOf(first.businessSizeSegment);
  const secondSegment = segmentOrder.indexOf(second.businessSizeSegment);
  const segmentComparison = (firstSegment === -1 ? Number.MAX_SAFE_INTEGER : firstSegment) -
    (secondSegment === -1 ? Number.MAX_SAFE_INTEGER : secondSegment);

  if (segmentComparison !== 0) {
    return segmentComparison;
  }

  return first.displayName.localeCompare(second.displayName);
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
