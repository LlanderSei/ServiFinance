# ServiFinance Implementation Status

Last updated: 2026-03-25

## What Has Been Implemented

### Foundation and Database

- Multi-tenant core domain entities are defined in the infrastructure layer.
- `ServiFinanceDbContext` now includes the main schema for:
  - tenants
  - users
  - roles
  - user-role assignments
  - customers
  - service requests
  - status logs
  - assignments
  - invoices
  - invoice lines
  - micro-loans
  - amortization schedules
  - ledger transactions
- Tenant-aware query filters and save-time tenant stamping are implemented.
- SQL Server migration support is configured.
- Initial migration has been generated and applied:
  - `ServiFinance.Infrastructure/Migrations/20260324164507_InitialFoundation.cs`

### Development Seeding

- The application now seeds a development tenant on startup.
- The application now seeds:
  - one `Administrator` role
  - one `Staff` role
  - one development admin user
  - one admin role assignment
- Development credentials are configurable in:
  - `ServiFinance.Web/appsettings.Development.json`

### Authentication

- Cookie-based authentication is wired into the web application.
- Login is implemented through a real credential validation flow against the `Users` table.
- Passwords are now stored and verified using ASP.NET Core password hashing.
- Logout is implemented.
- Unauthorized access redirects to the login page.
- Access-denied routing is available.

### User Management

- An administrator-only user management page exists at:
  - `/admin/users`
- The page currently supports:
  - viewing tenant users
  - creating a new user
  - assigning one role at creation
  - enabling or disabling a user
  - resetting a user's password

### Initial Authenticated UI

- A protected dashboard page exists at:
  - `/dashboard`
- Navigation now changes based on authentication state.
- The sidebar exposes the administrator user management link only to users in the `Administrator` role.

## What Is Working Right Now

- The solution builds successfully through:
  - `ServiFinance.Web/ServiFinance.Web.csproj`
- The local SQL Server database has:
  - 1 tenant
  - 2 roles
  - 1 user
  - 1 user-role assignment
- The default development login is:
  - Email: `admin@local.servifinance`
  - Password: `Admin123!`
- The app can start, apply migrations, and seed auth data automatically.
- The seeded admin account can be used as the first back-office operator account.

## Current Limitations

- Authentication is only implemented for the web application so far.
- There is no full registration workflow yet.
- There is no self-service password reset or email flow.
- Role management is limited to using roles that already exist in the database.
- Permissions are still role-name based; there is no fine-grained permission matrix yet.
- Audit logging for login activity, password changes, and user admin actions is not implemented yet.
- The legacy template pages still exist and are not yet fully replaced by service-specific modules.
- The MAUI desktop channel is not yet wired to the auth flow.

## Recommended Next Implementation Steps

### Auth and Security Hardening

- Add password policy enforcement.
- Add user lockout or throttling for repeated failed logins.
- Add audit logs for login, logout, password reset, and user status changes.
- Add explicit authorization policies instead of relying only on role names.

### User Administration Expansion

- Add role management screens.
- Add the ability to reassign roles for existing users.
- Add user profile editing.
- Add tenant-specific admin onboarding flows.

### Business Module Development

- Build customer management.
- Build service request intake.
- Build service request status tracking and assignment workflows.
- Build invoice creation from service work.
- Build the shared loan engine and payment posting workflows.

### Desktop and Shared Experience

- Add authenticated desktop terminal access.
- Reuse the same user and tenant rules in the MAUI application.
- Replace placeholder template pages with actual business pages.

## Important Notes for Developers

- The web app currently assumes a development tenant context from configuration.
- Startup seeding is meant for development bootstrap, not final production provisioning.
- If the development admin password is changed in configuration, startup seeding will refresh the seeded admin's password hash on the next application start.
