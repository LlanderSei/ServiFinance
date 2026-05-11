# ServiFinance Information Security Documentation

## Project Overview

This project is developed in partial fulfillment of the requirements for IT 16/L - Information Security 1.

This documentation presents the design, implementation, and security considerations of the ServiFinance system.

Prepared by: [Your Name]  
Submitted to: [Prof Name]

## System Description

ServiFinance is a multi-tenant finance and service-management system for micro-lending and service request operations. The system supports root platform administration, tenant staff workspaces, tenant MLS/desktop workflows, and customer portal access.

The system allows users to register, authenticate, manage tenant-scoped records, process customer service requests, manage lending workflows, review audit activity, and maintain profile/security settings. Security controls are implemented through password hashing, CAPTCHA, Google-linked MFA and recovery, account lockout cooldowns, role-based access controls, tenant isolation, audit logging, and dependency/security checks.

## Platform and Technologies Used

- Programming languages: C#, TypeScript, JavaScript, HTML, CSS.
- Backend framework/environment: ASP.NET Core on .NET 10.
- Frontend framework/environment: React, TypeScript, Vite, Tailwind CSS.
- Desktop environment: .NET MAUI / HybridWebView for the MLS desktop surface.
- Database: SQL Server through Entity Framework Core.
- Authentication and security packages/services: ASP.NET Core Identity password hashing, JWT bearer authentication, cookie authentication, Google OAuth account linking, Cloudflare Turnstile CAPTCHA, SMTP email delivery, `zxcvbn-core` password strength/common-password checks.
- Code auditing tools: GitHub Actions, `dotnet list package --vulnerable --include-transitive`, `npm audit --audit-level=moderate`, ESLint, `eslint-plugin-security`.
- Platform: Web application with desktop-hosted MLS support.

## Security Policies

### Password Policy

- Passwords must be at least 12 characters.
- Passwords are checked against common-password and guessability rules through `zxcvbn-core`.
- Passwords must not contain obvious account-related phrases such as email local parts, full names, tenant slugs, tenant names, or business names.
- Simple repeated-character patterns and obvious sequences are rejected.
- Uppercase letters, numbers, and symbols are encouraged as strength boosters, but they are not the main security requirement.
- Registration, password reset, and password change flows apply the server-side password policy before accepting a new password.
- Future improvement: add password-history checks and breached-password lookup.

### Login Attempt Policy

- Public login and registration surfaces use CAPTCHA protection when Cloudflare Turnstile is configured.
- Failed login attempts are tracked through database-backed account and network protection records.
- Five failed account attempts within ten minutes lock the account temporarily.
- Repeated failures from the same network can trigger a temporary network/sitewide cooldown.
- Root, tenant, MLS, and customer login surfaces use the same lockout protection approach.
- Future improvement: add an administrative active-lockout dashboard and manual unlock workflow.

### Data Handling Policy

- User and customer passwords are stored as password hashes, not plaintext.
- Refresh tokens are randomly generated, stored as hashes, rotated on refresh, and revoked on logout.
- Sensitive configuration values such as JWT signing keys, Google OAuth secrets, Turnstile secrets, and SMTP credentials are loaded from environment variables, user secrets, or host configuration.
- `.env` is ignored by git, while `.env.example` documents required local configuration keys.
- Non-development hosting enables HTTPS redirection and HSTS.
- Future improvement: add database-at-rest encryption, managed key storage, and a documented key-rotation schedule.

### Access Control Policy

- Root, tenant, MLS, and customer sessions are separated by authentication surface and claims.
- Customer portal access requires the customer web surface claim.
- Tenant data is scoped by tenant ID, tenant slug, and EF Core tenant query filters.
- Save-time tenant mismatch checks help prevent accidental cross-tenant writes.
- Superadmin and tenant administrator operations require elevated roles.
- Future improvement: replace broad role-name checks with a formal permission matrix and enforce subscription/module entitlements as a security boundary.

### Logging and Monitoring Policy

- Security audit events are recorded for login success/failure, logout, MFA challenge/failure, password reset, password change, MFA enable/disable, Google linking, and lockout creation.
- Operational audit-style logs exist for service status changes, assignment activity, evidence, MLS loan activity, and payment activity.
- Root audit pages summarize security activity, including lockout-related events.
- Audit logs must not store passwords, MFA codes, reset codes, access tokens, refresh tokens, or raw secrets.
- Future improvement: add audit retention, archive/export, SIEM forwarding, and scheduled log review procedures.

### MFA and Account Recovery Policy

- MFA can be enabled only after a local account is linked to a Google account.
- MFA challenge codes are sent to the linked Google email address through the configured SMTP sender.
- Forgot password is allowed only when the account has a linked Google account.
- Password reset codes are sent to the linked Google email, not to an arbitrary submitted email address.
- Google unlinking is disabled while MFA is enabled.
- Future improvement: add authenticator-app TOTP or WebAuthn/passkey MFA.

### Session Timeout Policy

- Authenticated root, tenant, MLS, and customer workspaces show an idle warning after 5 minutes of inactivity.
- If the user does not interact for another 5 minutes after the warning, the system automatically signs out the session.
- User activity such as clicking, typing, scrolling, or moving the pointer resets the idle timer.

---

## Incident Response Plan

### Detection

Security incidents are identified through security audit logs, failed login patterns, lockout events, MFA failures, password reset activity, dependency-audit results, and user/admin reports.

### Reporting

Incidents should be reported to the system administrator or project owner immediately. Reports should include the affected account, tenant, timestamp, observed behavior, screenshots when safe, and any related audit-log entries.

### Response

Immediate actions are taken to contain and reduce impact. Possible actions include temporarily disabling affected accounts, revoking sessions, rotating exposed secrets, blocking abusive networks, disabling vulnerable features, or pausing deployment until the issue is fixed.

### Recovery

After containment, the system should be patched, rebuilt, redeployed, and verified. Affected users should reset credentials when needed, and administrators should confirm that tenant data and audit records remain consistent.

### Review

After recovery, the team should review the incident timeline, root cause, affected data, fix, verification evidence, and follow-up tasks. Lessons learned should be added to the security policy or implementation backlog.

## Code Auditing and Security Review

- Tool used: GitHub Actions security workflow.
- Usage: The workflow runs on pushes and pull requests to `main` or `master`.
- Backend dependency scan: `dotnet list src/backend/ServiFinance.Api/ServiFinance.Api.csproj package --vulnerable --include-transitive`.
- Frontend dependency scan: `npm audit --audit-level=moderate`.
- Frontend static/security linting: `npm run lint`, using ESLint with TypeScript rules, React hooks rules, React refresh checks, browser globals, and `eslint-plugin-security`.
- Findings: The current documentation identifies the main remaining gaps as broader backend static analysis, audit retention/export, manual lockout administration, and stronger MFA methods such as TOTP or WebAuthn.
- Fixes completed: added security audit events, lockout audit visibility, dependency-audit workflow checks, frontend ESLint security/static checks, persistent lockout records, CAPTCHA, strong password policy, Google-linked email MFA, Google-gated password reset, and idle auto-logout.
- Proof: CI configuration is stored in `.github/workflows/security-checks.yml`; frontend lint/audit scripts are stored in `src/frontend/ServiFinance.Frontend/package.json`; security policy evidence is documented in `docs/System/security-policies.md`.

## Access Control (RBAC / ACL)

### Intended Users

The system is designed for the following users:

- Guest users: unauthenticated visitors who can view public pages, register where allowed, and access login or forgot-password forms.
- Customer users: tenant-scoped customers who can access their own profile, requests, invoices, feedback, and account security settings.
- Tenant staff: authenticated tenant workers who can access tenant SMS/MLS workspaces according to their assigned role.
- Tenant administrators: tenant-level administrators who can manage tenant users, tenant records, operational workflows, and tenant security-relevant settings.
- Superadmins: root platform administrators who manage platform-level configuration, tenants, subscription/module setup, audit views, and root account operations.

### Access Control Matrix

| System Feature / Resource | Guest | Customer | Tenant Staff | Tenant Administrator | Superadmin |
| --- | --- | --- | --- | --- | --- |
| View public homepage | Allowed | Allowed | Allowed | Allowed | Allowed |
| Register customer account | Allowed | Denied | Denied | Denied | Denied |
| Register tenant/platform account | Allowed where configured | Denied | Denied | Denied | Managed |
| Login | Allowed | Allowed | Allowed | Allowed | Allowed |
| Forgot password | Allowed with CAPTCHA and linked Google requirement | Allowed for own linked account | Allowed for own linked account | Allowed for own linked account | Allowed for own linked account |
| View customer portal dashboard | Denied | Allowed for own tenant account | Denied | Denied | Denied |
| Edit own customer profile | Denied | Allowed | Denied | Denied | Denied |
| Submit customer service request | Denied | Allowed | Denied | Denied | Denied |
| View own invoices/customer records | Denied | Allowed | Denied | Denied | Denied |
| View tenant SMS workspace | Denied | Denied | Allowed by tenant scope | Allowed by tenant scope | Denied unless separately authenticated as tenant |
| View tenant MLS/desktop workspace | Denied | Denied | Allowed by tenant scope | Allowed by tenant scope | Denied unless separately authenticated as tenant |
| Manage tenant service requests | Denied | Denied | Allowed by role | Allowed | Denied unless tenant-scoped |
| Manage tenant users | Denied | Denied | Denied | Allowed | Platform-level only |
| View tenant operational reports | Denied | Denied | Allowed by role | Allowed | Platform-level only |
| Manage root platform tenants | Denied | Denied | Denied | Denied | Allowed |
| Manage subscription tiers/modules | Denied | Denied | Denied | Denied | Allowed |
| View root security audit logs | Denied | Denied | Denied | Denied | Allowed |
| Change own password | Denied | Allowed | Allowed | Allowed | Allowed |
| Link Google account | Denied | Allowed for own account | Allowed for own account | Allowed for own account | Allowed for own account |
| Enable MFA | Denied | Allowed after Google link | Allowed after Google link | Allowed after Google link | Allowed after Google link |
| Unlink Google while MFA is enabled | Denied | Denied | Denied | Denied | Denied |
| System configuration | Denied | Denied | Denied | Limited tenant configuration | Allowed |
| Delete platform records | Denied | Denied | Denied | Restricted | Restricted to authorized root operations |

## Current Security Implementation Summary

| Criteria Area | Current Status |
| --- | --- |
| Secure coding practices | Partially implemented. EF Core, externalized secrets, tenant guards, schema constraints, and CI security checks are present; backend static-analysis gates remain future work. |
| Authentication system | Partially implemented. Password hashing, CAPTCHA, lockout cooldowns, Google-linked MFA, Google-gated password reset, and session separation are implemented; Google primary login and stronger MFA factors remain future work. |
| Authorization and role management | Partially implemented. Role checks, surface claims, protected routes, tenant query filters, and tenant write guards exist; fine-grained permission policies remain future work. |
| Data encryption | Partially implemented. Passwords and refresh tokens are hashed and HTTPS/HSTS are used outside development; at-rest encryption and managed key rotation remain future work. |
| Input validation and error handling | Partially implemented. Required fields, ranges, safe redirects, CAPTCHA, password policy, and production exception handling exist; centralized validation and anti-forgery coverage remain future work. |
| Code auditing tools and audit logging | Mostly implemented. Dependency checks, `npm audit`, frontend ESLint security/static checks, and security audit logging exist; broader backend static analysis and audit retention/export remain future work. |
| System functionality and completion | Partially implemented. Backend and frontend builds have been verified, and major root, tenant, MLS, and customer flows exist; end-to-end automated testing remains future work. |
| Security policies and documentation | Mostly implemented. Formal security policies and authentication hardening walkthroughs exist; production ownership, incident templates, and retention/key-rotation schedules remain future work. |
