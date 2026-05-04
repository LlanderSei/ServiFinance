import type { CurrentSessionUser } from "@/shared/api/contracts";

export function getAuthenticatedHomeRoute(user: CurrentSessionUser) {
  if (user.surface === "Root" || user.roles.includes("SuperAdmin")) {
    return "/dashboard";
  }

  if (user.surface === "TenantDesktop") {
    return "/t/mls/dashboard";
  }

  if (user.surface === "CustomerWeb") {
    return `/t/${user.tenantDomainSlug}/c/dashboard`;
  }

  return `/t/${user.tenantDomainSlug}/sms/dashboard`;
}
