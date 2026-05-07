import type { CurrentSessionUser } from "@/shared/api/contracts";
import { hasPermission as userHasPermission } from "@/shared/auth/permissions";

export type NavItem = {
  to?: string;
  label: string;
  icon:
    | "dashboard"
    | "tenants"
    | "subscriptions"
    | "modules"
    | "health"
    | "users"
    | "service"
    | "desktop"
    | "web"
    | "customers"
    | "requests"
    | "dispatch"
    | "reports"
    | "audits";
  badge?: string;
  unavailableMessage?: string;
  permissionKey?: string;
};

export type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
};

export function buildAuthSections(user: CurrentSessionUser): NavSection[] {
  const tenantBase = `/t/${user.tenantDomainSlug}`;
  const mlsBase = "/t/mls";
  const isTenantDesktop = user.surface === "TenantDesktop";
  const filterSections = (sections: NavSection[]) =>
    sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.permissionKey || userHasPermission(user, item.permissionKey))
      }))
      .filter((section) => section.items.length > 0);

  if (user.roles.includes("SuperAdmin")) {
    return filterSections([
      {
        key: "control",
        title: "Control Center",
        items: [
          { to: "/dashboard", label: "Overview", icon: "dashboard", permissionKey: "root.dashboard.view" },
          { to: "/system-health", label: "System Health", icon: "health", permissionKey: "root.system-health.view" }
        ]
      },
      {
        key: "tenancy",
        title: "Tenant Operations",
        items: [
          { to: "/tenants", label: "Tenants", icon: "tenants", permissionKey: "root.tenants.view" },
        ]
      },
      {
        key: "administration",
        title: "Administration",
        items: [
          { to: "/root-users", label: "Root Users", icon: "users", permissionKey: "root.users.manage" },
          { to: "/roles-permissions", label: "Roles & Permissions", icon: "users", permissionKey: "root.roles-permissions.manage" },
          { to: "/audits", label: "Audits", icon: "audits", permissionKey: "root.audits.view" }
        ]
      },
      {
        key: "catalog",
        title: "Commercial Catalog",
        items: [
          { to: "/subscriptions", label: "Subscription Tiers", icon: "subscriptions", permissionKey: "root.subscriptions.manage" },
          { to: "/modules", label: "Modules", icon: "modules", permissionKey: "root.modules.manage" }
        ]
      }
    ]);
  }

  if (isTenantDesktop) {
    return filterSections([
      {
        key: "finance",
        title: "Micro-Lending",
        items: [
          { to: `${mlsBase}/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk", permissionKey: "mls.dashboard.view" },
          { to: `${mlsBase}/customers`, label: "Customer Records", icon: "customers", permissionKey: "mls.customer-finance.view" },
          { to: `${mlsBase}/loan-conversion`, label: "Loan Conversion", icon: "requests", permissionKey: "mls.loan-conversion.manage" },
          { to: `${mlsBase}/standalone-loans`, label: "Standalone Loans", icon: "customers", permissionKey: "mls.standalone-loans.manage" },
          { to: `${mlsBase}/loans`, label: "Loan Accounts", icon: "reports", permissionKey: "mls.loan-accounts.view" },
          { to: `${mlsBase}/collections`, label: "Collections", icon: "service", permissionKey: "mls.collections.manage" },
          { to: `${mlsBase}/reports`, label: "Reports", icon: "reports", permissionKey: "mls.reports.view" },
          { to: `${mlsBase}/ledger`, label: "Ledger", icon: "dashboard", permissionKey: "mls.ledger.view" }
        ]
      },
      {
        key: "administration",
        title: "Administration",
        items: [
          { to: `${mlsBase}/users`, label: "Platform Users", icon: "users" as const, permissionKey: "mls.users.manage" },
          { to: `${mlsBase}/roles-permissions`, label: "Roles & Permissions", icon: "users" as const, permissionKey: "mls.roles-permissions.manage" },
          { to: `${mlsBase}/audit`, label: "Audits", icon: "audits" as const, permissionKey: "mls.audits.view" }
        ]
      },
      {
        key: "web-entry",
        title: "",
        items: [
          {
            label: "SMS Dashboard",
            icon: "web",
            unavailableMessage: "SMS modules are available only in the web workspace. Open the tenant web app to use Service Management."
          }
        ]
      }
    ]);
  }

  return filterSections([
    {
      key: "service",
      title: "Service Management",
      items: [
        { to: `${tenantBase}/sms/dashboard`, label: "SMS Dashboard", icon: "service", permissionKey: "sms.dashboard.view" },
        { to: `${tenantBase}/sms/customers`, label: "Customers", icon: "customers", permissionKey: "sms.customers.view" },
        { to: `${tenantBase}/sms/service-requests`, label: "Service Requests", icon: "requests", permissionKey: "sms.service-requests.view" },
        { to: `${tenantBase}/sms/dispatch`, label: "Dispatch", icon: "dispatch", permissionKey: "sms.dispatch.view" },
        { to: `${tenantBase}/sms/reports`, label: "Reports", icon: "reports", permissionKey: "sms.reports.view" }
      ]
    },
    {
      key: "administration",
      title: "Administration",
      items: [
        { to: `${tenantBase}/sms/audits`, label: "Audits", icon: "audits" as const, permissionKey: "sms.audits.view" },
        { to: `${tenantBase}/sms/users`, label: "Platform Users", icon: "users" as const, permissionKey: "sms.users.manage" },
        { to: `${tenantBase}/sms/roles-permissions`, label: "Roles & Permissions", icon: "users" as const, permissionKey: "sms.roles-permissions.manage" }
      ]
    },
    {
      key: "commercial",
      title: "Commercial",
      items: [
        { to: `${tenantBase}/sms/pricing`, label: "Pricing", icon: "subscriptions" as const, permissionKey: "sms.pricing.manage" },
        { to: `${tenantBase}/billing`, label: "Billing", icon: "subscriptions" as const, permissionKey: "sms.billing.view" }
      ]
    },
    {
      key: "desktop-entry",
      title: "",
      items: [
        { to: `${mlsBase}/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk", permissionKey: "mls.dashboard.view" }
      ]
    }
  ]);
}
