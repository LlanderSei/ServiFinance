import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { CurrentSessionUser } from "@/shared/api/contracts";
import { useLogout } from "./useLogout";

type Props = {
  user: CurrentSessionUser;
  children: ReactNode;
};

export function AuthenticatedShell({ user, children }: Props) {
  const logout = useLogout();
  const tenantBase = `/${user.tenantDomainSlug}`;
  const items = user.roles.includes("SuperAdmin")
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/tenants", label: "Tenants" },
        { to: "/subscriptions", label: "Subscriptions" }
      ]
    : [
        { to: `${tenantBase}/sms/dashboard`, label: "SMS Dashboard" },
        ...(user.roles.includes("Administrator") ? [{ to: `${tenantBase}/sms/users`, label: "SMS Users" }] : []),
        { to: `${tenantBase}/mls/dashboard`, label: "MLS Dashboard" }
      ];

  return (
    <div className="authed-shell">
      <aside className="authed-shell__sidebar">
        <Link to={items[0]?.to ?? "/"} className="brand">
          <span className="brand__mark">{user.roles.includes("SuperAdmin") ? "SF" : user.tenantDomainSlug.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{user.roles.includes("SuperAdmin") ? "ServiFinance" : user.tenantDomainSlug}</strong>
            <small>{user.roles.includes("SuperAdmin") ? "Platform control plane" : user.email}</small>
          </span>
        </Link>

        <nav className="authed-nav">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `authed-nav__item${isActive ? " is-active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="button button--ghost" onClick={() => void logout()}>
          Logout
        </button>
      </aside>

      <section className="authed-shell__content">
        {children}
      </section>
    </div>
  );
}
