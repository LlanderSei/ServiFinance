import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import type { CustomerSession } from "./customerAuth";
import { logoutCustomerAccount } from "./customerAuth";
import { buildCustomerNav } from "./customerNav";

type Props = {
  session: CustomerSession | null;
  children: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CustomerShell({ session, children }: Props) {
  const { tenantDomainSlug = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navItems = buildCustomerNav(tenantDomainSlug);
  const isAuthenticated = session !== null;

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  async function handleLogout() {
    await logoutCustomerAccount();
    navigate(`/t/${tenantDomainSlug}/c/login`, { replace: true });
  }

  const authLinks = isAuthenticated
    ? navItems
    : [
        {
          to: `/t/${tenantDomainSlug}/c/login`,
          label: "Login",
          eyebrow: "Access"
        },
        {
          to: `/t/${tenantDomainSlug}/c/register`,
          label: "Register",
          eyebrow: "Create"
        }
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(163,202,255,0.24),transparent_24%),linear-gradient(180deg,#f7fbff_0%,#eff4fb_46%,#f5f7fb_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] overflow-hidden lg:px-5 lg:py-5">
        <div
          className={joinClasses(
            "fixed inset-0 z-40 bg-slate-950/34 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
            isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={joinClasses(
            "fixed inset-y-0 left-0 z-50 flex w-[min(86vw,21rem)] flex-col border-r border-slate-200/70 bg-white/96 px-4 py-5 shadow-[0_22px_50px_rgba(33,44,74,0.18)] backdrop-blur-xl transition-transform duration-300 lg:static lg:w-[290px] lg:translate-x-0 lg:rounded-[2rem] lg:border lg:shadow-[0_20px_45px_rgba(42,56,92,0.08)]",
            isDrawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,#102147_0%,#2d5fff_100%)] text-sm font-semibold uppercase tracking-[0.16em] text-white">
                C
              </span>
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">Customer Portal</p>
                <h1 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{tenantDomainSlug}</h1>
              </div>
            </div>

            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 lg:hidden"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close customer navigation"
            >
              <span className="text-xl leading-none">&lt;</span>
            </button>
          </div>

          <div className="mt-8 rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(240,246,255,0.92),rgba(255,255,255,0.92))] px-4 py-4">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-slate-500">
              {isAuthenticated ? "Signed in" : "Tenant-scoped access"}
            </p>
            {session ? (
              <>
                <strong className="mt-2 block text-lg text-slate-950">{session.fullName}</strong>
                <p className="mt-1 text-sm text-slate-600">{session.email}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your customer profile and activity stay isolated inside this tenant domain.
                </p>
              </>
            ) : (
              <>
                <strong className="mt-2 block text-lg text-slate-950">Separate from SMS staff access</strong>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Customer login and registration stay under `/t/&lbrace;tenant&rbrace;/c/*` so tenant staff and customer journeys do not mix.
                </p>
              </>
            )}
          </div>

          <nav className="mt-8 grid gap-2">
            {authLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  joinClasses(
                    "group rounded-[1.4rem] px-4 py-3 no-underline transition-colors duration-200",
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={joinClasses(
                        "block text-[0.7rem] font-bold uppercase tracking-[0.2em]",
                        isActive ? "text-white/60" : "text-slate-400"
                      )}
                    >
                      {item.eyebrow}
                    </span>
                    <span className="mt-1 block text-sm font-semibold tracking-[0.01em]">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-6">
            {isAuthenticated ? (
              <button
                type="button"
                className="btn w-full rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100"
                onClick={handleLogout}
              >
                Sign out
              </button>
            ) : (
              <p className="px-2 text-sm leading-6 text-slate-500">
                Accounts are tenant-scoped. Registering here does not create access for other tenant domains.
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-5">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/70 bg-white/84 px-4 py-4 backdrop-blur-xl lg:rounded-[2rem] lg:border lg:px-6 lg:shadow-[0_16px_34px_rgba(35,46,76,0.06)]">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open customer navigation"
              >
                <span className="flex flex-col gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                </span>
              </button>

              <div className="min-w-0">
                <p className="truncate text-[0.72rem] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {tenantDomainSlug} / Customer
                </p>
                <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  {session ? `Welcome back, ${session.fullName.split(" ")[0]}` : "Customer Access"}
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                {session ? session.email : "Tenant-scoped registration and login"}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">
            <div className="mx-auto w-full max-w-[1120px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
