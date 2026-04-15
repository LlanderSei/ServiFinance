import { useQuery } from "@tanstack/react-query";
import { refreshSession } from "@/shared/auth/session";
import { PublicButtonLink, PublicContainer, PublicShell } from "@/shared/public/PublicPrimitives";

export function DesktopRequiredPage() {
  const { data: session } = useQuery({
    queryKey: ["auth", "refresh", "optional"],
    queryFn: refreshSession,
    retry: false
  });

  const tenantSmsRoute = session?.user.roles.includes("SuperAdmin")
    ? "/dashboard"
    : session?.user.tenantDomainSlug
      ? `/t/${session.user.tenantDomainSlug}/sms/dashboard`
      : "/";

  return (
    <PublicShell>
      <main className="py-10 sm:py-14">
        <PublicContainer className="grid min-h-[calc(100svh-5rem)] items-center">
          <section className="mx-auto grid w-full max-w-[64rem] gap-8 rounded-[2.2rem] border border-slate-200/70 bg-[rgba(255,255,255,0.78)] p-7 shadow-[0_26px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl md:grid-cols-[minmax(0,1.1fr)_minmax(18rem,24rem)] md:p-10">
            <div>
              <p className="text-[0.76rem] font-bold uppercase tracking-[0.22em] text-slate-500">Desktop required</p>
              <h1 className="mt-3 max-w-[12ch] font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(3rem,5vw,4.8rem)] leading-[0.94] tracking-[-0.055em] text-slate-950">
                MLS is available only in the standalone desktop app.
              </h1>
              <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.8] text-slate-600">
                Browser access to the Micro-Lending System is intentionally blocked. Use the standalone desktop terminal for MLS, and keep SMS workflows in the web application.
              </p>

              <div className="mt-8 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
                <div className="border-t border-slate-200 pt-4">
                  <strong className="block text-slate-950">MLS on desktop</strong>
                  <span className="mt-2 block">Loan conversion, amortization, payments, and ledger work stay in the installed desktop client.</span>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <strong className="block text-slate-950">SMS on web</strong>
                  <span className="mt-2 block">Service intake, dispatch, reporting, and user management remain browser-accessible.</span>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <strong className="block text-slate-950">Same tenant identity</strong>
                  <span className="mt-2 block">Tenant credentials stay shared, but MLS only opens from the standalone desktop surface.</span>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.8rem] border border-slate-200 bg-white/82 p-6 shadow-sm">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">What to do next</p>
              <ol className="mt-5 grid gap-4 text-sm leading-[1.7] text-slate-600">
                <li className="border-t border-slate-200 pt-4">
                  Open the installed ServiFinance Desktop application to reach the MLS login dashboard at `/t/mls/`.
                </li>
                <li className="border-t border-slate-200 pt-4">
                  Use the web application only for SMS workflows and tenant administration.
                </li>
              </ol>

              <div className="mt-7 flex flex-wrap gap-3">
                <PublicButtonLink to={tenantSmsRoute} tone="primary">
                  Open Web Workspace
                </PublicButtonLink>
                <PublicButtonLink to="/" tone="ghost">
                  Back to home
                </PublicButtonLink>
              </div>
            </aside>
          </section>
        </PublicContainer>
      </main>
    </PublicShell>
  );
}
