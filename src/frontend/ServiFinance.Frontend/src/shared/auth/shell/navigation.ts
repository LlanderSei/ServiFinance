import type { CurrentSessionUser } from "@/shared/api/contracts";

export type NavItem = {
  to: string;
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
};

export type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
};

export function buildAuthSections(user: CurrentSessionUser): NavSection[] {
  const tenantBase = `/t/${user.tenantDomainSlug}`;
  const isSuperAdmin = user.roles.includes("SuperAdmin");
  const isTenantAdmin = user.roles.includes("Administrator");

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
        { to: `${tenantBase}/mls/dashboard`, label: "MLS Dashboard", icon: "desktop", badge: "Desk" }
      ]
    }
  ];
}
