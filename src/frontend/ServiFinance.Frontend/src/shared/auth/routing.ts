import type { CurrentSessionUser } from "@/shared/api/contracts";

export function getAuthenticatedHomeRoute(user: CurrentSessionUser) {
  const permissions = new Set(user.permissionKeys ?? []);

  if (user.surface === "Root" || user.roles.includes("SuperAdmin")) {
    if (permissions.has("root.dashboard.view") || user.roles.includes("SuperAdmin")) {
      return "/dashboard";
    }

    if (permissions.has("root.tenants.view")) {
      return "/tenants";
    }

    if (permissions.has("root.audits.view")) {
      return "/audits";
    }

    return "/dashboard";
  }

  if (user.surface === "TenantDesktop") {
    if (permissions.has("mls.dashboard.view")) {
      return "/t/mls/dashboard";
    }

    if (permissions.has("mls.customer-finance.view")) {
      return "/t/mls/customers";
    }

    if (permissions.has("mls.loan-accounts.view")) {
      return "/t/mls/loans";
    }

    return "/t/mls/dashboard";
  }

  if (user.surface === "CustomerWeb") {
    return `/t/${user.tenantDomainSlug}/c/dashboard`;
  }

  if (permissions.has("sms.dashboard.view")) {
    return `/t/${user.tenantDomainSlug}/sms/dashboard`;
  }

  if (permissions.has("sms.customers.view")) {
    return `/t/${user.tenantDomainSlug}/sms/customers`;
  }

  if (permissions.has("sms.service-requests.view")) {
    return `/t/${user.tenantDomainSlug}/sms/service-requests`;
  }

  if (permissions.has("sms.dispatch.view")) {
    return `/t/${user.tenantDomainSlug}/sms/dispatch`;
  }

  return `/t/${user.tenantDomainSlug}/sms/dashboard`;
}
