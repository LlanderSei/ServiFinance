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

To deepen Phase 3 further:

- add reassignment history so schedule changes are auditable from the dispatch surface
- support technician completion evidence such as job notes and job photo attachments
- add dispatch conflict detection for overlapping staff schedules
- surface technician-specific task timelines or calendar views beyond the current table register
- expose assignment filtering by priority, status, and date window for busier tenants

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
