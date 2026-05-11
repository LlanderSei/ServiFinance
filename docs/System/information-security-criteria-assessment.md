# ServiFinance Information Security Criteria Assessment

Last reviewed: 2026-05-11

This assessment is based on the current ServiFinance codebase, current repo documentation, and targeted build verification. It is an implementation review, not a penetration test.

Build verification completed during this review:
- `dotnet build src/backend/ServiFinance.Api/ServiFinance.Api.csproj -m:1 -p:DisableServiFinanceFrontendBuild=true -p:DebugType=none -p:UseSharedCompilation=false -o %TEMP%\ServiFinanceVerifyCustomerGoogleMfaNoPdb`
- `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend`

## Summary

| Criterion | Status | Closest Rubric Band | Current Reading |
| --- | --- | --- | --- |
| 1. Secure Coding Practices | Partially Implemented | Satisfactory | Good foundation through EF Core, externalized secrets, tenant guards, schema constraints, and centralized auth hardening services, but no formal secure coding standard or automated security checks. |
| 2. Authentication System | Partially Implemented | Satisfactory | Password hashing, JWT, cookie auth, refresh token rotation, Cloudflare Turnstile CAPTCHA, lockout cooldown, strong password policy, Google-linked email MFA, Google-gated password reset, and Google account linking now exist across staff and customer surfaces, but Google login, SMTP production setup, and stronger MFA factors remain future work. |
| 3. Authorization & Role Management | Partially Implemented | Satisfactory | RBAC and tenant-aware access checks are present, but authorization is still mostly role-name based and not yet fine-grained. |
| 4. Data Encryption | Partially Implemented | Satisfactory | Passwords are hashed, refresh tokens are hashed, and HTTPS/HSTS are enabled outside development, but no at-rest encryption or managed key strategy is evident. |
| 5. Input Validation, Sanitization & Error Handling | Partially Implemented | Satisfactory | There are several manual validations, safe redirects, CAPTCHA checks, and stronger password validation, but validation is still inconsistent and there is no centralized sanitization or anti-forgery layer. |
| 6. Code Auditing Tools & Audit Logging | Partially Implemented | Satisfactory | Security audit events and free dependency-audit workflow checks now exist, but broader static security analysis is still future work. |
| 7. System Functionality & Feature Completion | Partially Implemented | Satisfactory | The backend and frontend both build, and several major flows are implemented, but some areas are still documented as future work and there is no automated end-to-end verification. |
| 8. Security Policies & Documentation | Partially Implemented | Needs Improvement | General implementation docs exist, but formal security policy documentation is still missing. |

## 1. Secure Coding Practices (10 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- Secrets are expected from `.env`, user secrets, or host environment variables instead of being hardcoded in application source.
- The API refuses to start when the JWT signing key is missing.
- `.env` is ignored by git while `.env.example` is kept as the template.
- Data access is built around EF Core. During this review, no `FromSql`, `ExecuteSqlRaw`, or similar raw SQL APIs were found under `src/`.
- The database model enforces field lengths, unique indexes, tenant query filters, and tenant write-guards.

Gaps / future work:
- There is no formal secure coding checklist or secure code review document in the repo.
- Development seeding still creates predictable sample customer passwords from the customer first name, which is acceptable only for local demo data.
- The CORS allowlist helper is geared toward local and hybrid-shell development, not a locked production origin list.
- There is no automated static security scanning in the repo.

Evidence:
- `src/backend/ServiFinance.Api/Program.cs` lines 10-17, 28-47
- `.gitignore` lines 5-7
- `.env.example` lines 1-15
- `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext.cs` lines 91-116
- `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext/ServiFinanceDbContext.Identity.cs` lines 7-66
- `src/backend/ServiFinance.Infrastructure/Data/DevelopmentDataSeeder.cs` lines 357-358

## 2. Authentication System (15 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- The system supports root, tenant, and customer login flows.
- Passwords are hashed and verified through ASP.NET Core `IPasswordHasher`.
- The API supports both cookie authentication and JWT bearer authentication.
- Refresh tokens are randomly generated, stored as hashes, rotated on refresh, and revoked on logout.
- Customer portal sessions are separated from root and tenant user surfaces.
- Cloudflare Turnstile CAPTCHA validation is enforced for root, tenant, customer, and platform-registration authentication entry points when Turnstile keys are configured, with a local fallback for development.
- Strong password policy validation blocks weak/common passwords and obvious values derived from email, names, tenant slugs, or business names.
- Account and sitewide/network cooldown lockouts now throttle repeated failed login attempts.
- MFA can be enabled for root, tenant, and customer users only after a Google account is linked and SMTP is configured. Sign-in challenge codes are emailed to the linked Google address and are no longer returned by the API.
- Password reset is exposed for root, tenant SMS/MLS, and customer surfaces with CAPTCHA-protected reset requests, short-lived reset codes, Google-link gating, SMTP delivery to the linked Google address when configured, and strong password validation on completion.
- Authenticated root, tenant, and customer users can link/unlink a Google account from their account/profile security surface.

Gaps / future work:
- SMTP settings must be configured with a real transactional provider before production; local development falls back to a development reset code for Google-linked staff password reset when SMTP is missing.
- TOTP or WebAuthn would still be stronger MFA factors than email codes.
- Public "Sign in with Google" remains a future implementation after account linking.
- Lockout state is stored in memory, so distributed deployments need shared storage.

Evidence:
- `src/backend/ServiFinance.Infrastructure/Auth/UserAuthenticationService.cs` lines 13-80
- `src/backend/ServiFinance.Infrastructure/Auth/CustomerAuthenticationService.cs` lines 15-91
- `src/backend/ServiFinance.Infrastructure/Auth/JwtSessionTokenService.cs` lines 21-110, 136-199, 253-265
- `src/backend/ServiFinance.Api/Program.cs` lines 28-46
- `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs`

## 3. Authorization & Role Management (15 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- API tenant routes are grouped behind authorization.
- Superadmin and tenant-administrator routes use role checks.
- The customer portal requires an authenticated session with the `CustomerWeb` surface claim.
- Frontend protected routes enforce role, surface, and tenant slug checks before rendering protected pages.
- EF Core tenant query filters and save-time tenant mismatch checks add a second layer of tenant isolation.

Gaps / future work:
- Authorization is still mostly role-name based instead of policy- or permission-matrix based.
- There is no fine-grained permission model for feature actions inside a role.
- Subscription-tier and module-entitlement enforcement is seeded in data but not fully enforced as a security boundary yet.
- Some tenant areas only require authenticated tenant access, not a more specific least-privilege policy.

Evidence:
- `src/backend/ServiFinance.Api/Endpoints/TenantSmsApiEndpointMappings.cs` lines 10-28
- `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsUsersEndpointMappings.cs`
- `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs` lines 14-19
- `src/frontend/ServiFinance.Frontend/src/shared/auth/ProtectedRoute.tsx` lines 18-64
- `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext.cs` lines 91-116
- `src/backend/ServiFinance.Infrastructure/Data/DevelopmentDataSeeder.cs` lines 557-621

## 4. Data Encryption (10 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- Non-development hosting enables `UseHsts()` and `UseHttpsRedirection()`.
- JWT access tokens are signed with an HMAC SHA-256 signing key loaded from configuration.
- Refresh tokens are hashed with SHA-256 before persistence.
- User and customer passwords are stored as password hashes, not plaintext.
- Refresh token cookies are marked `HttpOnly` and `SameSite=Strict`.

Gaps / future work:
- No database-at-rest encryption, column encryption, or external key-management service is evident from the repo.
- No ASP.NET Data Protection configuration or key-ring management is evident for stronger cookie/key lifecycle control.
- Refresh-token cookie `Secure` mode depends on HTTPS being in use, which is correct but still means insecure local HTTP is weaker.
- There is no documented key rotation or secret-rotation process.

Evidence:
- `src/backend/ServiFinance.Api/Program.cs` lines 52-63
- `src/backend/ServiFinance.Infrastructure/Auth/JwtSessionTokenService.cs` lines 136-199
- `src/backend/ServiFinance.Api/Infrastructure/ProgramEndpointSupport.cs` lines 333-345
- `src/backend/ServiFinance.Infrastructure/Auth/UserAuthenticationService.cs` lines 47-55
- `src/backend/ServiFinance.Infrastructure/Auth/CustomerAuthenticationService.cs` lines 30-33, 80

## 5. Input Validation, Sanitization & Error Handling (15 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- Several endpoints validate required IDs, string lengths, numeric ranges, duplicate users, duplicate customers, and schedule conflicts.
- Return URLs are sanitized to relative paths before redirect.
- Customer feedback values are range-checked and length-checked.
- Non-development environments use a central exception handler and status-code re-execution routes.
- The EF model also applies server-side length and precision constraints.

Gaps / future work:
- Validation is manual and scattered across handlers instead of centralized through a consistent validation layer.
- Many payload strings are only trimmed before storage; explicit XSS sanitization is not evident.
- No anti-forgery protection is visible for cookie-backed state-changing flows.
- No standardized `ProblemDetails` contract is used across the API.

Evidence:
- `src/backend/ServiFinance.Api/Infrastructure/ProgramEndpointSupport.cs` lines 45-53
- `src/backend/ServiFinance.Api/Program.cs` lines 52-58
- `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsServiceRequestsEndpointMappings.cs` lines 184-235, 264-342
- `src/backend/ServiFinance.Api/Endpoints/TenantSms/Dispatch/CreateAssignment.cs`
- `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs` lines 187-215
- `src/backend/ServiFinance.Infrastructure/Auth/UserManagementService.cs` lines 42-62

## 6. Code Auditing Tools & Audit Logging (10 pts)

Status: Partially Implemented  
Closest rubric band: Needs Improvement

Implemented now:
- The application records operational history through `StatusLogs`, `AssignmentEvents`, and `AssignmentEvidence`.
- The MLS area exposes an audit-style activity feed derived from loan and payment events.
- The repo already identifies `AuditLogs` as a target capability in schema docs and development module seeding.
- Security audit logging now records login success/failure, logout, MFA, password change, password reset, and MFA enable/disable events.
- `.github/workflows/security-checks.yml` adds free CI checks for vulnerable .NET packages and frontend `npm audit`.
- `src/frontend/ServiFinance.Frontend/package.json` includes an `audit` script for local dependency checks.

Gaps / future work:
- There is no evidence of SonarLint, ESLint security rules, Bandit, OWASP Dependency Check, or similar static security-analysis tooling in the repo.
- The frontend `package.json` still has no lint script.
- User-administration audit coverage still needs to be reviewed feature-by-feature.
- Existing repo docs also describe audit logging as incomplete.

Evidence:
- `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsServiceRequestsEndpointMappings.cs` lines 148-182, 344-381
- `src/backend/ServiFinance.Api/Endpoints/TenantMls/TenantMlsAuditEndpointMappings.cs`
- `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext/ServiFinanceDbContext.ServiceManagement.cs` lines 44-109
- `src/backend/ServiFinance.Infrastructure/Data/DevelopmentDataSeeder.cs` lines 557-621
- `src/frontend/ServiFinance.Frontend/package.json` lines 6-10
- `docs/System/implementation-status.md` lines 89-106
- `docs/Data Dict & ERD/data-dictionary.md`

## 7. System Functionality & Feature Completion (10 pts)

Status: Partially Implemented  
Closest rubric band: Satisfactory

Implemented now:
- The backend API build succeeded during this review.
- The frontend production build also succeeded during this review.
- The codebase contains working foundations for root authentication, tenant SMS flows, customer portal flows, and MLS workspaces including dashboards, reports, and audit views.
- Current docs and routes show a broad functional surface already exists across backend, frontend, and the desktop-host integration point.

Gaps / future work:
- The project still has roadmap and future-state items, especially around formal desktop-host completion and some security-hardening flows.
- There are no automated integration tests or end-to-end tests proving all critical security-sensitive journeys.
- Some repo docs are outdated relative to the current implementation, so documentation cannot be treated as a perfect reflection of what is fully finished.

Evidence:
- Verified build commands listed at the top of this document
- `src/frontend/ServiFinance.Frontend/src/app/router.tsx`
- `src/frontend/ServiFinance.Frontend/README.md` lines 3-24
- `docs/System/implementation-status.md` lines 68-135

## 8. Security Policies & Documentation (15 pts)

Status: Partially Implemented  
Closest rubric band: Needs Improvement

Implemented now:
- The repo has general implementation and planning documents under `docs/System`.
- A sample environment file documents how secrets should be supplied locally.
- Schema documentation exists and already calls out some security-relevant entities and future additions.
- `docs/System/auth-security-hardening-walkthrough.md` documents the implemented CAPTCHA, lockout, password policy, Google-linked email MFA, SMTP password reset, and Google OAuth setup path.

Gaps / future work:
- There is no dedicated security policy document for password rules, access control standards, audit logging policy, incident response, backup/retention, key rotation, or vulnerability management.
- The existing implementation status document is dated `2026-04-08`, so it is no longer a complete current-state security reference.
- Documentation is mostly implementation-oriented, not policy-oriented.

Evidence:
- `.env.example` lines 1-15
- `docs/System/implementation-status.md` lines 1-135
- `docs/System/tenant-sms-phased-implementation.md`
- `docs/Data Dict & ERD/data-dictionary.md`

## Overall Conclusion

ServiFinance already has a solid security foundation for a student or early-stage multi-tenant system: hashed passwords, JWT and cookie authentication, hashed refresh tokens, tenant-aware route protection, tenant query filters, and server-side schema constraints are all present in the current codebase.

The biggest remaining weaknesses are now production-grade delivery and security operations rather than the basic auth foundation. The current repo still needs production SMTP configuration, public Google sign-in, stronger MFA options such as TOTP/WebAuthn, distributed lockout storage, formal permission policies, automated code-audit tooling, and dedicated security policy documents before it can reasonably claim an excellent rating across the rubric.
