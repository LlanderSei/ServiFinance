# ServiFinance

ServiFinance is a multi-tenant operations and financing platform for service businesses. It combines a web-based Service Management System, a customer portal, a desktop-oriented Micro-Lending System, and a root SaaS control plane under one tenant-aware solution.

The project is built around the idea that a tenant can start from service intake and dispatch, turn completed service work into invoices, accept direct settlement, or convert eligible invoices into micro-loans.

## Main Workspaces

- Root / Superadmin: tenant operations, subscription tiers, module catalog, recovery, audits, root users, and roles-permissions.
- Tenant SMS Web: dashboard, customers, service requests, dispatch, reports, SLA escalations, feedback CRM, cost control, billing, branding, audits, users, and roles-permissions.
- Customer Portal: tenant-scoped registration and login, service request submission, tracking, invoice viewing, online payment, proof submission, profile, feedback, and saved address/contact options.
- Tenant MLS Desktop: customer finance, service-linked loan conversion, standalone loans, loan accounts, collections, ledger, reports, audits, billing, portfolio risk, finance policy, loan approvals, users, and roles-permissions.

## Product Model

ServiFinance uses tenant subscriptions to control which modules are visible and usable.

- Standard edition: web SMS-focused service operations.
- Premium edition: includes Standard features and unlocks the desktop MLS finance terminal.
- Micro, Small, and Medium segments: progressively unlock broader operational controls, reporting depth, cost controls, portfolio risk, approval workflow, and finance policy management.

Module access can be `Included`, `Limited`, or unavailable depending on the tenant tier.

## Architecture

- `src/backend/ServiFinance.Api`: ASP.NET Core API host and endpoint mappings.
- `src/backend/ServiFinance.Application`: application services, auth policies, and cross-domain rules.
- `src/backend/ServiFinance.Domain`: tenant, SMS, MLS, customer, billing, auth, and audit entities.
- `src/backend/ServiFinance.Infrastructure`: EF Core persistence, migrations, seeders, payment integrations, and external services.
- `src/frontend/ServiFinance.Frontend`: React, TypeScript, Vite, Tailwind, and DaisyUI web client.
- `src/desktop/ServiFinance.Desktop`: desktop host for the MLS-oriented experience.
- `docs`: system plans, implementation status, deliverables, ERD, and data dictionary.

## Important Routes

- `/`: public root landing page.
- `/register`: Stripe-backed tenant onboarding flow.
- `/login`: root / tenant admin login entry.
- `/t/{tenantSlug}/sms/*`: tenant SMS workspace.
- `/t/{tenantSlug}/c/*`: tenant customer portal.
- `/t/mls/*`: desktop MLS workspace routes.
- `/subscriptions`: root subscription catalog management.

## Local Development

Install frontend dependencies:

```powershell
cd src\frontend\ServiFinance.Frontend
cmd /c npm install
```

Run the frontend dev server:

```powershell
cd src\frontend\ServiFinance.Frontend
cmd /c npm run dev
```

Run the API without rebuilding the frontend on every backend build:

```powershell
dotnet watch --project src\backend\ServiFinance.Api\ServiFinance.Api.csproj -- -p:DisableServiFinanceFrontendBuild=true
```

Build the frontend:

```powershell
cd src\frontend\ServiFinance.Frontend
cmd /c npm run build
```

Build the backend API:

```powershell
dotnet build src\backend\ServiFinance.Api\ServiFinance.Api.csproj -p:DisableServiFinanceFrontendBuild=true
```

or

You can also open this repo in either VS Code or Visual Studio and launch/test it there

On VS Code, you can find several launchable options:

- `Web Hot Reload ` for local web testing with hot reload
- `Web` for local web testing (no hot reload)
- `Desktop (Windows)` for building desktop version

On Visual Studio you can launch this by `ServiFinance.Api` for web and `ServiFinance.Desktop` for desktop.

## Configuration

Use `.env.example` as the starting point for local configuration. Common local concerns include:

- database connection string
- Stripe keys and webhook secret
- ImgBB upload key
- JWT and cookie/session settings
- production-like playthrough seed flags

Do not commit real secrets from `.env`.

## Seed Data

The development seed creates baseline root and tenant data for local work. The production-like playthrough seed can optionally create six tenants across all Standard and Premium tiers, with staff, customers, service requests, billing cycles, SMS activity, and Premium MLS activity.

Relevant flags:

```text
ServiFinance__Seed__ProductionPlaythroughEnabled=false
ServiFinance__Seed__ResetDatabaseBeforeProductionPlaythrough=false
```

Enable the reset flag only when you intentionally want to drop and rebuild the local database for a full playthrough.

## Documentation

Useful starting documents:

- `docs/System/implementation-status.md`
- `docs/System/msme-tiering-and-module-matrix.md`
- `docs/System/servifinance-process-workflow.md`
- `docs/System/tenant-sms-phased-implementation.md`
- `docs/System/mls-desktop-plan.md`
- `docs/Data Dict & ERD/data-dictionary.md`

## Current Direction

The core platform is implemented across root, SMS, customer portal, and MLS surfaces. Remaining work is mostly hardening and polish: deeper MLS reporting, Stripe recovery webhook coverage, account security improvements such as Google auth and MFA, and final documentation synchronization when the codebase stabilizes.

