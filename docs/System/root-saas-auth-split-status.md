# Root SaaS Landing And Domain-Scoped Auth Status

Last updated: 2026-03-25

## Scope Implemented

This milestone introduced a split between:

- the root SaaS surface for platform ownership and superadmin access
- tenant-scoped web routes for the Service Management System
- tenant-scoped desktop placeholder routes for the Micro-Lending System

The current route contract is:

- `/`
- `/register`
- `/superadmin/dashboard`
- `/superadmin/tenants`
- `/superadmin/subscriptions`
- `/{tenant}/login`
- `/{tenant}/dashboard`
- `/{tenant}/admin/users`
- `/desktop/{tenant}/login`
- `/desktop/{tenant}/dashboard`

## What Is Done

### Root SaaS Surface

- Added a public landing page at `/`.
- The landing page includes:
  - a `Login` button that opens a superadmin login modal
  - a `Register / Sign up` button that routes to `/register`
- Added a public registration page shell at `/register`.
- Root login now authenticates only platform superadmin accounts.

### SuperAdmin Area

- Added placeholder pages for:
  - `/superadmin/dashboard`
  - `/superadmin/tenants`
  - `/superadmin/subscriptions`
- Added route-level checks so only authenticated root superadmins can access this area.

### Tenant Web Area

- Added tenant-specific login at `/{tenant}/login`.
- Added tenant-specific dashboard at `/{tenant}/dashboard`.
- Moved tenant user management to `/{tenant}/admin/users`.
- Added tenant route guards that reject users whose tenant claim does not match the route slug.

### Desktop Placeholder Area

- Added tenant-specific desktop placeholder login at `/desktop/{tenant}/login`.
- Added tenant-specific desktop placeholder dashboard at `/desktop/{tenant}/dashboard`.
- Tenant credentials can be used on both tenant web and desktop placeholder entry points.

### Authentication Split

- Split login handling into two endpoint flows:
  - root superadmin login
  - tenant login
- Auth cookies now carry:
  - `tenant_id`
  - `tenant_domain_slug`
  - role claims
- Root-domain accounts are blocked from tenant routes.
- Tenant accounts are blocked from root superadmin routes.
- Tenant users are blocked from other tenant slugs.

### Data Model And Seed Updates

- Added `Tenants.DomainSlug` as the canonical tenant route key.
- Added a migration for the new tenant slug field.
- Added a reserved platform tenant for root-domain SaaS ownership.
- Added a seeded `SuperAdmin` role for the platform tenant.
- Added a seeded superadmin account for the platform tenant.
- Updated the example tenant to use the slug `exampledomain`.
- Kept tenant administrator seeding for the example tenant.

### Navigation Cleanup

- Updated shared navigation to show:
  - superadmin links for platform users
  - tenant dashboard and tenant admin links for tenant administrators
  - desktop placeholder navigation for tenant users
- Removed the old routed entry points for:
  - `/login`
  - `/dashboard`
  - `/admin/users`

## Current Working Behavior

### Root Surface

- Visiting `/` shows the SaaS landing page.
- The login modal posts to the root superadmin login flow.
- Visiting `/register` shows the non-persistent registration shell.

### Tenant Surface

- Visiting `/exampledomain/login` shows tenant web login.
- Visiting `/desktop/exampledomain/login` shows tenant desktop placeholder login.
- Authenticated tenant users are redirected only within their own slug.

### Accounts Seeded For Development

- SuperAdmin credentials are sourced from:
  - `ServiFinance__SuperAdminEmail`
  - `ServiFinance__SuperAdminPassword`
- Example tenant administrator credentials are sourced from:
  - `ServiFinance__DevelopmentAdminEmail`
  - `ServiFinance__DevelopmentAdminPassword`

## Future Implementation

### Root SaaS

- real SaaS metrics on the superadmin dashboard
- subscribed tenant lifecycle management
- subscription billing and plan enforcement
- registration persistence and tenant provisioning

### Service Management System

- customer management
- service request intake
- technician assignment and work tracking
- invoicing from service work

### Micro-Lending System

- MAUI desktop login integration
- invoice-to-loan conversion workflow
- amortization schedule generation
- payment posting and ledger review

### Security And Admin

- stronger password and lockout policy
- audit trail for sign-in and admin actions
- finer-grained permission model beyond role names
- production tenant onboarding and provisioning flow

## Notes

- The registration page is intentionally a shell only in this milestone.
- The desktop routes are currently web placeholders, not the final MAUI client implementation.
- All account access is tenant-bound. Tenant-scoped users cannot cross into other tenant routes.
- The root platform tenant is internal and reserved for SaaS ownership and superadmin access only.
