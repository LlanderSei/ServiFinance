# Tenant Service Management UI Phases

This document breaks the tenant-side Service Management System into phased UI implementation slices so the web surface can be built incrementally on top of the shared authenticated shell.

## IT15 Use-Case Coverage Check

Based on `Use Case IT15 ServiFinance`, the current SMS web implementation is already strong on the internal tenant-operations side:

- tenant login is implemented
- staff account management is implemented
- schedule and dispatch flows are implemented
- operational reporting is implemented
- technician assigned-task visibility is implemented through the dispatch `My tasks` view
- service status updates are implemented through dispatch assignment updates
- job photo and evidence uploads are implemented
- service invoice finalization is implemented

The remaining gaps are now narrower and mostly centered on deeper commercial automation rather than core service operations:

- embedded custom card or wallet forms for service invoices are not implemented; online settlement now uses hosted Stripe Checkout instead
- service-invoice settlement can now be posted from the customer portal, tenant SMS direct-payment confirmation, or MLS desktop finance review, but cashier-side reconciliation and mixed settlement paths can still be tightened

There is also one workflow-tightening gap where the use-case intent is only partially matched:

- invoice finalization currently exists, but it is admin-gated rather than clearly modeled as a dispatcher or service-completion workflow

## Phase 1: Navigable Tenant SMS Workspace

Goal:

- Replace tenant SMS placeholders with consistent route-level interfaces using the same sidebar, header, record table, and modal language already used by the superadmin surface.

Routes included:

- `SMS Dashboard`
- `Customers`
- `Service Requests`
- `Dispatch`
- `Reports`
- `Staff Accounts`

Outputs:

- tenant sidebar grouping aligned to service workflows
- consistent record workspace layout for tenant pages
- working tenant staff account management retained inside the new shell
- placeholder record tables for customer, request, dispatch, and report modules

Current implementation:

- sidebar now exposes `Customers`, `Service Requests`, `Dispatch`, `Reports`, and `Staff Accounts`
- tenant SMS dashboard now uses the normalized authenticated record workspace
- tenant staff account management now uses the shared record workspace and table layout
- customer, request, dispatch, and reporting routes exist as scaffold interfaces for the next data-backed slices

## Phase 2: Customer and Service Intake Records

Goal:

- Start real tenant-side CRUD around customer records and service intake.

Must add:

- customer listing and customer detail modal
- create customer flow
- service request listing and intake flow
- request status labels and priority labels
- links between customer records and service requests

Current implementation:

- tenant customer listing now reads from the `Customers` table
- customer creation flow is available from the tenant SMS customer page
- tenant service request listing now reads from the `ServiceRequests` table
- service request intake flow is available from the tenant SMS request page
- service request detail modal now exposes customer linkage, issue summary, and provenance

## Phase 3: Dispatch and Technician Flow

Goal:

- Add the assignment and operational workflow for service work execution.

Must add:

- assignment scheduling table
- dispatch modal or drawer
- technician task view
- service status updates
- job photo upload placeholder and eventual attachment flow

Current implementation:

- tenant dispatch now reads from the `Assignments` table
- administrators can schedule assignments against live service requests and active tenant staff accounts
- dispatch operators can switch between workspace assignments and their own task queue
- assignment status updates now push service status changes back into the linked service request
- job photo upload remains documented as a placeholder for the next slice

## Phase 4: Reporting and Operator Visibility

Goal:

- Surface operational summaries to tenant administrators and business owners.

Must add:

- operational report catalog
- daily activity summary
- technician workload view
- service status distribution
- export-ready report layouts

Current implementation:

- tenant reporting now exposes a live report catalog backed by service and dispatch data
- daily activity summary is generated from customer, request, and assignment activity
- technician workload is summarized from active and completed assignments
- service status distribution is surfaced from the live service request register
- export-ready spreadsheet and print layouts are now available from the reporting workspace

## Phase 5: Finance Handoff Alignment

Goal:

- Prepare SMS records so service work can hand off cleanly into the MLS desktop side.

Must add:

- invoice-finalization handoff indicators
- service request to invoice traceability
- convert-to-loan visibility for eligible records
- tenant-side audit trail hooks for status and dispatch changes

Current implementation:

- tenant service requests now surface finance handoff state directly in the request register
- completed service requests can now be finalized into finance-ready invoices from the SMS workspace
- request and dispatch detail views now expose invoice traceability, loan-conversion readiness, and audit history
- dispatch records now reflect whether work is still awaiting invoicing, ready for desktop loan conversion, or already converted in MLS

## Phase 6: Dispatch Evidence and Schedule Intelligence

Goal:

- deepen the dispatch workspace so it can support busier tenants with auditable schedule changes, richer technician evidence, and smarter execution planning.

Must add:

- reassignment history so assignment ownership and schedule changes are auditable
- technician completion evidence such as job notes and job photo attachments
- dispatch conflict detection for overlapping staff schedules
- technician timeline or calendar views in addition to the table register
- assignment filtering by priority, status, assigned staff, and date window

Planned outputs:

- assignment detail history showing who reassigned work, when, and why
- technician completion submission flow for notes and uploaded proof of service
- schedule validation feedback before conflicting assignments are saved
- alternate dispatch view optimized for technician timelines and daily planning
- richer dispatch filtering controls for higher-volume tenants

Implementation notes:

- this phase should build on the existing `Assignments` model and detail modals rather than introducing a separate workflow surface
- evidence uploads should be designed so the same proof objects can later support MLS-side validation or dispute review
- conflict detection should be advisory first, then block only clearly invalid overlaps if tenant rules require it

Current implementation:

- dispatch register now supports filtering by assigned staff, assignment status, priority, and date window
- dispatch rows now surface overlapping schedule counts so conflicts are visible directly from the table
- assignment detail now exposes reassignment and status event history separate from the service audit trail
- technicians and administrators can now submit completion evidence with notes and photo attachments
- administrators can now reschedule or reassign work from the existing dispatch detail flow
- dispatch workspace now includes an alternate timeline view for day-grouped technician planning
- schedule validation now blocks hard overlaps when scheduled or in-progress assignments share the same technician and service window
- evidence review now supports note editing and proof removal from the existing dispatch detail modal

## Phase 7: Reporting Windows and Turnaround Analytics

Goal:

- extend the reporting workspace beyond static snapshots so tenant operators can compare recent operating windows and measure execution speed.

Must add:

- report date-window controls with a previous-period comparison
- selected-window activity metrics for intake, dispatch, completion, and invoice finalization
- turnaround metrics for intake-to-completion, request-to-schedule, and scheduled work duration
- overdue open-request visibility for operational follow-up
- report exports that include the selected analysis window and comparison results

Planned outputs:

- reports workspace controls for last-7-day, last-30-day, and custom comparison windows
- current-versus-previous comparison rows for core service activity metrics
- turnaround cards that quantify service completion pace and scheduling lead time
- export-ready CSV and print packets that preserve the chosen reporting window

Implementation notes:

- compute completion timing from existing status logs and assignment timestamps before introducing dedicated SLA entities
- keep window comparison period-based so the current and previous windows always span equal day counts
- overdue visibility should stay advisory inside the reporting workspace until tenant escalation rules exist

Current implementation:

- reports workspace now supports last-7-day, last-30-day, and custom date-window analysis
- selected-window activity now surfaces new customers, new requests, assignments scheduled, assignments completed, completed requests, and invoices finalized
- current-versus-previous comparison now quantifies delta values and percentage changes for the selected reporting window
- turnaround metrics now show average intake-to-completion time, request-to-schedule lead time, scheduled work duration, and overdue open requests
- CSV and print exports now include the selected reporting window, comparison results, and turnaround metrics
- SMS service reporting now includes customer feedback/CRM signals: average rating, pending and expired feedback windows, low-rating count, service-linked feedback highlights, and grouped suggestion themes
- the SMS dashboard and Service Requests register now surface customer ratings or pending/expired feedback state directly beside operational service records

## Phase 8: Customer Self-Service & Service Tracking
**Status:** Implemented

### Goal
Provide a secure, tenant-scoped, public-facing portal where end-customers can create their identity, submit service requests, track service progress, and view invoices without entering the tenant operator’s back-office.

### Implementation Requirements
- **Customer Auth Surface:** Separate customer authentication endpoints, establishing `CustomerWeb` authentication surface scoped strictly to the tenant domain (`/t/{slug}/c/*`).
- **Registration & Login:** Enable real API-backed registration and login mapping to the backend `Customer` entity (now enhanced with `PasswordHash`).
- **Dashboard & Navigation:** Present a responsive overview, sidebar/drawer navigation, and active session details.
- **Service Request Tracking:** Provide customer-owned request list fetching, displaying status timelines and progress (e.g. `GET /api/customer-portal/requests`).
- **Request Submission:** Enable self-service intake where customers create `ServiceRequest` records directly (`POST /api/customer-portal/requests`).
- **Invoice Readiness and Settlement Visibility:** Expose finalized or pending invoices linked to the customer account (`GET /api/customer-portal/invoices`) and allow manual settlement-proof submission for finance review.
- **Feedback & Ratings:** Support post-completion survey capturing customer ratings and feedback text attached directly to completed `ServiceRequest` records.

### Planned Outputs
- customer portal route set such as `/t/{slug}/c/login`, `/t/{slug}/c/register`, `/t/{slug}/c/dashboard`, `/t/{slug}/c/requests`, `/t/{slug}/c/invoices`, and `/t/{slug}/c/feedback`
- tenant-scoped customer registration form that creates a customer account only for the active tenant domain
- customer login flow that authenticates into the customer portal without exposing staff navigation or staff APIs
- customer-facing intake page that can create a service request without tenant-staff intervention
- request tracking page keyed by secure lookup token, reference number, or customer session
- customer-visible service timeline built from request and dispatch status history
- post-completion feedback form with rating and comments linked to the completed service record

Implementation notes:

- keep customer access separate from tenant staff auth so customer status lookup does not expose tenant workspace data
- do not place customer login inside `/sms`; `/sms` remains the internal service-management workspace for tenant operators
- customer identity is tenant-scoped by default, so the same real-world person may hold separate customer accounts under different tenant domains
- customer registration should create or bind only within the active tenant domain and should not automatically reveal or merge records from other tenants
- treat `real-time status` as status-timeline freshness first, then add push or short-poll updates only if needed
- if direct online payments are deferred, the first slice should still support invoice payment status, proof, or cashier-confirmed settlement tracking
- customer feedback should attach to the service request or finalized invoice so reporting can later include satisfaction metrics

Current implementation:

- tenant-scoped customer registration and login now use real backend auth endpoints under `/api/auth/customer/*`
- customer routes now live under `/t/{slug}/c/*` and are served by the web host for direct browser access
- customer dashboard, request list, invoice list, and feedback routes now load inside a dedicated customer shell with mobile drawer navigation
- customers can create new service requests directly from the portal without tenant-staff intervention
- customer request tracking now includes a request-detail page with service timeline, dispatch assignment context, and invoice handoff visibility
- customer invoices now expose settlement status, outstanding balances, whether the invoice has already been converted into an MLS loan account, and the submission/review trail for manual settlement proofs
- customer feedback and ratings now persist back to completed service requests through the portal
- customer feedback is now lifecycle-bound to service completion with stored completion, submission, and 7-day expiry timestamps
- customer feedback can now capture a suggestion category in addition to the 1-5 star rating and optional comments
- expired feedback windows are now visible in the customer dashboard, customer feedback workspace, and request details
- customers can now attach issue pictures to open service requests, stored as service-request intake attachments separate from technician completion evidence
- customer-uploaded request pictures are visible from the customer request detail page and tenant SMS service request detail modal
- customers now have a profile page where they can maintain their tenant-scoped full name, phone number, default address, and saved service contact/address loadouts
- service request intake now captures service mode (`Drop-off`, `On-site`, or `Pickup`), service address, contact person, contact phone, preferred service window, and needed-by date for pre-order or scheduled-visit scenarios
- saved customer contact/address loadouts can prefill new service requests, reducing repeated typing for home, branch, or office service locations
- customers can now cancel untouched `New` requests directly, or submit a cancellation request for tenant review once work has already moved into scheduling or execution
- tenant SMS service request details now surface customer logistics, preferred availability, needed-by dates, cancellation state, cancellation reason, and customer-uploaded pictures in the operator detail modal
- customers can now submit manual payment proof for finalized service invoices, including amount, payment method, reference number, receipt image or PDF, and optional settlement note
- customers can now start hosted Stripe Checkout for fully unpaid finalized direct-settlement invoices without leaving the customer portal flow permanently
- customer request details and invoice history now show settlement-proof review outcomes, approved amounts, review remarks, and linked receipt files for transparency
- tenant SMS service request details now allow owner or administrator users to confirm direct service-invoice payments such as cash, GCash, Maya, bank transfer, card, or other recorded settlement methods
- MLS customer finance now includes a `Settlements` tab where tenant finance staff can approve or reject customer-submitted service-invoice settlement proofs
- approving or rejecting a settlement proof now updates invoice state (`Payment Submitted`, `Partially Paid`, or `Paid`) and writes service-request status-log entries so customer notifications can react to finance movement
- once direct settlement starts through manual proof, hosted checkout, or tenant-recorded payment, the invoice leaves the `Finalized` loan-conversion queue so MLS loan conversion only remains available for untouched finalized balances

Deferred within or after this phase:

- embedded custom card or wallet payment forms are still deferred; the current customer portal uses hosted Stripe Checkout, while offline or semi-manual settlement still uses proof submission and tenant finance review
- guest or token-based tracking links are still deferred; request tracking currently uses the authenticated customer session

## Phase 9: Tenant Subscription and Domain Billing Workspace

Goal:

- implement the tenant-admin billing use case that is still absent from the current SMS web surface.

Must add:

- tenant-facing subscription summary and billing status
- domain or tenant subscription payment history
- renewal, proof-of-payment, or billing confirmation workflow depending on the chosen commercial model
- plan suspension-risk visibility tied to subscription state

Planned outputs:

- billing workspace for tenant administrators and business owners
- subscription status card with plan, edition, renewal date, and account standing
- billing ledger or payment-history table for subscription-related payments
- payment processing flow for subscription renewals or manual billing review

Implementation notes:

- this can live as a tenant billing workspace beside SMS rather than being embedded inside the operational routes
- align this slice with the existing superadmin subscription catalog so tenant billing uses the same tier metadata
- if billing remains manual for now, ship review and proof-submission first, then automate payment collection later

Current implementation:

- implemented as a tenant-admin billing workspace at `/t/{slug}/billing`
- tenant admins can now review plan, edition, billing cadence, renewal checkpoint, risk posture, and unlocked module coverage from the same tenant-scoped page
- a persisted `TenantBillingRecords` ledger now stores subscription-cycle history, submitted amount, payment method, reference number, notes, proof metadata, and submission status
- root onboarding at `/register` now creates a Stripe subscription checkout for the selected MSME tier and provisions the tenant after Stripe webhook confirmation
- Stripe-managed tenants can now open the hosted billing portal from `/t/{slug}/billing`, and tenant subscription renewal now relies on the provider-managed auto-renewal flow instead of manual renewal proof submission
- Stripe invoice webhooks now sync subscription-cycle billing entries into the tenant billing ledger so the same workspace can show Stripe-managed payment history
- manual tenant subscription proof submission is now disabled at the API boundary so renewal state does not drift away from the configured billing provider
- the billing workspace is aligned to the same superadmin subscription catalog metadata, so plan labels, price display, billing label, and module coverage stay consistent across platform and tenant views

Deferred within or after this phase:

- embedded custom payment forms are still deferred; the current Stripe collection flow uses hosted Checkout and the hosted billing portal rather than in-app card form capture
- platform-side billing review and reconciliation tooling can still be tightened further around Stripe invoice sync, failed renewals, and subscription recovery flows

## Phase 10: Workflow Tightening and Role Hardening

Goal:

- tighten the existing SMS modules so they better match the IT15 use-case actors and are safer to extend.

Must add:

- clearer role separation between tenant admin, dispatcher, and technician actions
- authorization rules for who can create staff, dispatch jobs, update task status, submit evidence, and finalize invoices
- cleanup of remaining role-name assumptions and route-level entitlement checks
- module polish across customers, service requests, dispatch, and reports

Planned outputs:

- action-level permission matrix for SMS workflows
- invoice-finalization workflow aligned to the intended operator role instead of an admin-only shortcut
- cleaner module boundaries between internal operations, customer self-service, and tenant billing
- targeted UX cleanup and validation tightening across already-implemented SMS screens

Implementation notes:

- this phase is primarily hardening and cleanup, not a brand-new business module
- do this before adding many more user-facing surfaces so role drift does not spread through the API and UI
- pair this with module-entitlement enforcement so tenant surfaces match subscription and MSME tier rules

Current implementation:

- role and permission management is now implemented as a scoped administration surface instead of only implicit role-name assumptions
- the backend role model now stores `PlatformScope`, numeric `Rank`, system-role state, and locked permission-set state
- a persisted `RolePermissions` catalog now stores granted permission keys per role and tenant scope
- default role catalogs now cover root `SuperAdmin`, tenant `Owner` / `Administrator`, SMS `SMS Staff` / `SMS Dispatcher` / `SMS Technician`, and MLS `MLS Staff` / `MLS Cashier`
- `SuperAdmin` is locked to all root-side permissions and cannot be edited from the role-permission surface
- tenant `Owner` and `Administrator` are locked to full SMS and MLS authority and cannot be edited from the role-permission surface
- lower operational roles can carry dedicated permission sets, and role rank prevents same-rank or higher-rank edits
- Roles & Permissions pages now exist for Superadmin, Tenant SMS, and Tenant MLS with independent `Roles`, `Permissions`, and `Matrix` tab interfaces
- the `Roles` tab now supports adding mutable roles, editing editable role metadata, changing SMS/MLS scope targeting, and viewing users assigned to a role
- role rank uniqueness is now guarded within the tenant/root role catalog so two roles cannot share the same rank in the same management boundary
- sidebar navigation now exposes `Roles & Permissions` under Administration for all three scopes
- backend authorization now has a reusable role-permission guard that checks the persisted permission matrix for the current user's role set
- login/session payloads now carry role platform scopes and effective permission keys, so custom role names no longer need `SMS` or `MLS` in the role name to enter the correct workspace
- sidebar navigation now consumes effective permission keys and hides view tabs the signed-in account cannot access, while accounts with no visible permissions still receive an explanatory empty-permission workspace
- tenant workspace logout now requires confirmation and returns to the matching workspace login entry instead of always redirecting to the root platform page
- tenant platform-user scope display now uses stored role `PlatformScope` values instead of role-name parsing, so custom SMS/MLS roles no longer appear as `Unscoped`
- SMS endpoint filters now enforce role permissions and subscription module entitlement across customers, service requests, service costing, invoice finalization, dispatch, reports, pricing, platform users, and SMS roles/permissions
- key SMS actions that were previously owner/admin-only now use explicit permission keys instead, so custom lower-ranked roles can be granted scoped access without becoming administrators
- SMS module access now checks the active tenant subscription tier before allowing module-backed endpoints such as service intake, scheduling, job updates, invoicing, reports, and staff administration
- Superadmin subscription management now controls which active tier exposes each SMS/MLS module, with `Included`, `Limited`, and `Not Included` tier-module access levels
- root registration now presents the live tier catalog by Standard/Premium edition before opening a Stripe checkout modal for the chosen tier
- MLS endpoint filters now enforce role permissions on top of the existing MLS subscription and module entitlement checks across dashboard, customer finance, settlement review, loan conversion, standalone loans, loan accounts, collections, reports, ledger, and audit
- login and refresh session payloads now expose effective tenant module access, so the frontend can make the same subscription-entitlement decisions as the API
- tenant SMS and MLS sidebar navigation now hides screens when either the view permission or the subscription module entitlement is missing
- route-level SMS and MLS guards now show a plan-access message when a user has role permission but the tenant subscription tier does not include the requested module
- `Limited` and `Included` now differ at runtime: limited modules unlock base surfaces, while full-only actions such as SMS role matrix management, pricing settings, dispatch reschedule/handover, evidence management, report exports/custom windows, and MLS ledger drilldown require `Included`
- backend module guards now explicitly deny `Not Included` access levels instead of relying only on missing tier-module assignments
- MLS settlement approval and rejection now use an explicit `mls.settlements.manage` permission so customer-submitted service-invoice settlement proofs can be delegated without granting broader owner or administrator authority
- tenant billing and tenant audit APIs now use explicit billing and audit permission keys instead of broad owner/admin role checks
- Roles & Permissions no longer renders SMS and MLS as two separate content blocks; roles, permissions, and matrix views now merge the alternate platform into the main table/list when the cross-platform toggle is enabled
- SMS service request finance actions now expose frontend readiness states before calling the API: create request, edit costing, finalize invoice, and direct settlement buttons are disabled with permission/module/status reasons instead of relying on a backend `403`
- the service request details modal now includes a finance-tab completion review so invoice finalization is tied more clearly to service completion, costing readiness, and settlement eligibility
- Dispatch assignment details now keep eligible lifecycle actions visible but disabled with permission/module/status reasons for evidence, rescheduling, status movement, cancellation, handover, and abandonment
- Customer record create/update actions now use permission-plus-Service Intake readiness with disabled reasons across table actions, FAB actions, and modal submits
- Pricing management actions now use frontend readiness that matches the backend's full Invoicing requirement before saving costing policy or preset catalog changes
- Reports custom windows, CSV export, and print output now expose full-Reports readiness reasons and warning toasts instead of silently no-oping when the tenant only has limited reporting access

Remaining after this slice:

- remaining action-affordance work is now mostly shared/cross-scope polish, such as platform user-management edge states, root mutable-role endpoint migration, and any newly added module pages that gain write actions later
- superadmin/root endpoints still mostly rely on the locked `SuperAdmin` role and should be migrated to root permission keys if mutable root roles are used seriously

## Phase 11: Medium SMS Control Modules

Goal:

- give `Medium` tenants a real subscription difference over `Small` without turning SMS into a separate product.

Added SMS module direction:

- `W8_SLA_ESCALATIONS`: overdue service windows, due-today risk, unscheduled requests, and escalation priority
- `W9_FEEDBACK_CRM`: customer ratings, feedback windows, low-rating follow-up, suggestion categories, and CRM-style review cues
- `W10_PARTS_COST_CONTROL`: costing gaps, invoice readiness, preset coverage, category totals, and transparent cost exposure

Current implementation:

- module catalog seeding now includes `W8_SLA_ESCALATIONS`, `W9_FEEDBACK_CRM`, and `W10_PARTS_COST_CONTROL`
- `Medium Standard` receives `W8` and `W9` as `Included`, plus `W10` as `Limited`
- `Medium Premium` receives full `W8`, `W9`, and `W10`
- backend SMS module constants and module labels now cover the new Medium SMS modules
- new permission keys exist for `sms.sla-escalations.view`, `sms.feedback-crm.view`, and `sms.cost-control.view`
- tenant SMS endpoints now expose dedicated, module-guarded read models for SLA escalations, feedback CRM, and cost control
- tenant SMS sidebar and route guards now hide/show the new pages based on both permission and subscription module access
- the new SMS pages reuse existing service request, feedback, costing, invoice, and assignment data instead of introducing new tables

Follow-up MLS Medium implementation:

- module catalog seeding now includes `D8_PORTFOLIO_RISK_DASHBOARD`, `D9_LOAN_APPROVAL_WORKFLOW`, and `D10_FINANCE_POLICY_CONTROL`
- `Medium Premium` receives the new MLS control modules as `Included`; Standard remains SMS web-only
- backend MLS module constants and module labels now cover the new Medium Premium desktop modules
- new permission keys exist for `mls.portfolio-risk.view`, `mls.loan-approvals.view`, and `mls.finance-policy.view`
- tenant MLS endpoints now expose dedicated, module-guarded read models for portfolio risk, loan approval readiness, and finance policy control
- tenant MLS desktop sidebar and routes now hide/show the new pages based on both permission and subscription module access
- the first approval page is intentionally read-only because persisted maker-checker approval states are not yet part of the loan schema; it reports readiness, payment-review blockers, and released loan signals from existing data

## Phase 12: Subscription Recovery and Downgrade Operations

Goal:

- make tenant subscription failure, payment-method recovery, and downgrade cleanup visible before locked modules interrupt SMS or MLS work.

Must add:

- billing recovery surface that explains what happens when auto-renewal fails
- clear recovery path for hosted provider payment-method updates or removal
- visibility into pending downgrade locked modules and active work that should be cleared before renewal
- shared SMS/MLS billing behavior so tenant owners see the same recovery posture regardless of workspace entry point

Current implementation:

- tenant billing now includes a dedicated `Recovery` tab as a separate interface file
- recovery posture summarizes account standing, suspension risk, provider state, expected renewal amount, latest billing event, and last confirmed coverage
- Stripe or configured-provider tenants can open the hosted billing portal from the recovery tab to update or remove the renewal payment method
- high-risk, failed-payment, overdue, and due-soon states now show recovery notices instead of only passive billing history
- pending downgrades now surface locked-module impact and active-work cleanup queues from the same billing workspace
- the recovery tab is shared by SMS and MLS tenant billing because both routes use the same tenant-scoped billing workspace and provider state

Next hardening candidates:

- platform-side failed-renewal operations for superadmin review and manual recovery intervention
- provider webhook coverage for unpaid, paused, cancelled, or expired subscription states if additional Stripe events are not yet synced
- backend enforcement policy for grace periods, read-only mode, and final suspension once renewal recovery fails

## Phase 13: Platform Subscription Recovery Operations

Goal:

- give the root platform operator a single recovery queue for failed renewals, overdue coverage, pending tenant plan switches, and downgrade cleanup readiness.

Must add:

- superadmin subscription-recovery endpoint that aggregates tenant standing from tenant billing records and provider state
- root Subscription Management tab that separates catalog editing from tenant recovery operations
- renewal-risk KPIs for high-risk tenants, payment failures, due-soon renewals, pending plan switches, and switch-cancellation cooldowns
- recommended recovery actions so superadmin can tell whether the next step belongs to Stripe/provider recovery, tenant cleanup, billing review, or manual suspension review

Current implementation:

- superadmin Subscription Management now has `Catalog` and `Recovery` top-level tabs
- `/api/superadmin/subscriptions/recovery` now returns platform-wide tenant renewal posture without adding new tables
- the recovery queue surfaces tenant plan, billing provider, subscription status, account standing, suspension risk, next renewal date, latest billing state, pending reviews, pending plan switches, cooldown state, and recommended action
- the recovery queue now classifies each tenant into an explicit recovery stage: `Active`, `Past due`, `Read-only recommended`, or `Suspension review`
- the recovery response now includes overdue age, the 7-day read-only review threshold, and the 14-day suspension-review threshold so operators can see where each tenant sits in the grace policy before enforcement is automated
- the Superadmin Recovery tab now exposes these recovery-stage counts as KPIs and shows the stage per tenant row beside the existing standing and recommended action
- tenant SMS, MLS, and shared tenant-administration API guards now enforce the same grace policy centrally: the first overdue week stays operational, day 7+ blocks unsafe non-billing actions as read-only recovery, and day 14+ blocks non-billing tenant workspace access until recovery or platform intervention
- the tenant Billing workspace remains accessible during read-only or suspension-review recovery so owners can open the billing portal, update payment methods, or review subscription state
- the recovery tab reuses the existing authenticated workspace patterns and is guarded by `root.subscriptions.manage`
- superadmin recovery now exposes intervention actions from the recovery queue: provider sync re-reads Stripe subscription status, and force suspension locks tenant workspace access once the tenant reaches suspension review
- Stripe subscription status normalization now treats provider status casing consistently so a successful provider sync or invoice payment does not accidentally deactivate an otherwise active tenant
- scheduled subscription recovery reconciliation now runs in the API host and automatically suspends active tenants once the shared recovery policy reaches the 14-day suspension-review threshold
- automatic suspension writes a platform-scoped system audit event so root operators can review when the background reconciliation locked a tenant
- tenant Billing remains accessible for subscription-recovery-suspended tenants, allowing owners to restore billing from the recovery workspace even after the rest of SMS/MLS tenant administration is locked
- this phase now has visibility, central API enforcement, manual platform intervention, and scheduled auto-suspension; it does not yet persist recovery-contact notes or broader provider event coverage beyond the current Stripe sync/webhook path

Next hardening candidates:

- optional superadmin recovery notes/contact tracking if the platform needs a persisted call log outside the audit trail
- provider webhook expansion for cancellation, unpaid, paused, incomplete-expired, and payment-method update events

## Phase 14: Hosted Image Uploads

Goal:

- move customer, technician, and branding image uploads behind a backend-mediated external image host instead of exposing upload provider keys in the browser.

Current implementation:

- backend ImgBB upload integration now uses a named `HttpClient` and the `ServiFinance__ExternalServices__ImgBB__ApiKey` configuration key
- customer service-request photos now upload through the API to ImgBB, then persist the returned public image URL on the existing service request attachment record
- dispatch technician evidence photos now upload through the API to ImgBB, then persist the returned public image URL on the existing assignment evidence record
- tenant branding now supports uploading a logo image through ImgBB from the Branding workspace while still keeping the manual logo URL field for overrides or clearing
- the API validates image signatures and only accepts JPG, PNG, or WebP for ImgBB-backed uploads
- upload limits are intentionally lower than ImgBB's provider limit: 5 MB for customer/dispatch evidence, 2 MB for tenant logos, and 5 images per evidence/request batch
- API-side in-memory rate guards limit repeated uploads per tenant actor and purpose so refreshes or accidental repeated submits do not immediately abuse the external provider

Operational notes:

- set `ServiFinance__ExternalServices__ImgBB__ApiKey` in `.env` or host environment variables before testing image uploads
- if the ImgBB key is missing, image upload endpoints fail clearly with a service-unavailable message while the rest of SMS/MLS remains usable
