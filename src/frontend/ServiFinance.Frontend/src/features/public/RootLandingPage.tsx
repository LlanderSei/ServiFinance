import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { CurrentSessionUser } from "@/shared/api/contracts";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import { RootLoginModal } from "@/shared/public/RootLoginModal";

function getAuthenticatedHomeRoute(user: CurrentSessionUser) {
  if (user.roles.includes("SuperAdmin")) {
    return "/dashboard";
  }

  return user.surface === "TenantDesktop"
    ? `/t/${user.tenantDomainSlug}/mls/dashboard`
    : `/t/${user.tenantDomainSlug}/sms/dashboard`;
}

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
    <div className="marketing-page">
      <PublicHeader onLoginRequested={openLogin} />

      <main>
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Dual-system SaaS for MSMEs</p>
            <h1>Run service operations on the web and lending operations on desktop without splitting your business context.</h1>
            <p className="lede">
              ServiFinance gives operators one control plane for tenant provisioning, one web workspace for service workflows,
              and one desktop surface for structured micro-lending execution.
            </p>
            <div className="hero__actions">
              <button type="button" className="button button--primary" onClick={openLogin}>Login</button>
              <Link to="/register" className="button button--ghost">Register your business</Link>
            </div>
          </div>

          <div className="hero__rail">
            <article className="surface-card">
              <p className="eyebrow">Root domain</p>
              <h3>SaaS dashboard</h3>
              <p>Oversee subscriptions, tenants, and product adoption from the platform surface.</p>
            </article>
            <article className="surface-card">
              <p className="eyebrow">Service Management System</p>
              <h3>Browser-first operations</h3>
              <p>Intake, scheduling, dispatching, invoicing, and tenant admin workflows.</p>
            </article>
            <article className="surface-card">
              <p className="eyebrow">Micro-Lending System</p>
              <h3>Desktop-grade execution</h3>
              <p>Collections, schedules, loan records, and lending operations under the same tenant identity.</p>
            </article>
          </div>
        </section>

        <section className="detail-section" id="platform">
          <div className="section-heading">
            <p className="eyebrow">Platform</p>
            <h2>One backend, two delivery surfaces, one tenant-aware operating model.</h2>
          </div>
          <div className="detail-grid">
            <div>
              <strong>Multi-tenant SaaS core</strong>
              <p>Root-domain provisioning, tenant identity, subscription controls, and role-aware access are handled centrally.</p>
            </div>
            <div>
              <strong>SMS on the web</strong>
              <p>Service requests, scheduling, status tracking, invoicing, and operator dashboards stay browser-first.</p>
            </div>
            <div>
              <strong>MLS on desktop</strong>
              <p>Loan conversion, amortization, ledger actions, and payment-oriented workflows get a desktop shell when the plan allows it.</p>
            </div>
          </div>
        </section>

        <section className="detail-section" id="plans">
          <div className="section-heading">
            <p className="eyebrow">Plans</p>
            <h2>Seed-backed subscription tiers from the live backend catalog.</h2>
          </div>
          <div className="tier-grid">
            {visibleTiers.map((tier) => (
              <article key={tier.id} className="tier-card">
                <span className="tier-card__label">{tier.highlightLabel || tier.code}</span>
                <h3>{tier.displayName}</h3>
                <p className="tier-card__kicker">{tier.businessSizeSegment} business • {tier.subscriptionEdition} edition</p>
                <p>{tier.description}</p>
                <strong>{tier.priceDisplay}</strong>
                <small>{tier.billingLabel}</small>
                <p>{tier.modules.length} modules unlocked</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section" id="workflow">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Provision once, operate by tenant, expand capability by plan.</h2>
          </div>
          <ol className="workflow-list">
            <li><strong>Subscribe and provision</strong><span>Create the tenant, assign the plan, and activate the business domain.</span></li>
            <li><strong>Run SMS on web</strong><span>Manage service intake, dispatching, and invoicing from the tenant web surface.</span></li>
            <li><strong>Unlock MLS on desktop</strong><span>Premium tenants extend into desktop lending and ledger workflows without changing identity.</span></li>
          </ol>
        </section>
      </main>

      <PublicFooter />
      <RootLoginModal open={loginOpen} error={error} onClose={closeLogin} />
    </div>
  );
}
