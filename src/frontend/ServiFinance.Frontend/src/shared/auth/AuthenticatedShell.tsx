import type { ReactNode } from "react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { CurrentSessionUser } from "@/shared/api/contracts";
import { isDesktopShell } from "@/platform/runtime";
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
  const sections = useMemo(() => buildAuthSections(user), [user]);
  const desktopShell = isDesktopShell();

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

  return (
    <div
      data-platform={desktopShell ? "desktop" : "web"}
      data-theme={theme === "dark" ? "servifinance-dark" : "servifinance-light"}
      className={`grid h-dvh min-h-0 grid-cols-1 overflow-hidden text-base-content ${shellTransitionClass} ${shellWidthClass} ${shellThemeClass}`}
    >
      <AuthSidebar
        user={user}
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
      />

      <section className="min-w-0 min-h-0 overflow-hidden bg-base-100 text-base-content">
        {children}
      </section>
    </div>
  );
}
