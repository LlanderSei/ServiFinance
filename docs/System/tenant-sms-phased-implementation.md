# Tenant Service Management UI Phases

This document breaks the tenant-side Service Management System into phased UI implementation slices so the web surface can be built incrementally on top of the shared authenticated shell.

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
