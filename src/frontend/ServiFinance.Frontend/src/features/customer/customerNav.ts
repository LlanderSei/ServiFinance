import type { CustomerSession } from "./customerAuth";

export type CustomerNavItem = {
  to: string;
  label: string;
  eyebrow: string;
};

export function buildCustomerNav(tenantDomainSlug: string): CustomerNavItem[] {
  return [
    {
      to: `/t/${tenantDomainSlug}/c/dashboard`,
      label: "Overview",
      eyebrow: "Workspace"
    },
    {
      to: `/t/${tenantDomainSlug}/c/requests`,
      label: "My Requests",
      eyebrow: "Service"
    },
    {
      to: `/t/${tenantDomainSlug}/c/invoices`,
      label: "Invoices",
      eyebrow: "Billing"
    },
    {
      to: `/t/${tenantDomainSlug}/c/feedback`,
      label: "Feedback",
      eyebrow: "Follow-up"
    }
  ];
}

export function getCustomerHomeRoute(session: CustomerSession) {
  return `/t/${session.tenantDomainSlug}/c/dashboard`;
}
