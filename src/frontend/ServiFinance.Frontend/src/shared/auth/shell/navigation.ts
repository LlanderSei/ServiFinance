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
    | "web"
    | "customers"
    | "requests"
    | "dispatch"
    | "reports"
    | "audits";
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
  const isTenantAdmin = user.roles.includes("Administrator") || user.roles.includes("Owner");
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
        key: "administration",
        title: "Administration",
        items: [
          { to: "/root-users", label: "Root Users", icon: "users" },
          { to: "/roles-permissions", label: "Roles & Permissions", icon: "users" },
          { to: "/audits", label: "Audits", icon: "audits" }
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
          { to: `${mlsBase}/reports`, label: "Reports", icon: "reports" },
          { to: `${mlsBase}/ledger`, label: "Ledger", icon: "dashboard" }
        ]
      },
      ...(isTenantAdmin
        ? [
            {
              key: "administration",
              title: "Administration",
              items: [
                { to: `${mlsBase}/users`, label: "Platform Users", icon: "users" as const },
                { to: `${mlsBase}/roles-permissions`, label: "Roles & Permissions", icon: "users" as const },
                { to: `${mlsBase}/audit`, label: "Audits", icon: "audits" as const }
              ]
            }
          ]
        : []),
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
        { to: `${tenantBase}/sms/reports`, label: "Reports", icon: "reports" }
      ]
    },
    ...(isTenantAdmin
      ? [
          {
            key: "administration",
            title: "Administration",
            items: [
              { to: `${tenantBase}/sms/audits`, label: "Audits", icon: "audits" as const },
              { to: `${tenantBase}/sms/users`, label: "Platform Users", icon: "users" as const },
              { to: `${tenantBase}/sms/roles-permissions`, label: "Roles & Permissions", icon: "users" as const }
            ]
          },
          {
            key: "commercial",
            title: "Commercial",
            items: [
              { to: `${tenantBase}/sms/pricing`, label: "Pricing", icon: "subscriptions" as const },
              { to: `${tenantBase}/billing`, label: "Billing", icon: "subscriptions" as const }
            ]
          }
        ]
      : []),
    {
      key: "desktop-entry",
      title: "",
      items: [
        { to: `${mlsBase}/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk" }
      ]
    }
  ];
}
