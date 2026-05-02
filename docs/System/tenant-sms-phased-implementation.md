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

The remaining gaps are the customer-facing and billing-facing use cases that are still outside the current SMS web scope:

- customer service-invoice payment in the SMS web is not implemented
- tenant-facing domain or subscription payment processing is not implemented
- direct online invoice settlement or proof-submission is not implemented in the customer portal

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
- **Invoice Readiness:** Expose finalized or pending invoices linked to the customer account (`GET /api/customer-portal/invoices`), preparing for future settlement workflows.
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
- customer invoices now expose settlement status, outstanding balances, and whether the invoice has already been converted into an MLS loan account
- customer feedback and ratings now persist back to completed service requests through the portal

Deferred within or after this phase:

- direct online payment capture is still deferred; the current customer portal only tracks invoice and settlement state
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
- Stripe-managed tenants can now open the hosted billing portal from `/t/{slug}/billing`, while manual-billing tenants continue using the proof-submission path
- Stripe invoice webhooks now sync subscription-cycle billing entries into the tenant billing ledger so the same workspace can show Stripe-managed payment history
- manual renewal proof submission is still working for manual-billing tenants, with one pending-review submission allowed at a time to prevent duplicate renewal stacking
- the billing workspace is aligned to the same superadmin subscription catalog metadata, so plan labels, price display, billing label, and module coverage stay consistent across platform and tenant views

Deferred within or after this phase:

- embedded custom payment forms are still deferred; the current Stripe collection flow uses hosted Checkout and the hosted billing portal rather than in-app card form capture
- platform-side billing review and reconciliation tooling can still be tightened further, especially for mixed manual and Stripe-managed tenants

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

- partially implemented through current admin-only guards and tenant route checks, but not yet modeled as a full SMS permission system
