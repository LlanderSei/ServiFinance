import type { CurrentSessionUser } from "@/shared/api/contracts";

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
    | "customers"
    | "requests"
    | "dispatch"
    | "reports";
  badge?: string;
  unavailableMessage?: string;
};

export type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
};

export function buildAuthSections(user: CurrentSessionUser): NavSection[] {
  const tenantBase = `/t/${user.tenantDomainSlug}`;
  const mlsBase = "/t/mls";
  const isSuperAdmin = user.roles.includes("SuperAdmin");
  const isTenantAdmin = user.roles.includes("Administrator");
  const isTenantDesktop = user.surface === "TenantDesktop";

  if (isSuperAdmin) {
    return [
      {
        key: "control",
        title: "Control Center",
        items: [
          { to: "/dashboard", label: "Overview", icon: "dashboard" },
          { to: "/system-health", label: "System Health", icon: "health" }
        ]
      },
      {
        key: "tenancy",
        title: "Tenant Operations",
        items: [
          { to: "/tenants", label: "Tenants", icon: "tenants" },
        ]
      },
      {
        key: "catalog",
        title: "Commercial Catalog",
        items: [
          { to: "/subscriptions", label: "Subscription Tiers", icon: "subscriptions" },
          { to: "/modules", label: "Modules", icon: "modules" }
        ]
      }
    ];
  }

  if (isTenantDesktop) {
    return [
      {
        key: "finance",
        title: "Micro-Lending",
        items: [
          { to: `${mlsBase}/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk" },
          { to: `${mlsBase}/customers`, label: "Customer Records", icon: "customers" },
          { to: `${mlsBase}/loan-conversion`, label: "Loan Conversion", icon: "requests" },
          { to: `${mlsBase}/standalone-loans`, label: "Standalone Loans", icon: "customers" },
          { to: `${mlsBase}/loans`, label: "Loan Accounts", icon: "reports" },
          { to: `${mlsBase}/collections`, label: "Collections", icon: "service" },
          { to: `${mlsBase}/audit`, label: "Audit Review", icon: "health" },
          { to: `${mlsBase}/ledger`, label: "Ledger", icon: "dashboard" }
        ]
      },
      {
        key: "service",
        title: "Service Management",
        items: [
          {
            label: "SMS Dashboard",
            icon: "service",
            unavailableMessage: "SMS modules are available only in the web workspace. Open the tenant web app to use Service Management."
          }
        ]
      }
    ];
  }

  return [
    {
      key: "service",
      title: "Service Management",
      items: [
        { to: `${tenantBase}/sms/dashboard`, label: "SMS Dashboard", icon: "service" },
        { to: `${tenantBase}/sms/customers`, label: "Customers", icon: "customers" },
        { to: `${tenantBase}/sms/service-requests`, label: "Service Requests", icon: "requests" },
        { to: `${tenantBase}/sms/dispatch`, label: "Dispatch", icon: "dispatch" },
        { to: `${tenantBase}/sms/reports`, label: "Reports", icon: "reports" },
        ...(isTenantAdmin
          ? [{ to: `${tenantBase}/sms/users`, label: "SMS Users", icon: "users" as const }]
          : [])
      ]
    },
    {
      key: "finance",
      title: "Micro-Lending",
      items: [
        { to: `${mlsBase}/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk" }
      ]
    }
  ];
}
