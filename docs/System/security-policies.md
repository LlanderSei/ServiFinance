# ServiFinance Security Policies

Last updated: 2026-05-11

These policies define the current security baseline for ServiFinance root, tenant SMS, tenant MLS/desktop, and customer portal surfaces. They are implementation-aligned policies for the current codebase and should be reviewed whenever authentication, authorization, audit logging, or deployment configuration changes.

## Scope

These policies apply to:

- Root platform administration.
- Tenant staff workspaces, including SMS and MLS surfaces.
- Customer portal registration, login, profile, and service-request surfaces.
- API endpoints, frontend authentication flows, desktop-hosted MLS entry points, and supporting CI workflows.

## Password Policy

Implemented baseline:

- Passwords must be at least 12 characters.
- Passwords are checked with `zxcvbn-core` for common-password and low-guessability patterns.
- ServiFinance-specific blocked terms are maintained in `PasswordPolicyService.AdditionalBlockedPasswords`.
- Passwords must not contain obvious account or tenant phrases such as email local parts, full names, tenant slugs, tenant names, or business names.
- Simple repeated-character patterns and obvious sequences are rejected.
- Uppercase letters, numbers, and symbols are treated as optional strength boosters, not mandatory composition rules.
- Registration, password reset, and password change flows must call the server-side password policy before accepting a new password.

Operational expectations:

- Default or generated development passwords must remain local/demo only and must not be used in production data.
- Any known leaked internal default, tenant label, or project-specific weak phrase should be added to the additional blocked-password list.
- Production administrators should never ask users to send passwords through email, chat, or support tickets.

Future improvements:

- Add password-history checks to prevent immediate password reuse.
- Add breached-password lookup through a privacy-preserving service such as Have I Been Pwned k-anonymity.

## Authentication, MFA, and Recovery Policy

Implemented baseline:

- CAPTCHA is required on public login, registration, and password-reset entry points when Cloudflare Turnstile is configured.
- The local arithmetic CAPTCHA fallback is allowed only for development or non-production environments.
- Failed login attempts create account-level and network-level cooldown lockouts through database-backed `AuthProtectionRecords`.
- MFA can be enabled only after the local account is linked to a Google account.
- MFA challenge codes are emailed to the linked Google address through the configured SMTP sender.
- Password reset is allowed only for accounts that already have a linked Google account.
- Password reset codes are delivered to the linked Google address, not to an arbitrary submitted email address.
- Google unlink is disabled while MFA is enabled.
- Authenticated workspaces warn after 5 minutes of inactivity and automatically sign out after 5 more minutes without user activity.

Operational expectations:

- Production SMTP must use a verified sender or authenticated domain.
- MFA and reset codes must not be returned by production API responses.
- Support staff must not bypass Google-link requirements unless a documented manual recovery process is added and audited.

Future improvements:

- Add authenticator-app TOTP or WebAuthn/passkey MFA.
- Add public "Sign in with Google" after account linking.
- Add operational dashboards for active lockouts and manual unlock workflows.

## Authorization and Access Control Policy

Implemented baseline:

- Root, tenant, and customer sessions are separated by authentication surface and claims.
- Customer portal sessions require the `CustomerWeb` surface claim.
- Tenant data access is scoped by tenant IDs, tenant slugs, and EF Core tenant query filters.
- Save-time tenant mismatch checks protect against accidental cross-tenant writes.
- Superadmin and tenant-administrator routes require role checks.

Operational expectations:

- New protected pages and endpoints must declare the expected surface and tenant scope before exposing data.
- Tenant-scoped endpoints must not trust route slugs alone; they must compare the authenticated tenant context against requested resources.
- Administrative actions should be limited to least privilege and should create audit events when they affect access, money, identity, or tenant configuration.

Future improvements:

- Replace broad role-name checks with a formal permission matrix.
- Enforce subscription/module entitlements as a security boundary, not only as product configuration.

## Audit Logging and Monitoring Policy

Implemented baseline:

- Security audit events are recorded for login success/failure, logout, MFA challenge/failure, password reset, password change, MFA enable/disable, Google linking, and lockout creation.
- Operational audit-style records exist for service status changes, assignment activity, evidence, MLS loan activity, and payment activity.
- Root audit pages summarize security event categories, including lockout activity.

Audit events should include, when available:

- Actor identity and account type.
- Tenant or customer scope.
- Event category, action, and outcome.
- Subject account or resource.
- Timestamp.
- IP address and user agent.
- Non-sensitive reason or metadata.

Operational expectations:

- Audit logs must not store passwords, MFA codes, reset codes, access tokens, refresh tokens, or raw secrets.
- Failed login spikes, lockout creation, reset failures, and MFA failures should be reviewed before production releases and periodically in production.
- New sensitive workflows must include audit logging before they are considered complete.

Future improvements:

- Add a retention policy and scheduled purge/archive job.
- Add export or SIEM forwarding for production monitoring.
- Add manual unlock audit events when an unlock workflow is implemented.

## Vulnerability and Code Auditing Policy

Implemented baseline:

- GitHub Actions security checks run on pushes and pull requests to `main` or `master`.
- Backend dependency scanning uses `dotnet list package --vulnerable --include-transitive` against the API project to avoid unnecessary MAUI workload restores in Linux CI.
- Frontend dependency scanning uses `npm audit --audit-level=moderate`.
- Frontend static/security linting uses ESLint with TypeScript, React hooks, React refresh, and `eslint-plugin-security`.

Operational expectations:

- Pull requests should pass the security-checks workflow before merge.
- Critical and high dependency vulnerabilities must be remediated before release.
- Moderate dependency vulnerabilities should be reviewed and either patched or documented with a risk acceptance before the next release.
- Lint errors should block merge; warnings should be triaged during hardening passes.

Future improvements:

- Add SonarCloud/SonarQube or CodeQL for broader static analysis.
- Add OWASP Dependency Check or equivalent Software Composition Analysis if deeper dependency reports are required.
- Add secret scanning in CI if repository hosting does not already enforce it.

## Secrets and Configuration Policy

Implemented baseline:

- Sensitive settings are supplied through environment variables, user secrets, or host configuration.
- `.env` is ignored by git and `.env.example` documents expected local configuration keys.
- JWT signing configuration is required before the API starts.
- Google OAuth, Cloudflare Turnstile, and SMTP credentials must remain outside source control.

Operational expectations:

- Production values must not be copied into screenshots, docs, commits, or issue comments.
- SMTP sender addresses must be verified with the provider before use.
- Secrets should be rotated after developer turnover, accidental exposure, or suspected compromise.

Future improvements:

- Add a formal key-rotation schedule.
- Add managed secret storage for production hosting.
- Configure ASP.NET Core Data Protection key persistence and rotation for production.

## Incident Response Policy

Severity levels:

- Critical: confirmed data exposure, account takeover, credential leakage, payment/loan tampering, or active exploitation.
- High: exploitable auth bypass, broad tenant isolation weakness, critical dependency vulnerability, or repeated MFA/reset abuse.
- Medium: limited information disclosure, single-feature authorization bug, or moderate vulnerable dependency.
- Low: hardening gap without known exploit path.

Response steps:

1. Triage the report and preserve relevant audit logs.
2. Contain the issue by disabling affected accounts, revoking sessions, rotating secrets, blocking abusive networks, or disabling affected features.
3. Remediate the root cause in code, configuration, or deployment.
4. Verify the fix with targeted tests, builds, and security checks.
5. Communicate impact and required actions to affected administrators or users.
6. Document the incident, timeline, evidence, fix, and follow-up tasks.

Future improvements:

- Add a production contact/escalation owner.
- Add incident templates for audit-log review, user notification, and post-incident review.

## Current Evidence Map

| Area | Current evidence |
| --- | --- |
| Authentication hardening | `docs/System/auth-security-hardening-walkthrough.md` |
| Formal security policies | `docs/System/security-policies.md` |
| CI security checks | `.github/workflows/security-checks.yml` |
| Frontend security/static linting | `src/frontend/ServiFinance.Frontend/eslint.config.js` |
| Password policy implementation | `src/backend/ServiFinance.Infrastructure/Auth/PasswordPolicyService.cs` |
| Persistent lockout implementation | `src/backend/ServiFinance.Infrastructure/Auth/AuthProtectionService.cs` |
| Security audit visibility | `src/frontend/ServiFinance.Frontend/src/pages/root/SecurityAudits.tsx` |
