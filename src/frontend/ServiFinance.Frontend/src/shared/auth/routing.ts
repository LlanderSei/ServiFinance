import type { CurrentSessionUser } from "@/shared/api/contracts";

export function getAuthenticatedHomeRoute(user: CurrentSessionUser) {
  if (user.roles.includes("SuperAdmin")) {
    return "/dashboard";
  }

  return user.surface === "TenantDesktop"
    ? "/t/mls/dashboard"
    : `/t/${user.tenantDomainSlug}/sms/dashboard`;
}
