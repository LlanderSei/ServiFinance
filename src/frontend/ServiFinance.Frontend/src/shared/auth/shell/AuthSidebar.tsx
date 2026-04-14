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
  const railSpacingClass = isExpanded
    ? "items-stretch md:px-4 md:pr-[1.65rem]"
    : "items-center md:px-[0.7rem] md:pr-[0.7rem]";
  const navItemBaseClass = isExpanded
    ? "w-full justify-start px-4 py-3"
    : "mx-auto h-[2.9rem] w-[2.9rem] justify-center px-0 py-3";
  const footerButtonClass = isExpanded
    ? "w-full justify-start px-4 py-3"
    : "mx-auto h-[2.9rem] w-[2.9rem] justify-center px-0 py-3";

  return (
    <aside
      className={`authed-shell__sidebar relative flex h-auto flex-col gap-4 border-r border-base-300/50 bg-base-100/90 p-4 shadow-sm backdrop-blur transition-[padding] duration-300 ease-out md:sticky md:top-0 md:h-dvh ${railSpacingClass}`}
    >
      <button
        type="button"
        className="authed-sidebar__toggle btn btn-circle btn-sm static self-start border-base-300/60 bg-base-100/90 text-base-content shadow-sm transition-transform duration-200 hover:scale-105 md:absolute md:top-1/2 md:right-0 md:z-10 md:-translate-y-1/2 md:translate-x-1/2"
        onClick={onToggleExpanded}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <SidebarIcon name={isExpanded ? "collapse" : "expand"} />
      </button>

      <div
        className={`authed-shell__header border-b border-base-300/50 pb-2 transition-[padding] duration-300 ease-out ${isExpanded ? "" : "flex justify-center"}`}
      >
        <Link
          to={sections[0]?.items[0]?.to ?? "/"}
          className={`inline-flex items-center gap-3 text-base-content no-underline ${isExpanded ? "" : "justify-center"}`}
        >
          <span className="grid h-[2.85rem] w-[2.85rem] place-items-center rounded-2xl bg-gradient-to-br from-[#53d5cb] via-[#7c9cff] to-[#8f7dff] font-bold text-white shadow-[0_16px_34px_rgba(107,145,255,0.22)]">
            {mark}
          </span>
          {isExpanded ? (
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold">{displayTitle}</strong>
              <small className="block truncate text-xs text-base-content/60">{displaySubtitle}</small>
            </span>
          ) : null}
        </Link>
      </div>

      <button
        type="button"
        className={`authed-user-card flex w-full items-center gap-3 rounded-box border border-base-300/50 bg-base-100/60 p-2 text-left shadow-sm transition-[padding] duration-300 ease-out ${isExpanded ? "" : "justify-center"}`}
        title={user.fullName}
      >
        <span className="authed-user-card__avatar inline-flex h-[2.7rem] w-[2.7rem] items-center justify-center rounded-full bg-primary/15 text-[0.86rem] font-bold tracking-[0.04em] text-primary">
          {user.fullName.slice(0, 2).toUpperCase()}
        </span>
        {isExpanded ? (
          <span className="authed-user-card__meta grid min-w-0 gap-[0.15rem]">
            <strong className="truncate">{user.fullName}</strong>
            <small className="truncate text-base-content/60">{isSuperAdmin ? "SuperAdmin" : user.roles.join(" / ")}</small>
          </span>
        ) : null}
      </button>

      <nav className="authed-nav flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
        {sections.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.key]);

          return (
            <div key={section.key} className="authed-nav__section grid gap-[0.35rem]">
              {isExpanded ? (
                <button
                  type="button"
                  className="authed-nav__section-toggle flex w-full items-center justify-between gap-4 bg-transparent px-[0.35rem] text-left text-[0.73rem] font-bold uppercase tracking-[0.08em] text-base-content/65 transition-colors duration-200 hover:text-base-content"
                  onClick={() => onToggleSection(section.key)}
                >
                  <span>{section.title}</span>
                  <span className={`authed-nav__section-chevron inline-flex transition-transform duration-200 ${isSectionCollapsed ? "-rotate-90" : ""}`}>
                    <SidebarIcon name="chevron" />
                  </span>
                </button>
              ) : null}

              <div className={`authed-nav__items grid gap-[0.3rem]${isExpanded && isSectionCollapsed ? " hidden" : ""}`}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={!isExpanded ? item.label : undefined}
                    className={({ isActive }) =>
                      `authed-nav__item flex items-center gap-3 rounded-box text-base-content/75 no-underline transition-all duration-200 hover:-translate-y-px hover:bg-base-content/5 hover:text-base-content ${navItemBaseClass}${isActive ? " bg-primary/15 font-bold text-base-content" : ""}`
                    }
                  >
                    <span className="authed-nav__item-icon inline-flex shrink-0 items-center justify-center">
                      <SidebarIcon name={item.icon} />
                    </span>
                    {isExpanded ? <span className="authed-nav__item-label min-w-0 truncate">{item.label}</span> : null}
                    {isExpanded && item.badge ? <span className="authed-nav__item-badge badge badge-ghost badge-sm ml-auto">{item.badge}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="authed-sidebar__footer mt-auto grid w-full shrink-0 gap-2 border-t border-base-300/50 pt-3">
        <button
          type="button"
          className={`authed-sidebar__theme btn btn-ghost rounded-box text-base-content ${footerButtonClass}`}
          onClick={onToggleTheme}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          <span className="authed-nav__item-icon">
            <SidebarIcon name={theme === "light" ? "moon" : "sun"} />
          </span>
          {isExpanded ? <span>{theme === "light" ? "Dark theme" : "Light theme"}</span> : null}
        </button>

        <button
          type="button"
          className={`authed-sidebar__logout btn btn-ghost rounded-box text-error ${footerButtonClass}`}
          onClick={() => void logout()}
          title="Logout"
        >
          <span className="authed-nav__item-icon">
            <SidebarIcon name="logout" />
          </span>
          {isExpanded ? <span>Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
