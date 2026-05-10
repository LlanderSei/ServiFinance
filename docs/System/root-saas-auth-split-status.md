# Root SaaS, Tenant Auth, And Surface Split Status

Last updated: 2026-05-10

## Current Split

ServiFinance now runs four distinct access surfaces:

- `Root SaaS` for platform ownership and superadmin control
- `Tenant SMS Web` for service operations
- `Tenant Customer Portal` for customer self-service
- `Tenant MLS Desktop` for lending and finance operations

The split is implemented in both auth behavior and route ownership.

## Current Route Contract

### Root Surface

- `/`
- `/register`
- `/dashboard`
- `/system-health`
- `/tenants`
- `/root-users`
- `/subscriptions`
- `/modules`
- `/roles-permissions`
- `/audits`

### Tenant SMS Web Surface

- `/t/{tenant}/sms/`
- `/t/{tenant}/sms/dashboard`
- `/t/{tenant}/sms/customers`
- `/t/{tenant}/sms/service-requests`
- `/t/{tenant}/sms/dispatch`
- `/t/{tenant}/sms/reports`
- `/t/{tenant}/sms/sla-escalations`
- `/t/{tenant}/sms/feedback-crm`
- `/t/{tenant}/sms/cost-control`
- `/t/{tenant}/sms/pricing`
- `/t/{tenant}/sms/audits`
- `/t/{tenant}/sms/users`
- `/t/{tenant}/sms/roles-permissions`
- `/t/{tenant}/sms/branding`
- `/t/{tenant}/billing`

### Tenant Customer Surface

- `/t/{tenant}/c/login`
- `/t/{tenant}/c/register`
- `/t/{tenant}/c/dashboard`
- `/t/{tenant}/c/profile`
- `/t/{tenant}/c/requests`
- `/t/{tenant}/c/requests/{requestId}`
- `/t/{tenant}/c/invoices`
- `/t/{tenant}/c/feedback`

### Tenant MLS Desktop Surface

- `/t/mls/`
- `/t/mls/dashboard`
- `/t/mls/customers`
- `/t/mls/loan-conversion`
- `/t/mls/standalone-loans`
- `/t/mls/loans`
- `/t/mls/collections`
- `/t/mls/reports`
- `/t/mls/ledger`
- `/t/mls/portfolio-risk`
- `/t/mls/loan-approvals`
- `/t/mls/finance-policy`
- `/t/mls/users`
- `/t/mls/roles-permissions`
- `/t/mls/audit`
- `/t/mls/branding`
- `/t/mls/billing`

## What Is Implemented

### Root SaaS

- Public landing and live registration
- Stripe-backed tenant onboarding
- Root superadmin auth isolated from tenant auth
- Superadmin workspaces for tenants, health, subscriptions, modules, audits, root users, and roles-permissions

### Tenant Auth Split

- Tenant users cannot access root-only superadmin routes
- Root users cannot authenticate into tenant workspaces as tenant operators
- Customer accounts are isolated from staff surfaces and staff APIs
- Tenant domain validation blocks cross-tenant SMS and customer access
- MLS desktop access is surface-bound and uses desktop-scoped auth/session behavior

### Billing Split

- Root registration starts the first Stripe subscription checkout
- Tenant subscription renewal is now provider-managed through Stripe auto-renewal
- Tenant billing recovery uses the hosted billing portal instead of manual renewal proof submission
- Customer invoice settlement is separate from tenant subscription billing and supports:
  - hosted Stripe Checkout for eligible direct-settlement invoices
  - manual proof submission for offline review

## Current Working Behavior

- Visiting `/` shows the SaaS landing page and root login path.
- Visiting `/register` shows the live tier catalog and launches Stripe onboarding for the selected tier.
- Visiting `/t/{tenant}/sms/` enters the tenant SMS entry surface.
- Visiting `/t/{tenant}/c/*` stays inside the customer-only shell.
- Visiting MLS routes in the browser redirects to the desktop-required surface where applicable.
- Visiting `/t/mls/*` in the desktop shell uses the tenant desktop route set.

## Guard Status

- Root and SMS routes already used consistent route-level permission wrappers.
- MLS desktop direct routes now also use route-level permission wrappers aligned with the root and SMS pattern.
- MLS pages still keep their page-level protected wrappers, so permission and module enforcement remains redundant-safe during this transition.

## Remaining Future Work

- Google auth, MFA, and password recovery
- broader Stripe lifecycle tooling and provider-event hardening
- deeper MLS reporting and persisted loan approval decisions
- final cleanup of redundant page-level versus route-level MLS guard duplication once the route hardening settles

## Notes

- `/superadmin/*` is no longer the primary root route contract; root workspaces now live directly on the root surface.
- `/t/{tenant}/mls/*` is not the active desktop route contract; MLS uses `/t/mls/*`.
- Tenant subscription renewal proof submission has been discontinued at the API boundary.
