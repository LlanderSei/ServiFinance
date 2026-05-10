import type { CSSProperties, ReactNode } from "react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CurrentSessionUser } from "@/shared/api/contracts";
import { isDesktopShell } from "@/platform/runtime";
import {
  applyTenantBrandingToDocument,
  clearTenantBrandingFromDocument,
  defaultTenantBranding,
  fetchTenantBranding,
  tenantBrandingQueryKey
} from "@/shared/tenant/tenantBranding";
import { AuthSidebar } from "./shell/AuthSidebar";
import { buildAuthSections } from "./shell/navigation";

type Props = {
  user: CurrentSessionUser;
  children: ReactNode;
};

const SIDEBAR_EXPANDED_KEY = "sf:sidebar:expanded";
const SIDEBAR_SECTIONS_KEY = "sf:sidebar:sections";
const SIDEBAR_THEME_KEY = "sf:sidebar:theme";

type ShellTheme = "light" | "dark";

export function AuthenticatedShell({ user, children }: Props) {
  const [shellUser, setShellUser] = useState(user);
  const sections = useMemo(() => buildAuthSections(shellUser), [shellUser]);
  const desktopShell = isDesktopShell();
  const hasAnyVisiblePermission = shellUser.surface === "CustomerWeb" || sections.some((section) => section.items.length > 0);
  const canUseTenantBranding = shellUser.surface !== "Root" && Boolean(shellUser.tenantDomainSlug);
  const tenantBrandingQuery = useQuery({
    queryKey: tenantBrandingQueryKey(shellUser.tenantDomainSlug),
    queryFn: () => fetchTenantBranding(shellUser.tenantDomainSlug),
    enabled: canUseTenantBranding,
    staleTime: 60_000
  });
  const tenantBranding = canUseTenantBranding
    ? tenantBrandingQuery.data ?? { ...defaultTenantBranding, domainSlug: shellUser.tenantDomainSlug }
    : null;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const saved = window.localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    return saved === null ? true : saved === "true";
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const saved = window.localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (!saved) {
      return {};
    }

    try {
      return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  const [theme, setTheme] = useState<ShellTheme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const saved = window.localStorage.getItem(SIDEBAR_THEME_KEY);
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    setShellUser(user);
  }, [user]);

  useEffect(() => {
    if (!canUseTenantBranding) {
      clearTenantBrandingFromDocument();
      return;
    }

    if (!tenantBrandingQuery.data) {
      return;
    }

    applyTenantBrandingToDocument(tenantBrandingQuery.data);

    return () => {
      clearTenantBrandingFromDocument();
    };
  }, [canUseTenantBranding, tenantBrandingQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_THEME_KEY, theme);
  }, [theme]);

  const shellWidthClass = isExpanded
    ? "md:grid-cols-[290px_minmax(0,1fr)]"
    : "md:grid-cols-[88px_minmax(0,1fr)]";
  const shellTransitionClass = desktopShell
    ? "transition-[grid-template-columns] duration-300 ease-out"
    : "";
  const shellThemeClass = desktopShell
    ? theme === "dark"
      ? "bg-[radial-gradient(circle_at_top_left,rgba(67,116,255,0.16),transparent_24%),linear-gradient(180deg,#111626_0%,#0d1220_100%)]"
      : "bg-[radial-gradient(circle_at_top_left,rgba(210,233,255,0.42),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#f1f4fb_100%)]"
    : theme === "dark"
      ? "bg-[#0d1220]"
      : "bg-[#f3f6fc]";
  const shellStyle = tenantBranding?.pageBackgroundColor
    ? ({ background: tenantBranding.pageBackgroundColor } satisfies CSSProperties)
    : undefined;

  return (
    <div
      data-platform={desktopShell ? "desktop" : "web"}
      data-theme={theme === "dark" ? "servifinance-dark" : "servifinance-light"}
      className={`grid h-dvh min-h-0 grid-cols-1 overflow-hidden text-base-content ${shellTransitionClass} ${shellWidthClass} ${shellThemeClass}`}
      style={shellStyle}
    >
      <AuthSidebar
        user={shellUser}
        tenantBranding={tenantBranding}
        sections={sections}
        isExpanded={isExpanded}
        theme={theme}
        collapsedSections={collapsedSections}
        onToggleExpanded={() => startTransition(() => setIsExpanded((current) => !current))}
        onToggleTheme={() => startTransition(() => setTheme((current) => (current === "light" ? "dark" : "light")))}
        onToggleSection={(sectionKey) =>
          startTransition(() => {
            setCollapsedSections((current) => ({
              ...current,
              [sectionKey]: !current[sectionKey]
            }));
          })
        }
        onUserUpdated={(patch) =>
          startTransition(() => {
            setShellUser((current) => ({
              ...current,
              ...patch
            }));
          })
        }
      />

      <section className="min-w-0 min-h-0 overflow-hidden bg-base-100 text-base-content">
        {hasAnyVisiblePermission ? children : (
          <main className="grid h-full place-items-center p-6">
            <section className="max-w-xl rounded-[2rem] border border-base-300/70 bg-base-100 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
                No workspace views
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-base-content">
                This account has no available workspace views yet.
              </h1>
              <p className="mt-3 text-sm leading-6 text-base-content/68">
                The account can sign in, but its assigned roles and the active tenant plan do not currently unlock any visible workspace screens. Ask an owner or administrator to add a view permission or update the plan module access.
              </p>
            </section>
          </main>
        )}
      </section>
    </div>
  );
}
