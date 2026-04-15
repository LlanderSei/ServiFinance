import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { getAuthenticatedHomeRoute } from "@/shared/auth/routing";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicActionRow,
  PublicBadge,
  PublicButton,
  PublicButtonLink,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell,
  PublicWorkflowList
} from "@/shared/public/PublicPrimitives";
import { RootLoginModal } from "@/shared/public/RootLoginModal";

export function RootLandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualOpen, setManualOpen] = useState(false);
  const { data: session } = useRefreshSession();
  const { data: tiers } = useSubscriptionTiers();
  const loginOpen = manualOpen || searchParams.get("showLogin") === "true";
  const error = searchParams.get("error");

  const visibleTiers = useMemo(() => tiers ?? [], [tiers]);

  if (session) {
    return <Navigate to={getAuthenticatedHomeRoute(session.user)} replace />;
  }

  const openLogin = () => setManualOpen(true);
  const closeLogin = () => {
    setManualOpen(false);
    if (searchParams.has("showLogin") || searchParams.has("error")) {
      const next = new URLSearchParams(searchParams);
      next.delete("showLogin");
      next.delete("error");
      next.delete("returnUrl");
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <PublicShell>
      <PublicHeader onLoginRequested={openLogin} />

      <main>
        <PublicContainer className="relative min-h-[calc(100svh-8.5rem)] pb-18 pt-12 md:pr-[min(36rem,45vw)]">
          <div className="relative z-[1] max-w-[min(40rem,100%)]">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Dual-system SaaS for MSMEs</p>
            <h1 className="mt-3 max-w-[9.5ch] font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(3.9rem,7.2vw,6.7rem)] leading-[0.9] tracking-[-0.055em] text-slate-950 text-balance">
              Run service operations on the web and lending operations on desktop without splitting your business context.
            </h1>
            <p className="mt-5 max-w-[36rem] text-[1.08rem] leading-[1.75] text-slate-500">
              ServiFinance gives operators one control plane for tenant provisioning, one web workspace for service workflows,
              and one desktop surface for structured micro-lending execution.
            </p>
            <PublicActionRow>
              <PublicButton tone="primary" onClick={openLogin}>Login</PublicButton>
              <PublicButtonLink to="/register" tone="ghost">Register your business</PublicButtonLink>
            </PublicActionRow>
          </div>

          <div className="mt-8 grid gap-4 md:absolute md:right-7 md:top-1/2 md:mt-0 md:w-[min(31rem,42vw)] md:-translate-y-1/2">
            <PublicCard className="justify-self-end md:w-[min(100%,17.5rem)] md:-translate-x-4">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Root domain</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">SaaS dashboard</h3>
              <p className="mt-2 text-slate-600">Oversee subscriptions, tenants, and product adoption from the platform surface.</p>
            </PublicCard>

            <PublicCard className="justify-self-start md:w-[min(100%,28rem)] md:translate-x-2">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Service Management System</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">Browser-first operations</h3>
              <p className="mt-2 text-slate-600">Intake, scheduling, dispatching, invoicing, and tenant admin workflows.</p>
            </PublicCard>

            <PublicCard className="justify-self-end md:w-[min(100%,26rem)] md:-translate-x-1">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Micro-Lending System</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">Desktop-grade execution</h3>
              <p className="mt-2 text-slate-600">Collections, schedules, loan records, and lending operations under the same tenant identity.</p>
            </PublicCard>
          </div>
        </PublicContainer>

        <section id="platform" className="py-10 [content-visibility:auto] [contain-intrinsic-size:720px]">
          <PublicContainer>
            <PublicSectionHeading
              eyebrow="Platform"
              title="One backend, two delivery surfaces, one tenant-aware operating model."
            />
            <div className="mt-7 grid gap-6 md:grid-cols-3">
              <div className="border-t border-slate-900/12 pt-4">
                <strong>Multi-tenant SaaS core</strong>
                <p className="mt-2 text-slate-600">Root-domain provisioning, tenant identity, subscription controls, and role-aware access are handled centrally.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>SMS on the web</strong>
                <p className="mt-2 text-slate-600">Service requests, scheduling, status tracking, invoicing, and operator dashboards stay browser-first.</p>
              </div>
              <div className="border-t border-slate-900/12 pt-4">
                <strong>MLS on desktop</strong>
                <p className="mt-2 text-slate-600">Loan conversion, amortization, ledger actions, and payment-oriented workflows get a desktop shell when the plan allows it.</p>
              </div>
            </div>
          </PublicContainer>
        </section>

        <section id="plans" className="py-10 [content-visibility:auto] [contain-intrinsic-size:720px]">
          <PublicContainer>
            <PublicSectionHeading
              eyebrow="Plans"
              title="Seed-backed subscription tiers from the live backend catalog."
            />
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {visibleTiers.map((tier, index) => (
                <PublicCard
                  key={tier.id}
                  className={index % 2 === 1 ? "bg-gradient-to-b from-[rgba(214,247,241,0.78)] to-[rgba(255,255,255,0.8)]" : ""}
                >
                  <PublicBadge>{tier.highlightLabel || tier.code}</PublicBadge>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{tier.displayName}</h3>
                  <p className="mt-2 text-[0.92rem] text-slate-500">{tier.businessSizeSegment} business • {tier.subscriptionEdition} edition</p>
                  <p className="mt-3 text-slate-700">{tier.description}</p>
                  <div className="mt-4 grid gap-1">
                    <strong className="text-lg text-slate-950">{tier.priceDisplay}</strong>
                    <small className="text-slate-500">{tier.billingLabel}</small>
                  </div>
                  <p className="mt-4 text-slate-600">{tier.modules.length} modules unlocked</p>
                </PublicCard>
              ))}
            </div>
          </PublicContainer>
        </section>

        <section id="workflow" className="py-10 [content-visibility:auto] [contain-intrinsic-size:720px]">
          <PublicContainer>
            <PublicSectionHeading
              eyebrow="How it works"
              title="Provision once, operate by tenant, expand capability by plan."
            />
            <PublicWorkflowList className="mt-7">
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Subscribe and provision</strong><span className="text-slate-600">Create the tenant, assign the plan, and activate the business domain.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Run SMS on web</strong><span className="text-slate-600">Manage service intake, dispatching, and invoicing from the tenant web surface.</span></li>
              <li className="grid gap-1 border-t border-slate-900/10 pt-4"><strong>Unlock MLS on desktop</strong><span className="text-slate-600">Premium tenants extend into desktop lending and ledger workflows without changing identity.</span></li>
            </PublicWorkflowList>
          </PublicContainer>
        </section>
      </main>

      <PublicFooter />
      <RootLoginModal open={loginOpen} error={error} onClose={closeLogin} />
    </PublicShell>
  );
}
