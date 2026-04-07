import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { CurrentSessionUser } from "@/shared/api/contracts";
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

  return (
    <div className={`authed-shell${isExpanded ? "" : " is-collapsed"}${theme === "dark" ? " theme-dark" : ""}`}>
      <AuthSidebar
        user={user}
        sections={sections}
        isExpanded={isExpanded}
        theme={theme}
        collapsedSections={collapsedSections}
        onToggleExpanded={() => setIsExpanded((current) => !current)}
        onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        onToggleSection={(sectionKey) =>
          setCollapsedSections((current) => ({
            ...current,
            [sectionKey]: !current[sectionKey]
          }))
        }
      />

      <section className="authed-shell__content">
        {children}
      </section>
    </div>
  );
}
