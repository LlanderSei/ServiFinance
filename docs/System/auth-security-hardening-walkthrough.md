# Authentication Security Hardening Walkthrough

Last updated: 2026-05-11

This note covers the first security-hardening slice added to ServiFinance after the information-security criteria review. It is based on the current codebase, not a penetration test.

## Implemented

- CAPTCHA is enforced on root, tenant SMS/MLS, customer portal, and platform registration web surfaces through `GET /api/auth/captcha` and per-request `CaptchaProof` validation. When Cloudflare Turnstile keys are configured, the frontend renders the Turnstile widget and the backend validates tokens through Cloudflare Siteverify.
- Login cooldown protection is enforced across root, tenant, and customer authentication. Five failed account attempts in ten minutes locks that account for fifteen minutes, and twenty-five failed attempts from the same network in ten minutes creates a temporary sitewide/network lockout.
- Registration and password changes now use a stronger password policy: minimum twelve characters, `zxcvbn-core` common-password/guessability checks, a ServiFinance-specific add-on blocklist, repeated-character and simple-sequence checks, and rejection of obvious values derived from email, full name, tenant slug, or business name. Uppercase letters, numbers, and symbols are shown as optional strength boosters instead of hard blockers.
- Email-backed MFA is implemented for authenticated root, tenant, and customer users from their account/profile security surfaces. Enabling MFA requires a linked Google account and configured SMTP delivery; sign-in codes are emailed to the linked Google email after the password is accepted.
- Password reset is exposed on root, tenant SMS/MLS, and customer login surfaces. The API uses CAPTCHA on reset start, only creates a reset token for accounts with a linked Google account, sends the code to the linked Google email through the configured SMTP relay, enforces the strong password policy on completion, and writes audit events. If SMTP is not configured, local development still receives a development reset code for Google-linked accounts.
- Google OAuth account linking is implemented for authenticated root, tenant, and customer users. The API reads the Google client ID and client secret from environment/configuration and stores the link in `ExternalServiceStates`.
- Security audit events are written for login success/failure, logout, MFA challenge/failure, password changes, password reset, and MFA enable/disable actions.
- Login lockout state is persisted in the database through `AuthProtectionRecords`, so account and network cooldowns survive API restarts and can work consistently beyond a single in-memory process.
- HTTP security headers are applied globally, including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a Content Security Policy that allows ServiFinance assets plus the configured CAPTCHA, image upload, and address lookup services.
- CI security checks now run backend package vulnerability scanning, frontend `npm audit`, and ESLint static/security rules for the React frontend.
- Authenticated root, tenant SMS/MLS, and customer workspaces now show an idle warning after 5 minutes with no activity and automatically sign out after another 5 minutes without user input.

## Partially Implemented

- MFA and password reset email delivery depend on SMTP configuration. The implementation supports generic SMTP, but production must configure a verified sender/domain through a mail provider.
- CAPTCHA falls back to a first-party arithmetic challenge only when Turnstile keys are missing. That keeps local development usable, but production should configure Turnstile.
- Google account linking stores the Google subject/email for the authenticated local account and is now used as the delivery anchor for MFA and password recovery. Google-login-as-primary sign-in is still future work.
- Customer portal MFA uses the same linked-Google and SMTP delivery rule as staff accounts, but it is still email-code MFA rather than TOTP or passkey/WebAuthn.

## Not / Future Implementation

- Email delivery health checks, bounce handling, and branded HTML templates for transactional messages.
- Optional Google sign-in from the public login screens after a user has linked a Google account.
- TOTP authenticator app enrollment or passkey/WebAuthn MFA.
- Operational dashboards for active lockouts and manual unlock workflows.
- Broader backend static-analysis tooling such as CodeQL, SonarCloud/SonarQube, or OWASP Dependency Check.

## Cloudflare Turnstile Setup

Cloudflare Turnstile is the preferred CAPTCHA service for this project because it is free, avoids puzzle-heavy CAPTCHA UX, and supports mandatory server-side token validation.

1. Open Cloudflare Dashboard > Turnstile and create a widget for the local or production hostname.
2. Copy the site key and secret key.
3. Configure `ServiFinance__ExternalServices__Turnstile__SiteKey` and `ServiFinance__ExternalServices__Turnstile__SecretKey`.
4. Restart the API after changing `.env`.
5. Use the root, tenant, customer, or registration form. The UI should render Cloudflare Turnstile instead of the local arithmetic fallback.

Important behavior:

- The site key is sent to the browser so the widget can render.
- The secret key is used only by the API when calling `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Turnstile tokens expire after five minutes and are single-use, so failed submissions refresh the challenge.
- If Turnstile keys are absent, the app keeps the local arithmetic fallback for development only.

## Google Account Linking Setup

Google OAuth uses free Google Cloud OAuth credentials. The setup steps are:

1. Open Google Cloud Console and create or select a project.
2. Configure the OAuth consent screen with the ServiFinance app name, support email, developer contact email, and only the basic profile/email scopes needed for account linking.
3. Create an OAuth client ID with application type `Web application`.
4. Add authorized redirect URIs for each environment. The ASP.NET Core callback path is `/signin-google`, so local development should include the exact backend origin plus callback path, for example `https://localhost:5228/signin-google` or `http://localhost:5228/signin-google` if the local API is running over HTTP.
5. Store the client ID and client secret in user secrets or environment variables, not in source files.
6. Configure `ServiFinance__ExternalServices__Google__ClientId` and `ServiFinance__ExternalServices__Google__ClientSecret`.
7. Restart the API after changing `.env`, then open Account center > Security > Link Google.

Useful official references:

- Google OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth client management: https://support.google.com/cloud/answer/6158849
- ASP.NET Core Google external login setup: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/social/google-logins?view=aspnetcore-10.0

## SMTP Password Reset Email Setup

The MFA and password reset implementation is provider-neutral SMTP. For a free or low-cost setup, start with a transactional email provider rather than a personal mailbox. Brevo and MailerSend both provide SMTP relay options with free tiers/limits; Gmail app passwords can work for local testing, but a transactional provider is cleaner for production.

Environment variables:

```env
ServiFinance__Email__Smtp__Host=smtp-relay.brevo.com
ServiFinance__Email__Smtp__Port=587
ServiFinance__Email__Smtp__Username=your-smtp-login
ServiFinance__Email__Smtp__Password=your-smtp-password-or-api-key
ServiFinance__Email__Smtp__FromEmail=no-reply@example.com
ServiFinance__Email__Smtp__FromName=ServiFinance
ServiFinance__Email__Smtp__EnableSsl=true
```

Recommended Brevo walkthrough:

1. Create a Brevo account and open Transactional > SMTP.
2. Add and verify the sender email or domain you will use for `ServiFinance__Email__Smtp__FromEmail`.
3. Copy the SMTP server, port, SMTP login, and SMTP key.
4. Set the environment variables above. For Brevo, the host is normally `smtp-relay.brevo.com` and port `587`.
5. Restart the API.
6. Link a Google account from Account center > Security for root/tenant users, or from Customer profile > Account security for customer users.
7. Enable MFA or open a root/tenant SMS/MLS login form, select "Forgot password?", complete CAPTCHA, and confirm that the code arrives at the linked Google email.

Useful official references:

- Brevo SMTP setup: https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP
- Brevo SMTP developer docs: https://developers.brevo.com/docs/smtp-integration
- MailerSend SMTP relay: https://www.mailersend.com/help/smtp-relay
- Gmail app passwords for development mailbox testing: https://support.google.com/mail/answer/185833

## Current Criterion Movement

| Criterion | Movement from this pass |
| --- | --- |
| Secure Coding Practices | Improved through centralized auth-protection and password-policy services, with sensitive settings still externalized. |
| Authentication System | Improved materially: CAPTCHA, lockout cooldown, strong password policy, Google-linked email MFA, Google-gated password reset, and Google linking now exist across staff and customer account surfaces. |
| Input Validation, Sanitization & Error Handling | Improved for auth payloads through server-side CAPTCHA and password-policy validation. |
| Code Auditing Tools & Audit Logging | Improved through security audit events, free dependency-audit workflow checks, and frontend ESLint security/static checks. |
| Security Policies & Documentation | Improved by this walkthrough and `docs/System/security-policies.md`; production ownership, retention, and key-rotation procedures remain future work. |

## Password Dictionary Setup

The backend password policy uses the free `zxcvbn-core` package for broad common-password and guessability detection. Project-specific additions are kept in `AdditionalBlockedPasswords` inside `PasswordPolicyService`, so local terms such as tenant labels, platform names, or leaked internal defaults can be added without replacing the package dictionary.
