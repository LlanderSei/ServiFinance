import type { CurrentSessionUser } from "@/shared/api/contracts";
import { MlsModuleCodes, SmsModuleCodes, hasPermissionAndModule } from "./permissions";

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
    if (hasPermissionAndModule(user, "mls.dashboard.view", MlsModuleCodes.serviceLinkedLoans)) {
      return "/t/mls/dashboard";
    }

    if (hasPermissionAndModule(user, "mls.customer-finance.view", MlsModuleCodes.financialRecords)) {
      return "/t/mls/customers";
    }

    if (hasPermissionAndModule(user, "mls.loan-accounts.view", MlsModuleCodes.financialRecords)) {
      return "/t/mls/loans";
    }

    if (permissions.has("mls.billing.view")) {
      return "/t/mls/billing";
    }

    return "/t/mls/dashboard";
  }

  if (user.surface === "CustomerWeb") {
    return `/t/${user.tenantDomainSlug}/c/dashboard`;
  }

  if (hasPermissionAndModule(user, "sms.dashboard.view", SmsModuleCodes.serviceIntake)) {
    return `/t/${user.tenantDomainSlug}/sms/dashboard`;
  }

  if (hasPermissionAndModule(user, "sms.customers.view", SmsModuleCodes.serviceIntake)) {
    return `/t/${user.tenantDomainSlug}/sms/customers`;
  }

  if (hasPermissionAndModule(user, "sms.service-requests.view", SmsModuleCodes.serviceIntake)) {
    return `/t/${user.tenantDomainSlug}/sms/service-requests`;
  }

  if (hasPermissionAndModule(user, "sms.dispatch.view", SmsModuleCodes.scheduling)) {
    return `/t/${user.tenantDomainSlug}/sms/dispatch`;
  }

  if (hasPermissionAndModule(user, "sms.sla-escalations.view", SmsModuleCodes.slaEscalations)) {
    return `/t/${user.tenantDomainSlug}/sms/sla-escalations`;
  }

  if (hasPermissionAndModule(user, "sms.feedback-crm.view", SmsModuleCodes.feedbackCrm)) {
    return `/t/${user.tenantDomainSlug}/sms/feedback-crm`;
  }

  if (hasPermissionAndModule(user, "sms.cost-control.view", SmsModuleCodes.partsCostControl)) {
    return `/t/${user.tenantDomainSlug}/sms/cost-control`;
  }

  if (permissions.has("sms.billing.view")) {
    return `/t/${user.tenantDomainSlug}/billing`;
  }

  return `/t/${user.tenantDomainSlug}/sms/dashboard`;
}
