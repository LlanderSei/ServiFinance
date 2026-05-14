# IT15 Final Documentation Update - ServiFinance Web Application

**Project Title:** ServiFinance: A Multi-Tenant SaaS Service Management System with Embedded Micro-Lending  
**Subject:** IT15/L Web Development  
**Topic:** #33 Service Management System  
**Website Link:** https://servifinance.runasp.net  
**Documentation Scope:** Superadmin web, tenant SMS web, customer portal, and web-connected commercial/payment flows.

This file is a final-documentation update based on `IT15 Final Documentation Sample.md` and the current repository state. It keeps the original project direction but fills in the previously placeholder sections for APIs, algorithms/models, security, data dictionary, ERD, and screenshot walkthroughs.

## Project Description

ServiFinance is a multi-tenant SaaS platform designed for Philippine MSMEs that handle service requests, repair work, dispatch scheduling, customer communication, billing, and service transparency. Each tenant operates inside an isolated tenant domain where administrators and staff can manage customer records, service requests, dispatch assignments, service costing, invoices, reports, audits, branding, users, and role permissions.

The IT15 web application is composed of three main web surfaces: the root/superadmin control plane, the tenant SMS workspace, and the tenant-scoped customer portal. The root side manages tenant registration, subscription tiers, module entitlements, tenant recovery, root users, audits, and subscription catalog control. The tenant SMS side manages day-to-day service operations from intake through dispatch, completion, costing, payment, reporting, and feedback. The customer portal allows tenant-specific customer registration/login, profile management, request submission, request tracking, feedback, invoices, and online payment when available.

The system uses ASP.NET Core Minimal APIs, Entity Framework Core, SQL Server, React, TypeScript, Vite, Tailwind-based UI styling, Stripe-hosted checkout for subscription and service-invoice payments, ImgBB-backed image upload for supported media workflows, and Nominatim/OpenStreetMap lookup for guarded address search. The design prioritizes tenant isolation, operational visibility, modular SaaS subscription control, and customer-facing transparency.

## Project Objectives

The original objectives remain valid. The wording below is tightened to match the implemented web application scope.

1. Centralize Operations: Provide MSMEs with one tenant-scoped web workspace for customer records, service intake, dispatch, service tracking, costing, invoices, feedback, and reports.
2. Ensure Data Privacy: Enforce tenant isolation so each registered tenant domain only accesses its own operating data, users, customers, service requests, billing, and audit records.
3. Enhance Customer Trust: Provide a customer portal where customers can register, submit service requests, attach details, track status movement, review costing/invoices, and submit feedback.
4. Streamline Payments: Support Stripe-hosted checkout for tenant subscription onboarding and customer invoice payment, while keeping payment confirmation and finance handoff visible to tenant staff.
5. Support Modular SaaS Growth: Let superadmin manage tier/module entitlements so tenants can be limited or expanded by edition, tier, and subscribed modules without rewriting the tenant workspace.

## API/ALGO/MODEL

External APIs used: Stripe Checkout and Billing API, ImgBB image upload API, Nominatim/OpenStreetMap address lookup API.

Internal APIs and functions: ASP.NET Core Minimal API endpoint groups for root/superadmin registration and subscription control, tenant SMS dashboard/customers/service requests/dispatch/reports/pricing/branding/billing/users/audits/roles-permissions, and customer portal registration/login/profile/request tracking/feedback/invoices/payment.

Core models and algorithms: multi-tenant data model, subscription entitlement model, role and permission model, dispatch scheduling and conflict checking, service costing with presets/tax/line totals, invoice and settlement model, reporting aggregation model, scoped audit model.

## Security Features

Security features implemented: tenant isolation through domain slug and tenant identifiers, separated authentication flows for root/tenant/customer workspaces, role-based access control, immutable authority roles, role ranking guard, permission-aware UI and API guards, hashed password storage, refresh/session tracking with token hashes and expiration metadata, system and security audit logging, Stripe-hosted checkout to limit card-data exposure, image upload validation for supported file types and sizes, guarded Nominatim address lookup with caching and rate limiting, client-abort handling for cancelled requests, browser security headers, subscription/module entitlement guards for locked or limited modules.

## Prototype Screenshot Walkthrough - Frontend

| Label | Screenshot Target | Description |
|---|---|---|
| FE-01 Root Landing and Register Catalog | `/register` or root registration page | Show the public onboarding surface with Standard/Premium tier cards, pricing, inherited benefits, and the register action. |
| FE-02 Tenant Registration Modal | Registration modal after choosing a tier | Show selected plan, modules/benefits, owner/tenant fields, and the Continue to Stripe footer. |
| FE-03 Superadmin Subscription Catalog | `/subscriptions` | Show root catalog management with active tiers, module counts, edition filter, and Add Tier FAB. |
| FE-04 Tenant SMS Dashboard | `/t/{tenant}/sms/dashboard` | Show service operations overview, KPIs, attention queues, and operational health summary. |
| FE-05 Tenant Customer Records | `/t/{tenant}/sms/customers` | Show tenant-scoped customers, update action, add-customer FAB, and customer/request counts. |
| FE-06 Tenant Service Requests | `/t/{tenant}/sms/service-requests` | Show request table, request details modal with tabs, costing controls, finance handoff, and request status. |
| FE-07 Dispatch Workspace | `/t/{tenant}/sms/dispatch` | Show dispatch overview/history tabs, KPI rail, assignment table, and schedule assignment FAB/modal. |
| FE-08 SMS Reports | `/t/{tenant}/sms/reports` | Show reporting window controls, operational metrics, turnaround, comparison, and export/print actions. |
| FE-09 SMS Billing | `/t/{tenant}/sms/billing` | Show billing overview, plan switch, entitlements, recovery, payments, renewal mode, and cooldown display. |
| FE-10 SMS Branding | `/t/{tenant}/sms/branding` | Show tenant display name, color tokens, logo upload, and workspace preview. |
| FE-11 Customer Login/Register | `/t/{tenant}/c/login` and `/t/{tenant}/c/register` | Show separated customer auth that does not share tenant admin workspace identity. |
| FE-12 Customer My Requests | `/t/{tenant}/c/requests` | Show ongoing/history bottom tabs, compact request cards, New Request flow, and request view/track actions. |
| FE-13 Customer Profile | `/t/{tenant}/c/profile` | Show Basic Information, Password & Security, and Address Loadouts bottom tabs. |
| FE-14 Customer Invoice Payment | `/t/{tenant}/c/invoices` | Show customer invoices and Pay Online action that launches Stripe when the invoice is payable. |
| FE-15 Mobile Customer Portal | Browser device mode | Show sticky/hiding header, drawer sidebar, bottom tabs, and mobile-friendly request/profile forms. |

## Prototype Screenshot Walkthrough - Backend

| Label | Screenshot Target | Description |
|---|---|---|
| BE-01 Solution Structure | Visual Studio/VS Code solution explorer | Show backend projects such as API, Application, Domain, and Infrastructure. |
| BE-02 Root/Superadmin Endpoints | `src/backend/ServiFinance.Api/Endpoints/SuperadminSubscriptionCatalogEndpointMappings.cs` | Show root subscription catalog endpoint group for managing tiers/modules. |
| BE-03 Tenant SMS Endpoints | `src/backend/ServiFinance.Api/Endpoints/TenantSms/` | Show tenant SMS endpoint mapping files for customers, service requests, dispatch, reports, pricing, branding, and users. |
| BE-04 Customer Portal Endpoints | `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs` | Show customer registration, login, profile, request, feedback, and invoice endpoints. |
| BE-05 Billing Endpoints | `src/backend/ServiFinance.Api/Endpoints/TenantBilling/TenantBillingEndpointMappings.cs` | Show tenant billing overview, plan switch, recovery, payment method, and entitlement endpoints. |
| BE-06 Database Context | `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext/` | Show EF Core configuration split by domain such as billing, auditing, service, and loan entities. |
| BE-07 Stripe Payment Service | `src/backend/ServiFinance.Infrastructure/Payments/StripeServiceInvoicePaymentService.cs` | Show Stripe Checkout session creation for customer invoice payment. |
| BE-08 Image Upload Service | `src/backend/ServiFinance.Api/Services/ImageUploadService.cs` | Show image upload validation and provider integration for ImgBB-backed uploads. |
| BE-09 Address Lookup Service | `src/backend/ServiFinance.Api/Services/NominatimAddressLookupService.cs` | Show server-side Nominatim guard, caching, and upstream lookup handling. |
| BE-10 Audit Service | `src/backend/ServiFinance.Infrastructure/Auditing/AuditLogService.cs` | Show audit record creation and scoped system/security event tracking. |

## Prototype Screenshot Walkthrough - API/Functions/Features

| Label | Screenshot Target | Description |
|---|---|---|
| API-01 Tenant Subscription Checkout | `src/backend/ServiFinance.Api/Endpoints/PlatformApiEndpointMappings.cs:20` | Show tenant registration request creating a Stripe Checkout URL for the selected tier. |
| API-02 Customer Registration/Login | `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs:243`; `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs:341` | Show tenant-scoped customer account creation and login without entering tenant admin session. |
| API-03 Service Request Creation | `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs:562` | Show request payload with item details, issue description, service mode, preferred dates, address, and attachments. |
| API-04 Dispatch Scheduling | `src/backend/ServiFinance.Api/Endpoints/TenantSms/Dispatch/CreateAssignment.cs:16` | Show eligible request filtering, selected staff, schedule window, and assignment creation. |
| API-05 Service Costing | `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsServiceRequestsEndpointMappings.cs:295` | Show line items, presets, quantity, subtotal, tax toggle, and final total persistence. |
| API-06 Invoice Payment | `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs:875` | Show customer invoice checkout session creation and redirect to Stripe. |
| API-07 Feedback CRM | `src/backend/ServiFinance.Api/Endpoints/CustomerPortalApiEndpointMappings.cs:1067`; `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsMediumControlsEndpointMappings.cs:13` | Show rating/comment capture and tenant-side CRM visibility. |
| API-08 Reports Overview | `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantSmsReportsEndpointMappings.cs:9` | Show report window parameters and aggregated operational metrics. |
| API-09 Branding Upload | `src/backend/ServiFinance.Api/Endpoints/TenantSms/TenantBrandingEndpointMappings.cs:22` | Show image file validation, upload call, stored logo URL, and preview update. |
| API-10 Address Lookup | `src/backend/ServiFinance.Api/Endpoints/AddressLookupApiEndpointMappings.cs:9` | Show guarded manual address lookup with cache/rate-limit behavior. |

## Prototype Screenshot Walkthrough - Security Features

| Label | Screenshot Target | Description |
|---|---|---|
| SEC-01 Separate Login Surfaces | `src/frontend/ServiFinance.Frontend/src/app/router.tsx:134`; `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs:243` | Show that customer auth routes are separated from tenant/root auth routes. |
| SEC-02 Permission-Aware Sidebar | `src/frontend/ServiFinance.Frontend/src/shared/auth/shell/navigation.ts:45` | Show sidebar tabs hidden/disabled when view permissions are not granted. |
| SEC-03 Roles and Permissions Matrix | `src/frontend/ServiFinance.Frontend/src/features/administration/roles-permissions/RolePermissionMatrixTab.tsx:25`; `src/backend/ServiFinance.Api/Endpoints/RolePermissionEndpointMappings.cs:24` | Show role ranking, immutable roles, permission matrix, and scoped SMS/MLS permissions. |
| SEC-04 Audit Logs | `src/backend/ServiFinance.Api/Endpoints/AuditApiEndpointMappings.cs:23`; `src/backend/ServiFinance.Api/Endpoints/AuditApiEndpointMappings.cs:86` | Show system and security logs for login, logout, CRUD, billing, and authorization-sensitive actions. |
| SEC-05 Tenant Isolation | `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext.cs:151`; `src/backend/ServiFinance.Api/Infrastructure/ProgramEndpointSupport.cs:144` | Show that customer/service/billing records differ by tenant slug and do not leak across domains. |
| SEC-06 Stripe Hosted Checkout | `src/backend/ServiFinance.Infrastructure/Payments/StripeServiceInvoicePaymentService.cs:53` | Show that card entry is hosted by Stripe rather than a local custom card form. |
| SEC-07 Upload Guard | `src/backend/ServiFinance.Api/Services/ImageUploadService.cs:70`; `src/backend/ServiFinance.Api/Services/ImageUploadService.cs:129` | Show user-facing validation or blocked upload for unsupported/oversized images. |
| SEC-08 Nominatim Guard | `src/backend/ServiFinance.Api/Services/NominatimAddressLookupService.cs:66` | Show rate-limit/cache notice and server-side guarded lookup. |
| SEC-09 Logout Confirmation | `src/frontend/ServiFinance.Frontend/src/shared/auth/shell/AuthSidebar.tsx:354` | Show confirmation modal before clearing session. |
| SEC-10 Subscription Guard | `src/frontend/ServiFinance.Frontend/src/shared/auth/PermissionGate.tsx:47`; `src/frontend/ServiFinance.Frontend/src/app/router.tsx:82` | Show locked/read-only/hidden module behavior based on tier entitlement. |

## Data Dictionary and ERD Compliance Notes

The following appendix clones the current data dictionary and ERD source documents for IT15 final documentation. For compliance with the requested documentation format, every `nvarchar` datatype is rendered as `text`; declared lengths remain unchanged. The source system can still use provider-specific SQL Server types internally.

## Data Dictionary Appendix

### ServiFinance Data Dictionary

Last updated: 2026-05-11

#### Scope

- This dictionary is based on the current EF Core schema in `src/backend/ServiFinance.Domain/Entities.cs` and the split EF configuration files under `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext/`.
- It includes only implemented tables unless a note explicitly calls out future hardening. Several workflow features, such as customer feedback and module access, are stored on existing tables instead of separate future tables.
- `Length` shows the configured database length or precision where available.
- `uniqueidentifier` fields are stored as GUID values.
- `datetime2`, `bit`, `int`, and `decimal` fields do not use character length, so the precision or `-` is shown instead.

#### Level 1 - Super Admin

Tables primarily handled by this user:

- `Tenants`
- `TenantThemes`
- `PlatformTenantRegistrations`
- `SubscriptionTiers`
- `ModuleCatalog`
- `SubscriptionTierModules`
- `Users` (platform superadmin accounts)
- `Roles` (platform roles)
- `RolePermissions`
- `UserRoles` (platform role assignments)
- `RefreshSessions`
- `ExternalServiceStates`
- `AuditEvents`

##### Tenants table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant record |
| Name | text | 200 | Tenant or business display name |
| Code | text | 50 | Unique business code used by the platform |
| DomainSlug | text | 100 | Unique route slug used for tenant URLs |
| BusinessSizeSegment | text | 50 | MSME size segment such as Micro, Small, or Medium |
| SubscriptionEdition | text | 50 | Product edition such as Standard or Premium |
| SubscriptionPlan | text | 100 | Commercial plan label for the tenant |
| SubscriptionStatus | text | 100 | Current subscription lifecycle state |
| BillingProvider | text | 50 | Billing owner such as Manual or Stripe |
| StripeCustomerId | text | 200 | Optional external Stripe customer reference |
| StripeSubscriptionId | text | 200 | Optional external Stripe subscription reference |
| PendingSubscriptionTierId | uniqueidentifier | 36 | Optional target tier scheduled for the next renewal cycle |
| PendingSubscriptionChangeRequestedAtUtc | datetime2 | - | UTC date and time when a plan switch was requested |
| PendingSubscriptionChangeEffectiveAtUtc | datetime2 | - | UTC date and time when the pending switch should apply |
| PendingSubscriptionChangeCancelledAtUtc | datetime2 | - | UTC date and time when the pending switch was cancelled |
| SubscriptionChangeCooldownUntilUtc | datetime2 | - | UTC date and time until another switch request is blocked after cancellation |
| CreatedAtUtc | datetime2 | - | UTC date and time when the tenant was created |
| IsActive | bit | 1 | Active or inactive status of the tenant |
##### TenantThemes table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant theme record |
| TenantId | uniqueidentifier | 36 | Unique foreign key to `Tenants.Id` |
| DisplayName | text | 200 | Optional public-facing tenant name used in branded screens |
| LogoUrl | text | 500 | Optional logo path or URL for tenant branding |
| PrimaryColor | text | 20 | Optional primary brand color value |
| SecondaryColor | text | 20 | Optional secondary brand color value |
| HeaderBackgroundColor | text | 20 | Optional header background color value |
| PageBackgroundColor | text | 20 | Optional page background color value |
##### PlatformTenantRegistrations table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant onboarding attempt |
| SubscriptionTierId | uniqueidentifier | 36 | Foreign key to `SubscriptionTiers.Id` |
| TenantId | uniqueidentifier | 36 | Optional tenant created after successful provisioning |
| BusinessName | text | 200 | Business name submitted during registration |
| TenantCode | text | 50 | Tenant code generated from registration data |
| DomainSlug | text | 100 | Requested tenant route slug |
| OwnerFullName | text | 200 | Initial owner or administrator full name |
| OwnerEmail | text | 50 | Initial owner or administrator email |
| OwnerPasswordHash | text | 512 | Hashed password staged until provisioning completes |
| Status | text | 50 | Registration state such as PendingCheckout, Paid, Provisioned, or Failed |
| StripeCheckoutSessionId | text | 200 | Stripe Checkout session linked to the attempt |
| StripeCustomerId | text | 200 | Stripe customer linked to the attempt |
| StripeSubscriptionId | text | 200 | Stripe subscription linked to the attempt |
| CreatedAtUtc | datetime2 | - | UTC date and time when the attempt was created |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the attempt was last updated |
| CheckoutExpiresAtUtc | datetime2 | - | UTC date and time when hosted checkout expires |
| ProvisionedAtUtc | datetime2 | - | UTC date and time when tenant provisioning completed |
| FailureReason | text | 500 | Failure detail when provisioning or checkout handling fails |
##### SubscriptionTiers table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the subscription tier |
| Code | text | 50 | Unique catalog code of the tier |
| DisplayName | text | 100 | User-facing name of the tier |
| BusinessSizeSegment | text | 50 | MSME segment covered by the tier |
| SubscriptionEdition | text | 50 | Edition covered by the tier |
| AudienceSummary | text | 200 | Short target audience summary |
| Description | text | 1000 | Full description of the tier |
| MonthlyPriceAmount | decimal | 18,2 | Numeric monthly price used for billing calculations |
| CurrencyCode | text | 3 | Currency code used with the numeric price |
| PriceDisplay | text | 100 | Price label shown in the UI; display-only copy derived from the numeric price |
| BillingLabel | text | 100 | Billing period or billing note |
| PlanSummary | text | 300 | Short summary of plan inclusions |
| HighlightLabel | text | 100 | Badge or marketing highlight label |
| SortOrder | int | 10 | Display order in the catalog |
| IncludesServiceManagementWeb | bit | 1 | Indicates if the web service module is included |
| IncludesMicroLendingDesktop | bit | 1 | Indicates if the desktop lending module is included |
| IsActive | bit | 1 | Active or inactive catalog state |
##### ModuleCatalog table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the module catalog row |
| Code | text | 50 | Unique module code such as W1 or D1 |
| Name | text | 150 | Module name shown to operators |
| Channel | text | 50 | Delivery channel such as Web or Desktop |
| Summary | text | 300 | Short purpose statement of the module |
| SortOrder | int | 10 | Display order in the module catalog |
| IsActive | bit | 1 | Active or inactive catalog state |
##### SubscriptionTierModules table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tier-module mapping |
| SubscriptionTierId | uniqueidentifier | 36 | Foreign key to `SubscriptionTiers.Id` |
| PlatformModuleId | uniqueidentifier | 36 | Foreign key to `ModuleCatalog.Id` |
| AccessLevel | text | 30 | Access rule such as Included, Limited, or Not Included |
| SortOrder | int | 10 | Display order within the tier mapping |
##### Users table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the user account |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`; platform superadmins use the reserved platform tenant |
| Email | text | 50 | Login email address of the user |
| PasswordHash | text | 512 | Hashed password value |
| FullName | text | 200 | Full name of the user |
| IsActive | bit | 1 | Active or inactive status of the account |
| CreatedAtUtc | datetime2 | - | UTC date and time when the account was created |
##### Roles table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the role |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Name | text | 100 | Role name such as SuperAdmin, Administrator, or Staff |
| Description | text | 256 | Short description of the role purpose |
| PlatformScope | text | 30 | Scope such as Root, SMS, MLS, or OwnerAdmin |
| Rank | int | 10 | Role ranking used to prevent editing peer or higher roles |
| IsSystemRole | bit | 1 | Indicates whether the role is seeded by the platform |
| IsPermissionSetLocked | bit | 1 | Indicates whether the permission set cannot be changed |
##### RolePermissions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the role permission grant |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id` |
| PermissionKey | text | 160 | Permission key granted to the role |
| GrantedAtUtc | datetime2 | - | UTC date and time when the permission was granted |
##### UserRoles table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the role assignment |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| UserId | uniqueidentifier | 36 | Foreign key to `Users.Id` |
| RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id` |
| AssignedAtUtc | datetime2 | - | UTC date and time when the role was assigned |
##### RefreshSessions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the refresh session |
| UserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` |
| CustomerId | uniqueidentifier | 36 | Optional foreign key to `Customers.Id` |
| Surface | text | 50 | Client surface such as web or desktop |
| RememberMe | bit | 1 | Indicates whether a persistent session was requested |
| RefreshTokenHash | text | 128 | Unique hash of the refresh token |
| ExpiresAtUtc | datetime2 | - | UTC date and time when the refresh session expires |
| CreatedAtUtc | datetime2 | - | UTC date and time when the session was issued |
| LastRotatedAtUtc | datetime2 | - | UTC date and time when the refresh token was last rotated |
##### ExternalServiceStates table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the external service state row |
| Provider | text | 50 | External provider name such as Nominatim |
| StateKey | text | 200 | Provider-specific state or rate-limit key |
| PayloadJson | text | max | Optional serialized provider response or state payload |
| ExpiresAtUtc | datetime2 | - | Optional UTC expiry for cached provider state |
| NextAllowedRequestUtc | datetime2 | - | UTC timestamp used to guard provider rate limits |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the state was last updated |
##### AuditEvents table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the audit event |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Scope | text | 50 | Audit scope such as Root, SMS, or MLS |
| Category | text | 50 | Audit category such as System or Security |
| ActionType | text | 100 | Action category such as Login, ProvisionTenant, UpdateRole, or PostPayment |
| Outcome | text | 50 | Result such as Success, Failed, or Blocked |
| ActorUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the actor |
| ActorName | text | 200 | Snapshot of actor name |
| ActorEmail | text | 50 | Snapshot of actor email |
| SubjectType | text | 100 | Business subject type affected by the action |
| SubjectId | uniqueidentifier | 36 | Optional identifier of the affected record |
| SubjectLabel | text | 300 | Human-readable subject label |
| Detail | text | 1000 | Audit detail or event summary |
| IpAddress | text | 80 | Source IP address if captured |
| UserAgent | text | 500 | Client user-agent string if captured |
| OccurredAtUtc | datetime2 | - | UTC date and time when the action happened |
#### Level 2 - Tenant Administrator / Owner

Tables primarily handled by this user:

- `Users`
- `Roles`
- `RolePermissions`
- `UserRoles`
- `Customers`
- `CustomerContactOptions`
- `TenantCostingPolicies`
- `ServiceCostPresets`
- `ServiceRequests`
- `ServiceCostSheets`
- `ServiceCostLines`
- `ServiceRequestAttachments`
- `StatusLogs`
- `Assignments`
- `AssignmentEvents`
- `AssignmentEvidence`
- `TenantBillingRecords`
- `Invoices`
- `InvoicePaymentSubmissions`
- `InvoiceLines`
- `MicroLoans`
- `AmortizationSchedules`
- `Transactions`
- `AuditEvents`

##### Users table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant user account |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Email | text | 50 | Login email address of the tenant user |
| PasswordHash | text | 512 | Hashed password value |
| FullName | text | 200 | Full name of the operator |
| IsActive | bit | 1 | Active or inactive status of the account |
| CreatedAtUtc | datetime2 | - | UTC date and time when the account was created |
##### Roles table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant role |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Name | text | 100 | Role name used inside the tenant |
| Description | text | 256 | Short explanation of the role |
| PlatformScope | text | 30 | Scope such as SMS, MLS, or OwnerAdmin |
| Rank | int | 10 | Role ranking used to prevent editing peer or higher roles |
| IsSystemRole | bit | 1 | Indicates whether the role is seeded by the platform |
| IsPermissionSetLocked | bit | 1 | Indicates whether the permission set cannot be changed |
##### RolePermissions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the role permission grant |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id` |
| PermissionKey | text | 160 | Tenant-scoped permission key granted to the role |
| GrantedAtUtc | datetime2 | - | UTC date and time when the permission was granted |
##### UserRoles table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant role assignment |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| UserId | uniqueidentifier | 36 | Foreign key to `Users.Id` |
| RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id` |
| AssignedAtUtc | datetime2 | - | UTC date and time when the role was assigned |
##### Customers table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the customer |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerCode | text | 50 | Unique customer code within the tenant |
| FullName | text | 200 | Full name of the customer |
| MobileNumber | text | 50 | Mobile or contact number |
| Email | text | 50 | Customer email address |
| PasswordHash | text | 512 | Hashed customer password value |
| Address | text | 500 | Customer address |
| AddressDetails | text | 500 | Extra address detail such as lot, floor, unit, or landmark |
| CreatedAtUtc | datetime2 | - | UTC date and time when the customer was registered |
##### CustomerContactOptions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the reusable customer contact or address option |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| Label | text | 120 | Customer-facing label for the saved contact or address |
| ContactName | text | 200 | Person to contact for the saved option |
| PhoneNumber | text | 50 | Phone number for the saved option |
| Address | text | 500 | Search-selected or manually entered address |
| AddressDetails | text | 500 | Extra address detail not expected to resolve through geocoding |
| IsDefault | bit | 1 | Indicates the default saved option |
| CreatedAtUtc | datetime2 | - | UTC date and time when the option was created |
##### TenantCostingPolicies table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant costing and loan penalty policy |
| TenantId | uniqueidentifier | 36 | Unique foreign key to `Tenants.Id` |
| TaxLabel | text | 80 | Tax label used on service costing |
| DefaultTaxRate | decimal | 6,2 | Default tax percentage used on service costing |
| TaxEnabledByDefault | bit | 1 | Indicates whether tax is included by default |
| LoanLateFeeEnabled | bit | 1 | Indicates whether late-loan penalties are enabled |
| LoanLateFeeGracePeriodDays | int | 10 | Number of days before a late penalty can apply |
| LoanLateFeeFlatAmount | decimal | 12,2 | Flat late fee amount |
| LoanLateFeeRatePercent | decimal | 6,2 | Percentage late fee rate |
| CreatedAtUtc | datetime2 | - | UTC date and time when the policy was created |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the policy was last updated |
##### ServiceCostPresets table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the reusable service costing preset |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Category | text | 50 | Preset category such as Base, Service, Part, or Other |
| Name | text | 160 | Preset line-item name |
| DefaultSpecification | text | 300 | Optional default specification |
| DefaultQuantity | decimal | 10,2 | Default quantity copied into a cost sheet |
| DefaultUnitPrice | decimal | 12,2 | Default unit price copied into a cost sheet |
| IsActive | bit | 1 | Active or inactive preset state |
| SortOrder | int | 10 | Display order inside the pricing workspace |
| CreatedAtUtc | datetime2 | - | UTC date and time when the preset was created |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the preset was last updated |
##### ServiceRequests table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the service request |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| RequestNumber | text | 50 | Unique service request number within the tenant |
| ItemType | text | 100 | General item type, such as oven or laptop |
| ItemDescription | text | 500 | Detailed description of the service item |
| IssueDescription | text | 1000 | Customer-reported issue or complaint |
| RequestedServiceDate | datetime2 | - | Requested service schedule, if provided |
| ServiceMode | text | 50 | Visit mode such as drop-off, pickup, or onsite |
| ServiceAddress | text | 500 | Service address used when the work needs a visit or pickup |
| ServiceAddressDetails | text | 500 | Extra service address detail such as unit, building, or landmark |
| ContactName | text | 200 | Contact person for the request |
| ContactPhone | text | 50 | Contact phone number for the request |
| PreferredScheduleStartUtc | datetime2 | - | Optional preferred service window start |
| PreferredScheduleEndUtc | datetime2 | - | Optional preferred service window end |
| NeededByUtc | datetime2 | - | Optional due date or pre-order target date |
| Priority | text | 50 | Priority level of the request |
| CurrentStatus | text | 50 | Current workflow status of the request |
| Rating | int | 10 | Optional customer rating from 1 to 5 |
| FeedbackComments | text | 1000 | Optional customer feedback comments after service |
| FeedbackSuggestionCategory | text | 80 | Optional customer suggestion category |
| CompletedAtUtc | datetime2 | - | UTC date and time when service work completed |
| FeedbackSubmittedAtUtc | datetime2 | - | UTC date and time when feedback was submitted |
| FeedbackExpiresAtUtc | datetime2 | - | UTC date and time when feedback collection expires |
| CancellationRequestedAtUtc | datetime2 | - | UTC date and time when customer cancellation was requested |
| CancelledAtUtc | datetime2 | - | UTC date and time when the request was cancelled |
| CancellationReason | text | 500 | Customer or operator cancellation reason |
| CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creator |
| CreatedByCustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` when created through the customer portal |
| CreatedAtUtc | datetime2 | - | UTC date and time when the request was created |
##### ServiceCostSheets table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the service cost sheet |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Unique foreign key to `ServiceRequests.Id` |
| Status | text | 50 | Cost sheet state such as Draft or Finalized |
| IsTaxEnabled | bit | 1 | Indicates whether tax is included in totals |
| TaxLabel | text | 80 | Tax label used for this request |
| TaxRate | decimal | 6,2 | Tax percentage used for this request |
| Notes | text | 1000 | Technician or admin costing notes |
| CreatedAtUtc | datetime2 | - | UTC date and time when the sheet was created |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the sheet was last updated |
| FinalizedAtUtc | datetime2 | - | UTC date and time when the sheet was finalized |
##### ServiceCostLines table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the service cost line |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceCostSheetId | uniqueidentifier | 36 | Foreign key to `ServiceCostSheets.Id` |
| ServiceCostPresetId | uniqueidentifier | 36 | Optional foreign key to the copied `ServiceCostPresets.Id` |
| Category | text | 50 | Cost line category such as Base, Service, Part, or Other |
| Name | text | 160 | Cost line name |
| Specification | text | 300 | Optional part or service specification |
| Quantity | decimal | 10,2 | Quantity applied to the line |
| UnitPrice | decimal | 12,2 | Unit price applied to the line |
| SortOrder | int | 10 | Display order inside the cost sheet |
| CreatedAtUtc | datetime2 | - | UTC date and time when the line was created |
| UpdatedAtUtc | datetime2 | - | UTC date and time when the line was last updated |
##### ServiceRequestAttachments table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the customer request attachment |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id` |
| SubmittedByCustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` for the uploader |
| OriginalFileName | text | 260 | Original uploaded file name |
| StoredFileName | text | 260 | Stored provider or local file name |
| ContentType | text | 120 | Uploaded file content type |
| RelativeUrl | text | 500 | Relative path or hosted image URL |
| CreatedAtUtc | datetime2 | - | UTC date and time when the attachment was submitted |
##### StatusLogs table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the status log |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id` |
| Status | text | 50 | Status value recorded for the request |
| Remarks | text | 1000 | Remarks or explanation of the status change |
| ChangedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the operator who changed the status |
| ChangedByCustomerId | uniqueidentifier | 36 | Optional foreign key to `Customers.Id` for customer-originated changes |
| ChangedAtUtc | datetime2 | - | UTC date and time when the status changed |
##### Assignments table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the assignment |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id` |
| AssignedUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the assigned staff member |
| AssignedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the assigning manager |
| ScheduledStartUtc | datetime2 | - | Planned start date and time |
| ScheduledEndUtc | datetime2 | - | Planned end date and time |
| AssignmentStatus | text | 50 | Current status of the assignment |
| CreatedAtUtc | datetime2 | - | UTC date and time when the assignment was created |
##### AssignmentEvents table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the assignment event row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| AssignmentId | uniqueidentifier | 36 | Foreign key to `Assignments.Id` |
| EventType | text | 50 | Event category such as Assigned, Rescheduled, or HandedOver |
| PreviousAssignedUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the previous assignee |
| AssignedUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the current assignee |
| PreviousScheduledStartUtc | datetime2 | - | Optional previous planned start date and time |
| PreviousScheduledEndUtc | datetime2 | - | Optional previous planned end date and time |
| ScheduledStartUtc | datetime2 | - | Optional current planned start date and time |
| ScheduledEndUtc | datetime2 | - | Optional current planned end date and time |
| AssignmentStatus | text | 50 | Assignment status recorded for the event |
| Remarks | text | 1000 | Notes explaining the assignment change |
| ChangedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the actor who changed the assignment |
| CreatedAtUtc | datetime2 | - | UTC date and time when the event was logged |
##### AssignmentEvidence table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the assignment evidence row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| AssignmentId | uniqueidentifier | 36 | Foreign key to `Assignments.Id` |
| SubmittedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the uploader |
| Note | text | 2000 | Evidence note or submission remark |
| OriginalFileName | text | 260 | Optional original file name supplied by the client |
| StoredFileName | text | 260 | Optional stored file name used by the system |
| ContentType | text | 120 | Optional uploaded file content type |
| RelativeUrl | text | 500 | Optional relative path or URL to the uploaded evidence |
| CreatedAtUtc | datetime2 | - | UTC date and time when the evidence was submitted |
##### TenantBillingRecords table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant subscription billing record |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| SubmittedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the operator or owner who submitted the record |
| BillingPeriodLabel | text | 100 | Human-readable billing cycle label |
| CoverageStartUtc | datetime2 | - | UTC date and time when coverage starts |
| CoverageEndUtc | datetime2 | - | UTC date and time when coverage ends |
| DueDateUtc | datetime2 | - | UTC due date of the billing cycle |
| AmountDue | decimal | 12,2 | Amount expected for the billing cycle |
| AmountSubmitted | decimal | 12,2 | Amount submitted or recorded as paid |
| PaymentMethod | text | 50 | Payment method such as Stripe, Cash, GCash, or Manual |
| ReferenceNumber | text | 100 | External or manual payment reference |
| Status | text | 50 | Review or billing state |
| Note | text | 1000 | Optional submitter note |
| ReviewRemarks | text | 1000 | Optional reviewer remarks |
| ProofOriginalFileName | text | 260 | Original uploaded proof file name |
| ProofStoredFileName | text | 260 | Stored provider or local file name |
| ProofContentType | text | 120 | Uploaded proof content type |
| ProofRelativeUrl | text | 500 | Relative path or hosted proof URL |
| SubmittedAtUtc | datetime2 | - | UTC date and time when the record was submitted |
| ReviewedAtUtc | datetime2 | - | UTC date and time when the record was reviewed |
##### Invoices table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Optional foreign key to `ServiceRequests.Id` |
| InvoiceNumber | text | 50 | Unique invoice number within the tenant |
| InvoiceDateUtc | datetime2 | - | UTC date and time of invoice issuance |
| SubtotalAmount | decimal | 12,2 | Sum of invoice line amounts before discount and loan handling |
| TaxAmount | decimal | 12,2 | Tax amount calculated from the service cost sheet or invoice inputs |
| InterestableAmount | decimal | 12,2 | Amount eligible for financing or interest |
| DiscountAmount | decimal | 12,2 | Discount amount applied to the invoice |
| TotalAmount | decimal | 12,2 | Final total amount due |
| OutstandingAmount | decimal | 12,2 | Remaining unpaid amount |
| InvoiceStatus | text | 50 | Status of the invoice, such as Open or Paid |
| LoanApprovalStatus | text | 50 | Maker-checker approval state before invoice-to-loan release |
| LoanApprovalRequestedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the maker requesting loan approval |
| LoanApprovalRequestedAtUtc | datetime2 | - | UTC date and time when loan approval was requested |
| LoanApprovalReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the checker reviewing the request |
| LoanApprovalReviewedAtUtc | datetime2 | - | UTC date and time when the request was approved or rejected |
| LoanApprovalRemarks | text | 1000 | Maker or checker remarks attached to the approval request |
##### InvoicePaymentSubmissions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of a customer payment proof or online payment submission |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Optional foreign key to `ServiceRequests.Id` |
| AmountSubmitted | decimal | 12,2 | Amount submitted by the customer |
| ApprovedAmount | decimal | 12,2 | Amount approved by tenant staff |
| PaymentMethod | text | 80 | Payment method such as Stripe, GCash, Cash, or Bank |
| ReferenceNumber | text | 120 | External or manual payment reference |
| Note | text | 1000 | Optional customer note |
| Status | text | 50 | Review state such as Pending, Approved, Rejected, or Paid |
| ReviewRemarks | text | 1000 | Optional tenant review remarks |
| ProofOriginalFileName | text | 260 | Original uploaded proof file name |
| ProofStoredFileName | text | 260 | Stored provider or local file name |
| ProofContentType | text | 120 | Uploaded proof content type |
| ProofRelativeUrl | text | 500 | Relative path or hosted proof URL |
| SubmittedAtUtc | datetime2 | - | UTC date and time when the submission was created |
| ReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the reviewer |
| ReviewedAtUtc | datetime2 | - | UTC date and time when the submission was reviewed |
##### InvoiceLines table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice line |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id` |
| Category | text | 50 | Invoice line category copied from costing or entered manually |
| Name | text | 160 | Invoice line name |
| Specification | text | 300 | Optional item or service specification |
| Description | text | 500 | Description of the billed item or service |
| Quantity | decimal | 10,2 | Quantity billed on the line |
| UnitPrice | decimal | 12,2 | Unit price of the line item |
| LineTotal | decimal | 12,2 | Extended amount of the line item |
| SortOrder | int | 10 | Display order of the invoice line |
##### MicroLoans table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the micro-loan |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| InvoiceId | uniqueidentifier | 36 | Optional foreign key to `Invoices.Id`; one invoice can produce at most one loan when present |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| PrincipalAmount | decimal | 12,2 | Loan principal amount |
| AnnualInterestRate | decimal | 6,2 | Annual interest rate used for computation |
| TermMonths | int | 10 | Loan term in months |
| MonthlyInstallment | decimal | 12,2 | Fixed installment amount per month |
| TotalInterestAmount | decimal | 12,2 | Total interest for the whole loan |
| TotalRepayableAmount | decimal | 12,2 | Total amount to be repaid |
| LoanStartDate | datetime2 | - | Start date of the loan |
| MaturityDate | datetime2 | - | Final due date of the loan |
| ReferenceNumber | text | 100 | Optional standalone loan reference retained before approval and ledger release |
| Remarks | text | 1000 | Optional loan or release remarks |
| LoanStatus | text | 50 | Current status of the loan |
| ApprovalStatus | text | 50 | Maker-checker approval state for standalone loan release |
| ApprovalRequestedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the maker requesting approval |
| ApprovalRequestedAtUtc | datetime2 | - | UTC date and time when approval was requested |
| ApprovalReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the checker reviewing the loan |
| ApprovalReviewedAtUtc | datetime2 | - | UTC date and time when the loan was approved or rejected |
| ApprovalRemarks | text | 1000 | Maker or checker remarks attached to the standalone approval |
| CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creating operator |
| CreatedAtUtc | datetime2 | - | UTC date and time when the loan was created |
##### AmortizationSchedules table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the amortization row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| MicroLoanId | uniqueidentifier | 36 | Foreign key to `MicroLoans.Id` |
| InstallmentNumber | int | 10 | Sequence number of the installment |
| DueDate | datetime2 | - | Due date of the installment |
| BeginningBalance | decimal | 12,2 | Loan balance before the installment |
| PrincipalPortion | decimal | 12,2 | Principal amount included in the installment |
| InterestPortion | decimal | 12,2 | Interest amount included in the installment |
| InstallmentAmount | decimal | 12,2 | Total installment amount due |
| EndingBalance | decimal | 12,2 | Balance after the installment |
| PaidAmount | decimal | 12,2 | Amount already paid against the installment |
| LateFeeAmount | decimal | 12,2 | Late penalty amount applied to the installment |
| LateFeeAppliedAtUtc | datetime2 | - | UTC date and time when the late fee was applied |
| InstallmentStatus | text | 50 | Status of the installment, such as Unpaid, Partial, or Paid |
##### Transactions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the ledger transaction |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| InvoiceId | uniqueidentifier | 36 | Optional foreign key to `Invoices.Id` |
| MicroLoanId | uniqueidentifier | 36 | Optional foreign key to `MicroLoans.Id` |
| AmortizationScheduleId | uniqueidentifier | 36 | Optional foreign key to `AmortizationSchedules.Id` |
| ReversalOfTransactionId | uniqueidentifier | 36 | Optional foreign key to a transaction reversed by this posting |
| TransactionDateUtc | datetime2 | - | UTC date and time of the ledger event |
| TransactionType | text | 50 | Type of ledger event, such as Invoice, Loan, or Payment |
| ReferenceNumber | text | 100 | Human-readable transaction reference |
| DebitAmount | decimal | 12,2 | Debit amount recorded in the ledger |
| CreditAmount | decimal | 12,2 | Credit amount recorded in the ledger |
| RunningBalance | decimal | 12,2 | Balance after the transaction posting |
| Remarks | text | 1000 | Transaction remarks or explanation |
| CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creating operator |
##### Feedback and attachment modeling note

Customer feedback is currently stored on `ServiceRequests` through `Rating`, `FeedbackComments`, `FeedbackSuggestionCategory`, `FeedbackSubmittedAtUtc`, and `FeedbackExpiresAtUtc`. Customer-uploaded request images are stored as `ServiceRequestAttachments`, while technician evidence is stored as `AssignmentEvidence`.

#### Level 3 - Service Staff / Technician

Tables primarily handled by this user:

- `Customers`
- `ServiceRequests`
- `StatusLogs`
- `Assignments`
- `AssignmentEvidence`
- `ServiceRequestAttachments` (view only)

##### Customers table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the customer |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerCode | text | 50 | Unique customer code within the tenant |
| FullName | text | 200 | Customer full name |
| MobileNumber | text | 50 | Contact number used for service coordination |
| Email | text | 50 | Customer email address |
| PasswordHash | text | 512 | Hashed customer password value |
| Address | text | 500 | Customer address |
| CreatedAtUtc | datetime2 | - | UTC date and time when the customer was added |
##### ServiceRequests table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the service request |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| RequestNumber | text | 50 | Unique service request number |
| ItemType | text | 100 | Category of the service item |
| ItemDescription | text | 500 | Description of the item being serviced |
| IssueDescription | text | 1000 | Reported issue of the item |
| RequestedServiceDate | datetime2 | - | Requested schedule of service |
| Priority | text | 50 | Request priority |
| CurrentStatus | text | 50 | Current work status |
| Rating | int | 10 | Optional customer rating from 1 to 5 |
| FeedbackComments | text | 1000 | Optional customer feedback comments after service |
| CreatedByUserId | uniqueidentifier | 36 | User who created the request |
| CreatedAtUtc | datetime2 | - | UTC date and time when the request was created |
##### StatusLogs table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the status update row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id` |
| Status | text | 50 | Updated service status |
| Remarks | text | 1000 | Notes regarding the update |
| ChangedByUserId | uniqueidentifier | 36 | User who made the update |
| ChangedAtUtc | datetime2 | - | UTC date and time when the update was posted |
##### Assignments table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the assignment row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id` |
| AssignedUserId | uniqueidentifier | 36 | Technician or staff assigned to the task |
| AssignedByUserId | uniqueidentifier | 36 | User who created the assignment |
| ScheduledStartUtc | datetime2 | - | Planned start schedule |
| ScheduledEndUtc | datetime2 | - | Planned completion schedule |
| AssignmentStatus | text | 50 | Current assignment status |
| CreatedAtUtc | datetime2 | - | UTC date and time when the assignment was logged |
##### Service evidence note

Technician work evidence is stored in `AssignmentEvidence`. Customer-submitted request images are stored in `ServiceRequestAttachments`. Feedback and rating fields remain on `ServiceRequests` instead of a separate feedback table.

#### Level 4 - Finance Staff / Loan Officer / Cashier

Tables primarily handled by this user:

- `Customers`
- `Invoices`
- `InvoiceLines`
- `MicroLoans`
- `AmortizationSchedules`
- `Transactions`
- `AuditEvents`

##### Customers table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the customer |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerCode | text | 50 | Unique customer code used in finance and service flows |
| FullName | text | 200 | Customer full name |
| MobileNumber | text | 50 | Contact number |
| Email | text | 50 | Customer email address |
| PasswordHash | text | 512 | Hashed customer password value |
| Address | text | 500 | Customer address |
| CreatedAtUtc | datetime2 | - | UTC date and time when the customer was created |
##### Invoices table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Optional source service request |
| InvoiceNumber | text | 50 | Unique invoice number |
| InvoiceDateUtc | datetime2 | - | Invoice issue date and time |
| SubtotalAmount | decimal | 12,2 | Total before discounts |
| InterestableAmount | decimal | 12,2 | Amount eligible for financing |
| DiscountAmount | decimal | 12,2 | Discount applied to the invoice |
| TotalAmount | decimal | 12,2 | Final billed amount |
| OutstandingAmount | decimal | 12,2 | Remaining unpaid balance |
| InvoiceStatus | text | 50 | Current invoice status |
##### InvoiceLines table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice line |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id` |
| Description | text | 500 | Billed service or item description |
| Quantity | decimal | 10,2 | Quantity billed |
| UnitPrice | decimal | 12,2 | Unit price |
| LineTotal | decimal | 12,2 | Total amount of the line |
##### MicroLoans table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the micro-loan |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| InvoiceId | uniqueidentifier | 36 | Optional source invoice converted into a loan |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| PrincipalAmount | decimal | 12,2 | Loan principal |
| AnnualInterestRate | decimal | 6,2 | Annual interest rate |
| TermMonths | int | 10 | Repayment term in months |
| MonthlyInstallment | decimal | 12,2 | Monthly amortization amount |
| TotalInterestAmount | decimal | 12,2 | Total interest value |
| TotalRepayableAmount | decimal | 12,2 | Principal plus total interest |
| LoanStartDate | datetime2 | - | Loan start date |
| MaturityDate | datetime2 | - | Final due date |
| LoanStatus | text | 50 | Loan lifecycle status |
| CreatedByUserId | uniqueidentifier | 36 | User who created the loan |
| CreatedAtUtc | datetime2 | - | UTC date and time when the loan was created |
##### AmortizationSchedules table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the amortization row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| MicroLoanId | uniqueidentifier | 36 | Foreign key to `MicroLoans.Id` |
| InstallmentNumber | int | 10 | Installment sequence number |
| DueDate | datetime2 | - | Installment due date |
| BeginningBalance | decimal | 12,2 | Balance before the installment |
| PrincipalPortion | decimal | 12,2 | Principal component of the installment |
| InterestPortion | decimal | 12,2 | Interest component of the installment |
| InstallmentAmount | decimal | 12,2 | Total installment amount |
| EndingBalance | decimal | 12,2 | Balance after the installment |
| PaidAmount | decimal | 12,2 | Amount already paid against the row |
| InstallmentStatus | text | 50 | Status of the installment |
##### Transactions table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the transaction row |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| InvoiceId | uniqueidentifier | 36 | Optional invoice reference |
| MicroLoanId | uniqueidentifier | 36 | Optional loan reference |
| AmortizationScheduleId | uniqueidentifier | 36 | Optional schedule reference |
| TransactionDateUtc | datetime2 | - | Date and time of the ledger posting |
| TransactionType | text | 50 | Kind of financial transaction |
| ReferenceNumber | text | 100 | Receipt number or ledger reference |
| DebitAmount | decimal | 12,2 | Debit amount |
| CreditAmount | decimal | 12,2 | Credit amount |
| RunningBalance | decimal | 12,2 | Balance after posting |
| Remarks | text | 1000 | Notes about the posting |
| CreatedByUserId | uniqueidentifier | 36 | User who created the transaction |
##### AuditEvents table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the audit event |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| Scope | text | 50 | Audit scope such as Root, SMS, or MLS |
| Category | text | 50 | Audit category such as System or Security |
| ActionType | text | 100 | Action being audited |
| Outcome | text | 50 | Result such as Success, Failed, or Blocked |
| ActorUserId | uniqueidentifier | 36 | Optional actor user reference |
| SubjectType | text | 100 | Affected business subject type |
| SubjectId | uniqueidentifier | 36 | Optional affected subject identifier |
| Detail | text | 1000 | Change summary or event detail |
| IpAddress | text | 80 | Client IP address |
| OccurredAtUtc | datetime2 | - | UTC date and time when the action occurred |
#### Level 5 - Customer / External Client

Tables primarily handled by this user:

- `Customers`
- `CustomerContactOptions`
- `ServiceRequests`
- `ServiceRequestAttachments`
- `Invoices`
- `InvoicePaymentSubmissions`

##### Customers table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the customer profile |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerCode | text | 50 | Unique customer code |
| FullName | text | 200 | Customer full name |
| MobileNumber | text | 50 | Customer contact number |
| Email | text | 50 | Customer email address |
| PasswordHash | text | 512 | Hashed customer password value |
| Address | text | 500 | Customer address |
| CreatedAtUtc | datetime2 | - | UTC date and time when the customer profile was created |
##### ServiceRequests table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the service request |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| RequestNumber | text | 50 | Service request number visible to the customer |
| ItemType | text | 100 | Item category |
| ItemDescription | text | 500 | Description of the submitted item |
| IssueDescription | text | 1000 | Reported problem |
| RequestedServiceDate | datetime2 | - | Requested service date |
| Priority | text | 50 | Priority category |
| CurrentStatus | text | 50 | Current service status visible to the customer |
| Rating | int | 10 | Optional customer rating from 1 to 5 |
| FeedbackComments | text | 1000 | Optional customer feedback comments after service |
| CreatedByUserId | uniqueidentifier | 36 | User who registered the request |
| CreatedAtUtc | datetime2 | - | UTC date and time when the request was created |
##### Invoices table

| Field Names | Datatype | Length | Description |
|---|---|---|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice |
| TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id` |
| CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` |
| ServiceRequestId | uniqueidentifier | 36 | Related service request when applicable |
| InvoiceNumber | text | 50 | Invoice number given to the customer |
| InvoiceDateUtc | datetime2 | - | Invoice issue date |
| SubtotalAmount | decimal | 12,2 | Amount before discount |
| InterestableAmount | decimal | 12,2 | Amount that may be financed |
| DiscountAmount | decimal | 12,2 | Discount amount |
| TotalAmount | decimal | 12,2 | Final amount due |
| OutstandingAmount | decimal | 12,2 | Remaining amount not yet paid |
| InvoiceStatus | text | 50 | Invoice payment status |
##### Customer portal modeling note

The customer portal uses the same tenant-scoped `Customers`, `CustomerContactOptions`, `ServiceRequests`, `ServiceRequestAttachments`, `Invoices`, and `InvoicePaymentSubmissions` tables. Customer identity remains isolated per tenant domain; there is no shared cross-tenant customer profile table.

#### Notes

- Implemented tables in the current codebase: `Tenants`, `TenantThemes`, `PlatformTenantRegistrations`, `SubscriptionTiers`, `ModuleCatalog`, `SubscriptionTierModules`, `Users`, `Roles`, `RolePermissions`, `UserRoles`, `RefreshSessions`, `ExternalServiceStates`, `AuditEvents`, `Customers`, `CustomerContactOptions`, `TenantCostingPolicies`, `ServiceCostPresets`, `ServiceRequests`, `ServiceCostSheets`, `ServiceCostLines`, `ServiceRequestAttachments`, `StatusLogs`, `Assignments`, `AssignmentEvents`, `AssignmentEvidence`, `TenantBillingRecords`, `Invoices`, `InvoicePaymentSubmissions`, `InvoiceLines`, `MicroLoans`, `AmortizationSchedules`, `Transactions`.
- Future hardening is better modeled as workflow depth over these implemented tables unless a new table is explicitly introduced by migration. Examples: deeper MLS reporting aggregates, Google auth/MFA artifacts, and optional tenant-specific entitlement overrides beyond `SubscriptionTierModules`.
- Persisted MLS maker-checker approval is now modeled through approval status, maker, checker, timestamp, and remarks fields on `Invoices` and `MicroLoans`.
- `Collections Queue` and reporting screens are currently better modeled as derived queries, dashboards, or views from `MicroLoans`, `AmortizationSchedules`, and `Transactions`, not as standalone base tables.
## Entity Relationship Diagram Appendix

```sql
-- ServiFinance ERD import script for dbdiagram.io
-- Last updated: 2026-05-11
-- Implemented tables from the current EF Core model are listed below.

CREATE TABLE Tenants (
  Id uniqueidentifier PRIMARY KEY,
  Name text(200) NOT NULL,
  Code text(50) NOT NULL UNIQUE,
  DomainSlug text(100) NOT NULL UNIQUE,
  BusinessSizeSegment text(50) NOT NULL,
  SubscriptionEdition text(50) NOT NULL,
  SubscriptionPlan text(100) NOT NULL,
  SubscriptionStatus text(100) NOT NULL,
  BillingProvider text(50) NOT NULL,
  StripeCustomerId text(200),
  StripeSubscriptionId text(200),
  PendingSubscriptionTierId uniqueidentifier,
  PendingSubscriptionChangeRequestedAtUtc datetime2,
  PendingSubscriptionChangeEffectiveAtUtc datetime2,
  PendingSubscriptionChangeCancelledAtUtc datetime2,
  SubscriptionChangeCooldownUntilUtc datetime2,
  CreatedAtUtc datetime2 NOT NULL,
  IsActive bit NOT NULL,
  CONSTRAINT FK_Tenants_PendingSubscriptionTier FOREIGN KEY (PendingSubscriptionTierId) REFERENCES SubscriptionTiers(Id)
);

CREATE TABLE TenantThemes (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL UNIQUE,
  DisplayName text(200),
  LogoUrl text(500),
  PrimaryColor text(20),
  SecondaryColor text(20),
  HeaderBackgroundColor text(20),
  PageBackgroundColor text(20),
  CONSTRAINT FK_TenantThemes_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE PlatformTenantRegistrations (
  Id uniqueidentifier PRIMARY KEY,
  SubscriptionTierId uniqueidentifier NOT NULL,
  TenantId uniqueidentifier,
  BusinessName text(200) NOT NULL,
  TenantCode text(50) NOT NULL,
  DomainSlug text(100) NOT NULL,
  OwnerFullName text(200) NOT NULL,
  OwnerEmail text(50) NOT NULL,
  OwnerPasswordHash text(512) NOT NULL,
  Status text(50) NOT NULL,
  StripeCheckoutSessionId text(200) UNIQUE,
  StripeCustomerId text(200),
  StripeSubscriptionId text(200) UNIQUE,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CheckoutExpiresAtUtc datetime2,
  ProvisionedAtUtc datetime2,
  FailureReason text(500),
  CONSTRAINT FK_PlatformTenantRegistrations_SubscriptionTiers FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id),
  CONSTRAINT FK_PlatformTenantRegistrations_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE SubscriptionTiers (
  Id uniqueidentifier PRIMARY KEY,
  Code text(50) NOT NULL UNIQUE,
  DisplayName text(100) NOT NULL,
  BusinessSizeSegment text(50) NOT NULL,
  SubscriptionEdition text(50) NOT NULL,
  AudienceSummary text(200) NOT NULL,
  Description text(1000) NOT NULL,
  MonthlyPriceAmount decimal(18,2) NOT NULL,
  CurrencyCode text(3) NOT NULL,
  PriceDisplay text(100) NOT NULL,
  BillingLabel text(100) NOT NULL,
  PlanSummary text(300) NOT NULL,
  HighlightLabel text(100) NOT NULL,
  SortOrder int NOT NULL,
  IncludesServiceManagementWeb bit NOT NULL,
  IncludesMicroLendingDesktop bit NOT NULL,
  IsActive bit NOT NULL
);

CREATE TABLE ModuleCatalog (
  Id uniqueidentifier PRIMARY KEY,
  Code text(50) NOT NULL UNIQUE,
  Name text(150) NOT NULL,
  Channel text(50) NOT NULL,
  Summary text(300) NOT NULL,
  SortOrder int NOT NULL,
  IsActive bit NOT NULL
);

CREATE TABLE SubscriptionTierModules (
  Id uniqueidentifier PRIMARY KEY,
  SubscriptionTierId uniqueidentifier NOT NULL,
  PlatformModuleId uniqueidentifier NOT NULL,
  AccessLevel text(30) NOT NULL,
  SortOrder int NOT NULL,
  CONSTRAINT UQ_SubscriptionTierModules_Tier_Module UNIQUE (SubscriptionTierId, PlatformModuleId),
  CONSTRAINT FK_SubscriptionTierModules_SubscriptionTiers FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id),
  CONSTRAINT FK_SubscriptionTierModules_ModuleCatalog FOREIGN KEY (PlatformModuleId) REFERENCES ModuleCatalog(Id)
);

CREATE TABLE Users (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Email text(50) NOT NULL,
  PasswordHash text(512) NOT NULL,
  FullName text(200) NOT NULL,
  IsActive bit NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_Users_Email UNIQUE (Email),
  CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE Roles (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Name text(100) NOT NULL,
  Description text(256) NOT NULL,
  PlatformScope text(30) NOT NULL,
  Rank int NOT NULL,
  IsSystemRole bit NOT NULL,
  IsPermissionSetLocked bit NOT NULL,
  CONSTRAINT UQ_Roles_Tenant_Name UNIQUE (TenantId, Name),
  CONSTRAINT FK_Roles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE RolePermissions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  RoleId uniqueidentifier NOT NULL,
  PermissionKey text(160) NOT NULL,
  GrantedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_RolePermissions_Tenant_Role_Key UNIQUE (TenantId, RoleId, PermissionKey),
  CONSTRAINT FK_RolePermissions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE UserRoles (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  UserId uniqueidentifier NOT NULL,
  RoleId uniqueidentifier NOT NULL,
  AssignedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_UserRoles_Tenant_User_Role UNIQUE (TenantId, UserId, RoleId),
  CONSTRAINT FK_UserRoles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE Customers (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerCode text(50) NOT NULL,
  FullName text(200) NOT NULL,
  MobileNumber text(50) NOT NULL,
  Email text(50) NOT NULL,
  PasswordHash text(512) NOT NULL,
  Address text(500) NOT NULL,
  AddressDetails text(500),
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_Customers_Tenant_CustomerCode UNIQUE (TenantId, CustomerCode),
  CONSTRAINT FK_Customers_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE CustomerContactOptions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  Label text(120) NOT NULL,
  ContactName text(200) NOT NULL,
  PhoneNumber text(50) NOT NULL,
  Address text(500) NOT NULL,
  AddressDetails text(500),
  IsDefault bit NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_CustomerContactOptions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_CustomerContactOptions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id)
);

CREATE TABLE RefreshSessions (
  Id uniqueidentifier PRIMARY KEY,
  UserId uniqueidentifier,
  CustomerId uniqueidentifier,
  Surface text(50) NOT NULL,
  RememberMe bit NOT NULL,
  RefreshTokenHash text(128) NOT NULL UNIQUE,
  ExpiresAtUtc datetime2 NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  LastRotatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_RefreshSessions_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_RefreshSessions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id)
);

CREATE TABLE ExternalServiceStates (
  Id uniqueidentifier PRIMARY KEY,
  Provider text(50) NOT NULL,
  StateKey text(200) NOT NULL,
  PayloadJson text(max),
  ExpiresAtUtc datetime2,
  NextAllowedRequestUtc datetime2,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_ExternalServiceStates_Provider_Key UNIQUE (Provider, StateKey)
);

CREATE TABLE ServiceRequests (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  RequestNumber text(50) NOT NULL,
  ItemType text(100) NOT NULL,
  ItemDescription text(500) NOT NULL,
  IssueDescription text(1000) NOT NULL,
  RequestedServiceDate datetime2,
  ServiceMode text(50) NOT NULL,
  ServiceAddress text(500) NOT NULL,
  ServiceAddressDetails text(500),
  ContactName text(200) NOT NULL,
  ContactPhone text(50) NOT NULL,
  PreferredScheduleStartUtc datetime2,
  PreferredScheduleEndUtc datetime2,
  NeededByUtc datetime2,
  Priority text(50) NOT NULL,
  CurrentStatus text(50) NOT NULL,
  Rating int,
  FeedbackComments text(1000),
  FeedbackSuggestionCategory text(80),
  CompletedAtUtc datetime2,
  FeedbackSubmittedAtUtc datetime2,
  FeedbackExpiresAtUtc datetime2,
  CancellationRequestedAtUtc datetime2,
  CancelledAtUtc datetime2,
  CancellationReason text(500),
  CreatedByUserId uniqueidentifier,
  CreatedByCustomerId uniqueidentifier,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_ServiceRequests_Tenant_RequestNumber UNIQUE (TenantId, RequestNumber),
  CONSTRAINT FK_ServiceRequests_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequests_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_ServiceRequests_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_ServiceRequests_CreatedByCustomer FOREIGN KEY (CreatedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE TenantCostingPolicies (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL UNIQUE,
  TaxLabel text(80) NOT NULL,
  DefaultTaxRate decimal(6,2) NOT NULL,
  TaxEnabledByDefault bit NOT NULL,
  LoanLateFeeEnabled bit NOT NULL,
  LoanLateFeeGracePeriodDays int NOT NULL,
  LoanLateFeeFlatAmount decimal(12,2) NOT NULL,
  LoanLateFeeRatePercent decimal(6,2) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_TenantCostingPolicies_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE ServiceCostPresets (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Category text(50) NOT NULL,
  Name text(160) NOT NULL,
  DefaultSpecification text(300),
  DefaultQuantity decimal(10,2) NOT NULL,
  DefaultUnitPrice decimal(12,2) NOT NULL,
  IsActive bit NOT NULL,
  SortOrder int NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceCostPresets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE ServiceCostSheets (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL UNIQUE,
  Status text(50) NOT NULL,
  IsTaxEnabled bit NOT NULL,
  TaxLabel text(80) NOT NULL,
  TaxRate decimal(6,2) NOT NULL,
  Notes text(1000),
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  FinalizedAtUtc datetime2,
  CONSTRAINT FK_ServiceCostSheets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceCostSheets_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id)
);

CREATE TABLE ServiceCostLines (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceCostSheetId uniqueidentifier NOT NULL,
  ServiceCostPresetId uniqueidentifier,
  Category text(50) NOT NULL,
  Name text(160) NOT NULL,
  Specification text(300),
  Quantity decimal(10,2) NOT NULL,
  UnitPrice decimal(12,2) NOT NULL,
  SortOrder int NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceCostLines_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceCostLines_ServiceCostSheets FOREIGN KEY (ServiceCostSheetId) REFERENCES ServiceCostSheets(Id),
  CONSTRAINT FK_ServiceCostLines_ServiceCostPresets FOREIGN KEY (ServiceCostPresetId) REFERENCES ServiceCostPresets(Id)
);

CREATE TABLE ServiceRequestAttachments (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  SubmittedByCustomerId uniqueidentifier NOT NULL,
  OriginalFileName text(260) NOT NULL,
  StoredFileName text(260) NOT NULL,
  ContentType text(120) NOT NULL,
  RelativeUrl text(500) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceRequestAttachments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequestAttachments_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_ServiceRequestAttachments_Customers FOREIGN KEY (SubmittedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE StatusLogs (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  Status text(50) NOT NULL,
  Remarks text(1000) NOT NULL,
  ChangedByUserId uniqueidentifier,
  ChangedByCustomerId uniqueidentifier,
  ChangedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_StatusLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_StatusLogs_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_StatusLogs_Users FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_StatusLogs_Customers FOREIGN KEY (ChangedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE Assignments (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  AssignedUserId uniqueidentifier NOT NULL,
  AssignedByUserId uniqueidentifier NOT NULL,
  ScheduledStartUtc datetime2,
  ScheduledEndUtc datetime2,
  AssignmentStatus text(50) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_Assignments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Assignments_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Assignments_AssignedUser FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_Assignments_AssignedByUser FOREIGN KEY (AssignedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AssignmentEvents (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  AssignmentId uniqueidentifier NOT NULL,
  EventType text(50) NOT NULL,
  PreviousAssignedUserId uniqueidentifier,
  AssignedUserId uniqueidentifier NOT NULL,
  PreviousScheduledStartUtc datetime2,
  PreviousScheduledEndUtc datetime2,
  ScheduledStartUtc datetime2,
  ScheduledEndUtc datetime2,
  AssignmentStatus text(50) NOT NULL,
  Remarks text(1000) NOT NULL,
  ChangedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AssignmentEvents_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AssignmentEvents_Assignments FOREIGN KEY (AssignmentId) REFERENCES Assignments(Id),
  CONSTRAINT FK_AssignmentEvents_PreviousAssignedUser FOREIGN KEY (PreviousAssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_AssignmentEvents_AssignedUser FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_AssignmentEvents_ChangedByUser FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AssignmentEvidence (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  AssignmentId uniqueidentifier NOT NULL,
  SubmittedByUserId uniqueidentifier NOT NULL,
  Note text(2000) NOT NULL,
  OriginalFileName text(260),
  StoredFileName text(260),
  ContentType text(120),
  RelativeUrl text(500),
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AssignmentEvidence_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AssignmentEvidence_Assignments FOREIGN KEY (AssignmentId) REFERENCES Assignments(Id),
  CONSTRAINT FK_AssignmentEvidence_SubmittedByUser FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id)
);

CREATE TABLE TenantBillingRecords (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  SubmittedByUserId uniqueidentifier NOT NULL,
  BillingPeriodLabel text(100) NOT NULL,
  CoverageStartUtc datetime2 NOT NULL,
  CoverageEndUtc datetime2 NOT NULL,
  DueDateUtc datetime2 NOT NULL,
  AmountDue decimal(12,2) NOT NULL,
  AmountSubmitted decimal(12,2) NOT NULL,
  PaymentMethod text(50) NOT NULL,
  ReferenceNumber text(100) NOT NULL,
  Status text(50) NOT NULL,
  Note text(1000),
  ReviewRemarks text(1000),
  ProofOriginalFileName text(260),
  ProofStoredFileName text(260),
  ProofContentType text(120),
  ProofRelativeUrl text(500),
  SubmittedAtUtc datetime2 NOT NULL,
  ReviewedAtUtc datetime2,
  CONSTRAINT FK_TenantBillingRecords_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_TenantBillingRecords_SubmittedByUser FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id)
);

CREATE TABLE Invoices (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier,
  InvoiceNumber text(50) NOT NULL,
  InvoiceDateUtc datetime2 NOT NULL,
  SubtotalAmount decimal(12,2) NOT NULL,
  TaxAmount decimal(12,2) NOT NULL,
  InterestableAmount decimal(12,2) NOT NULL,
  DiscountAmount decimal(12,2) NOT NULL,
  TotalAmount decimal(12,2) NOT NULL,
  OutstandingAmount decimal(12,2) NOT NULL,
  InvoiceStatus text(50) NOT NULL,
  LoanApprovalStatus text(50) NOT NULL,
  LoanApprovalRequestedByUserId uniqueidentifier,
  LoanApprovalRequestedAtUtc datetime2,
  LoanApprovalReviewedByUserId uniqueidentifier,
  LoanApprovalReviewedAtUtc datetime2,
  LoanApprovalRemarks text(1000),
  CONSTRAINT UQ_Invoices_Tenant_InvoiceNumber UNIQUE (TenantId, InvoiceNumber),
  CONSTRAINT FK_Invoices_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Invoices_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_Invoices_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Invoices_LoanApprovalRequestedByUser FOREIGN KEY (LoanApprovalRequestedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_Invoices_LoanApprovalReviewedByUser FOREIGN KEY (LoanApprovalReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE InvoicePaymentSubmissions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier,
  AmountSubmitted decimal(12,2) NOT NULL,
  ApprovedAmount decimal(12,2),
  PaymentMethod text(80) NOT NULL,
  ReferenceNumber text(120) NOT NULL,
  Note text(1000),
  Status text(50) NOT NULL,
  ReviewRemarks text(1000),
  ProofOriginalFileName text(260),
  ProofStoredFileName text(260),
  ProofContentType text(120),
  ProofRelativeUrl text(500),
  SubmittedAtUtc datetime2 NOT NULL,
  ReviewedByUserId uniqueidentifier,
  ReviewedAtUtc datetime2,
  CONSTRAINT FK_InvoicePaymentSubmissions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_ReviewedByUser FOREIGN KEY (ReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE InvoiceLines (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier NOT NULL,
  Category text(50) NOT NULL,
  Name text(160) NOT NULL,
  Specification text(300),
  Description text(500) NOT NULL,
  Quantity decimal(10,2) NOT NULL,
  UnitPrice decimal(12,2) NOT NULL,
  LineTotal decimal(12,2) NOT NULL,
  SortOrder int NOT NULL,
  CONSTRAINT FK_InvoiceLines_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_InvoiceLines_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id)
);

CREATE TABLE MicroLoans (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier UNIQUE,
  CustomerId uniqueidentifier NOT NULL,
  PrincipalAmount decimal(12,2) NOT NULL,
  AnnualInterestRate decimal(6,2) NOT NULL,
  TermMonths int NOT NULL,
  MonthlyInstallment decimal(12,2) NOT NULL,
  TotalInterestAmount decimal(12,2) NOT NULL,
  TotalRepayableAmount decimal(12,2) NOT NULL,
  LoanStartDate datetime2 NOT NULL,
  MaturityDate datetime2 NOT NULL,
  ReferenceNumber text(100),
  Remarks text(1000),
  LoanStatus text(50) NOT NULL,
  ApprovalStatus text(50) NOT NULL,
  ApprovalRequestedByUserId uniqueidentifier,
  ApprovalRequestedAtUtc datetime2,
  ApprovalReviewedByUserId uniqueidentifier,
  ApprovalReviewedAtUtc datetime2,
  ApprovalRemarks text(1000),
  CreatedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_MicroLoans_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_MicroLoans_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_MicroLoans_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_MicroLoans_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_MicroLoans_ApprovalRequestedByUser FOREIGN KEY (ApprovalRequestedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_MicroLoans_ApprovalReviewedByUser FOREIGN KEY (ApprovalReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AmortizationSchedules (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  MicroLoanId uniqueidentifier NOT NULL,
  InstallmentNumber int NOT NULL,
  DueDate datetime2 NOT NULL,
  BeginningBalance decimal(12,2) NOT NULL,
  PrincipalPortion decimal(12,2) NOT NULL,
  InterestPortion decimal(12,2) NOT NULL,
  InstallmentAmount decimal(12,2) NOT NULL,
  EndingBalance decimal(12,2) NOT NULL,
  PaidAmount decimal(12,2) NOT NULL,
  LateFeeAmount decimal(12,2) NOT NULL,
  LateFeeAppliedAtUtc datetime2,
  InstallmentStatus text(50) NOT NULL,
  CONSTRAINT UQ_AmortizationSchedules_Loan_Installment UNIQUE (MicroLoanId, InstallmentNumber),
  CONSTRAINT FK_AmortizationSchedules_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AmortizationSchedules_MicroLoans FOREIGN KEY (MicroLoanId) REFERENCES MicroLoans(Id)
);

CREATE TABLE Transactions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier,
  MicroLoanId uniqueidentifier,
  AmortizationScheduleId uniqueidentifier,
  ReversalOfTransactionId uniqueidentifier,
  TransactionDateUtc datetime2 NOT NULL,
  TransactionType text(50) NOT NULL,
  ReferenceNumber text(100) NOT NULL,
  DebitAmount decimal(12,2) NOT NULL,
  CreditAmount decimal(12,2) NOT NULL,
  RunningBalance decimal(12,2) NOT NULL,
  Remarks text(1000) NOT NULL,
  CreatedByUserId uniqueidentifier NOT NULL,
  CONSTRAINT FK_Transactions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Transactions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_Transactions_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_Transactions_MicroLoans FOREIGN KEY (MicroLoanId) REFERENCES MicroLoans(Id),
  CONSTRAINT FK_Transactions_AmortizationSchedules FOREIGN KEY (AmortizationScheduleId) REFERENCES AmortizationSchedules(Id),
  CONSTRAINT FK_Transactions_Reversal FOREIGN KEY (ReversalOfTransactionId) REFERENCES Transactions(Id),
  CONSTRAINT FK_Transactions_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AuditEvents (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Scope text(50) NOT NULL,
  Category text(50) NOT NULL,
  ActionType text(100) NOT NULL,
  Outcome text(50) NOT NULL,
  ActorUserId uniqueidentifier,
  ActorName text(200) NOT NULL,
  ActorEmail text(50) NOT NULL,
  SubjectType text(100) NOT NULL,
  SubjectId uniqueidentifier,
  SubjectLabel text(300) NOT NULL,
  Detail text(1000) NOT NULL,
  IpAddress text(80),
  UserAgent text(500),
  OccurredAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AuditEvents_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AuditEvents_ActorUser FOREIGN KEY (ActorUserId) REFERENCES Users(Id)
);
```

