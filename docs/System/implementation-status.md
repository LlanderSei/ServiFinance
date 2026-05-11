# ServiFinance Implementation Status

Last updated: 2026-05-11

## Current Delivery State

ServiFinance is no longer a foundation-only build. The platform now has working root SaaS operations, tenant SMS web operations, tenant MLS desktop operations, customer portal flows, Stripe-backed onboarding, and tenant billing recovery surfaces.

The remaining work is mostly:

- route and guard consistency
- recovery and webhook hardening
- deeper MLS reporting and approval flow depth
- account-security upgrades such as Google auth, MFA, and password recovery
- documentation sync

## Implemented Surfaces

### Root / Superadmin

- Public SaaS landing page and live tenant registration flow at `/` and `/register`
- Stripe-backed tenant onboarding with provisioning after checkout confirmation
- Superadmin dashboard, system health, tenants, subscription tiers, modules, audits, root users, and roles-permissions workspaces
- Subscription recovery queue for failed renewals, pending plan switches, cooldown state, and intervention actions
- Root-scoped roles and permissions with mutable non-authority roles
- Root control-plane routes can also be opened from the desktop application through the isolated Superadmin mode on the MLS desktop login page

### Tenant SMS Web

- Tenant landing and authenticated SMS workspace under `/t/{tenant}/sms/*`
- Dashboard, customers, service requests, dispatch, reports, SLA escalations, feedback CRM, cost control, pricing, billing, branding, audits, users, and roles-permissions
- Service request lifecycle from intake through dispatch, execution, costing, invoice finalization, and finance handoff
- Dispatch timeline, ledger, assignment history, evidence, reassignment, cancellation, abandonment, and conflict visibility
- Service costing with presets, tax options, totals, and customer-facing transparency
- Customer feedback, suggestions, pending and expired feedback windows, and service-linked CRM cues

### Customer Portal

- Tenant-scoped customer registration and login under `/t/{tenant}/c/*`
- Customer dashboard, profile, service requests, request details, invoices, and feedback
- New request submission, request cancellation windows, profile contact and address management, and request tracking
- Finalized invoice visibility with:
  - hosted Stripe Checkout for eligible direct-settlement invoices
  - manual payment proof submission for offline review
  - settlement review outcomes and submission history

### Tenant MLS Desktop

- Desktop login and desktop workspace under `/t/mls/*`
- The desktop login separates tenant MLS sign-in from Superadmin root sign-in so root sessions do not inherit tenant MLS state
- Dashboard, customer finance, loan conversion, standalone loans, loan accounts, collections, reports, ledger, audits, roles-permissions, users, billing, branding, portfolio risk, finance policy, and loan-approvals workspaces
- Invoice-to-loan conversion preview and creation
- Standalone loan preview and creation
- Payment posting, reversal, collections review, and ledger mutation
- MLS settlement review for customer-submitted service invoice payment proofs

### Billing, Subscription, and Entitlements

- Root subscription catalog with segment, edition, price, module coverage, and limited/full access metadata
- Tenant billing workspace shared across SMS and MLS entry points
- Stripe-managed auto-renewal and hosted billing portal access
- Pending plan switch scheduling for the next renewal cycle, cancellation cooldowns, and recovery posture
- Subscription recovery enforcement and tenant grace-policy behavior
- Route and endpoint module gating across most SMS and MLS workspaces

## Working Right Now

- Root onboarding provisions tenants from the live subscription catalog after Stripe confirms checkout.
- Tenant SMS and MLS workspaces both run against real tenant-scoped data and shared auth.
- Customer service requests, feedback, and direct settlement activity flow back into tenant operations.
- Stripe subscription billing and customer invoice checkout both use hosted Stripe flows instead of embedded card forms.
- Manual tenant subscription renewal proof submission is disabled; renewal follows provider-managed auto-renewal and hosted billing portal recovery.
- MLS direct routes now have route-level permission wrappers aligned with the existing SMS and root route pattern.

## Known Gaps And Hardening Areas

### MLS Depth

- MLS reporting exists, but it is still shallower than SMS operational reporting and can be expanded with stronger period comparison, delinquency mix, and collection trend depth.
- Loan approval workflow now persists maker-checker states for service-linked invoice approval and standalone-loan release, including maker/checker users, timestamps, and review remarks.

### Security

- Google auth, MFA, self-service password recovery, and lockout or throttling are still not implemented.
- Root mutable-role behavior still has some backend assumptions around locked SuperAdmin authority instead of pure permission-key enforcement everywhere.

### Billing And Recovery

- Stripe recovery is working, but broader webhook/event coverage can still be extended for more provider states and failure cases.
- Downgrade cleanup behavior for locked modules with unfinished work is surfaced, but deeper operational handling can still be tightened.

### Documentation

- Data Dictionary and ERD files were refreshed against the current EF model on 2026-05-11.
- Older narrative deliverables still need a final evidence pass when the code freezes, especially around MLS report depth, root permission semantics, and Stripe/account-security future work.
- Phase and status docs must stay in sync with the current route contract, billing model, customer/payment behavior, and desktop/root split.

## Recommended Near-Term Slices

1. Expand MLS reporting depth and approval reporting depth around the persisted maker-checker workflow.
2. Tighten remaining root permission enforcement assumptions so root access depends on permission keys instead of locked `SuperAdmin` role-name checks where possible.
3. Continue Stripe recovery and provider-event hardening.
4. Add account-security slices: Google auth, MFA, password recovery, and lockout policy.

## Developer Notes

- Root superadmin routes live on the root surface, not a separate `/superadmin/*` prefix.
- SMS tenant routes live under `/t/{tenant}/sms/*`.
- Customer portal routes live under `/t/{tenant}/c/*`.
- MLS desktop routes live under `/t/mls/*`; browser web sessions are redirected to the desktop-required screen instead of loading the MLS workspace directly.
- The desktop login can create either a `TenantDesktop` session for MLS work or a `Root` session for Superadmin control-plane work.
- Billing behavior now assumes provider-managed renewal for tenant subscriptions and mixed direct-settlement options for customer invoices.
