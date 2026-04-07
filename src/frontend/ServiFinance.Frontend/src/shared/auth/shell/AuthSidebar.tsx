import { Link, NavLink } from "react-router-dom";
import type { CurrentSessionUser } from "@/shared/api/contracts";
import { useLogout } from "../useLogout";
import { SidebarIcon } from "./SidebarIcon";
import type { NavSection } from "./navigation";

type Props = {
  user: CurrentSessionUser;
  sections: NavSection[];
  isExpanded: boolean;
  theme: "light" | "dark";
  collapsedSections: Record<string, boolean>;
  onToggleExpanded: () => void;
  onToggleTheme: () => void;
  onToggleSection: (sectionKey: string) => void;
};

export function AuthSidebar({
  user,
  sections,
  isExpanded,
  theme,
  collapsedSections,
  onToggleExpanded,
  onToggleTheme,
  onToggleSection
}: Props) {
  const logout = useLogout();
  const isSuperAdmin = user.roles.includes("SuperAdmin");
  const displayTitle = isSuperAdmin ? "ServiFinance" : user.tenantDomainSlug;
  const displaySubtitle = isSuperAdmin ? "Platform control plane" : user.email;
  const mark = isSuperAdmin ? "SF" : user.tenantDomainSlug.slice(0, 2).toUpperCase();

  return (
    <aside className="authed-shell__sidebar">
      <button
        type="button"
        className="authed-sidebar__toggle"
        onClick={onToggleExpanded}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <SidebarIcon name={isExpanded ? "collapse" : "expand"} />
      </button>

      <div className="authed-shell__header">
        <Link to={sections[0]?.items[0]?.to ?? "/"} className="brand">
          <span className="brand__mark">{mark}</span>
          {isExpanded ? (
            <span>
              <strong>{displayTitle}</strong>
              <small>{displaySubtitle}</small>
            </span>
          ) : null}
        </Link>
      </div>

      <button type="button" className="authed-user-card" title={user.fullName}>
        <span className="authed-user-card__avatar">{user.fullName.slice(0, 2).toUpperCase()}</span>
        {isExpanded ? (
          <span className="authed-user-card__meta">
            <strong>{user.fullName}</strong>
            <small>{isSuperAdmin ? "SuperAdmin" : user.roles.join(" / ")}</small>
          </span>
        ) : null}
      </button>

      <nav className="authed-nav">
        {sections.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.key]);

          return (
            <div key={section.key} className="authed-nav__section">
              {isExpanded ? (
                <button
                  type="button"
                  className="authed-nav__section-toggle"
                  onClick={() => onToggleSection(section.key)}
                >
                  <span>{section.title}</span>
                  <span className={`authed-nav__section-chevron${isSectionCollapsed ? " is-collapsed" : ""}`}>
                    <SidebarIcon name="chevron" />
                  </span>
                </button>
              ) : null}

              <div className={`authed-nav__items${isExpanded && isSectionCollapsed ? " is-hidden" : ""}`}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={!isExpanded ? item.label : undefined}
                    className={({ isActive }) => `authed-nav__item${isActive ? " is-active" : ""}`}
                  >
                    <span className="authed-nav__item-icon">
                      <SidebarIcon name={item.icon} />
                    </span>
                    {isExpanded ? <span className="authed-nav__item-label">{item.label}</span> : null}
                    {isExpanded && item.badge ? <span className="authed-nav__item-badge">{item.badge}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="authed-sidebar__footer">
        <button
          type="button"
          className="authed-sidebar__theme"
          onClick={onToggleTheme}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          <span className="authed-nav__item-icon">
            <SidebarIcon name={theme === "light" ? "moon" : "sun"} />
          </span>
          {isExpanded ? <span>{theme === "light" ? "Dark theme" : "Light theme"}</span> : null}
        </button>

        <button type="button" className="authed-sidebar__logout" onClick={() => void logout()} title="Logout">
          <span className="authed-nav__item-icon">
            <SidebarIcon name="logout" />
          </span>
          {isExpanded ? <span>Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
