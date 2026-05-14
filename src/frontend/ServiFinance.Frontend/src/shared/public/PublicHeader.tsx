import { Link, useLocation, useMatches } from "react-router-dom";
import { toPlatformRoute } from "@/platform/runtime";
import { PublicButton, PublicButtonLink } from "@/shared/public/PublicPrimitives";

type Props = {
  onLoginRequested?: () => void;
  /** Tenant branding to display in the logo slot (used on tenant landing pages) */
  tenantDisplayName?: string | null;
  tenantLogoUrl?: string | null;
};

export function PublicHeader({ onLoginRequested, tenantDisplayName, tenantLogoUrl }: Props) {
  const location = useLocation();
  const matches = useMatches();
  const isRegister = location.pathname === "/register";
  // Hide the root-only nav links when inside a tenant route (/t/:slug/*)
  const isTenantRoute = matches.some(m => (m.params as Record<string, string>).tenantDomainSlug !== undefined);

  const handleLogin = () => {
    if (onLoginRequested) {
      onLoginRequested();
      return;
    }

    window.location.assign(toPlatformRoute("/?showLogin=true"));
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Logo slot content — use tenant branding if provided, else show platform defaults
  const logoBlock = tenantDisplayName ? (
    <>
          {tenantLogoUrl ? (
            <img
              src={tenantLogoUrl}
              alt={tenantDisplayName}
              className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-bold text-white shadow-sm"
              style={{ background: "var(--tenant-primary-color, linear-gradient(135deg, #53d5cb, #7c9cff))" }}
            >
              {tenantDisplayName.charAt(0).toUpperCase()}
            </span>
          )}
      <span className="min-w-0">
        <strong className="block truncate text-base tracking-[-0.02em] text-slate-950">{tenantDisplayName}</strong>
      </span>
    </>
  ) : (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#53d5cb] via-[#7c9cff] to-[#8f7dff] font-bold text-white shadow-[0_16px_34px_rgba(107,145,255,0.22)]">
        SF
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-base tracking-[-0.02em] text-slate-950">ServiFinance</strong>
        <small className="hidden truncate text-slate-500 sm:block">Unified operations and lending</small>
      </span>
    </>
  );

  return (
    <header className="sticky top-0 z-20 px-2 pt-2 sm:px-0 sm:pt-6">
      <div className="mx-auto w-full max-w-[1260px] sm:px-7">
        <div className="flex w-full items-center justify-between gap-2 rounded-[1.35rem] border border-white/70 bg-white/92 px-3 py-3 shadow-[0_16px_34px_rgba(35,46,76,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm sm:gap-4 sm:rounded-full sm:px-4 sm:py-4">
          <Link to="/" className="inline-flex min-w-0 items-center gap-2 text-inherit no-underline sm:gap-3">
            {logoBlock}
          </Link>

          {!isRegister && !isTenantRoute && (
            <nav className="hidden gap-8 md:inline-flex">
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("platform")}>Platform</button>
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("plans")}>Plans</button>
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("workflow")}>How It Works</button>
            </nav>
          )}

          <div className="flex shrink-0 gap-2 sm:gap-3">
            <PublicButton className="px-2.5 text-xs sm:px-4 sm:text-sm" tone="ghost" onClick={handleLogin}>
              Login
            </PublicButton>
            {!isTenantRoute && (
              <PublicButtonLink className="px-2.5 text-xs sm:px-4 sm:text-sm" to={isRegister ? "/" : "/register"} tone="primary">
                {isRegister ? "Back Home" : "Register"}
              </PublicButtonLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
