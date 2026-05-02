# ServiFinance Process Workflow

This document describes the end-to-end operating workflow of ServiFinance as one connected system, covering:

- superadmin platform operations
- tenant administration
- customer portal activity
- SMS web operations
- MLS finance and micro-lending workflows

It is written against the current ServiFinance structure and implementation direction.

## 1. System Overview

ServiFinance is a multi-tenant platform with two main business delivery surfaces:

- `SMS Web` for service management, customer intake, dispatch, execution tracking, and operational reporting
- `MLS Desktop` for invoice finance handling, loan conversion, payment posting, collections, ledger review, and audit review

The full business process typically moves in this order:

1. the platform owner provisions and governs tenants
2. a tenant operates service workflows in SMS
3. a customer interacts through the tenant-scoped customer portal
4. completed service work becomes invoice-ready in SMS
5. finance staff continue the money-side workflow in MLS when needed

## 2. Main Actors

- `Superadmin`: manages the SaaS platform, tenants, subscription catalog visibility, and system health
- `Tenant Administrator`: manages tenant staff, customer records, service intake, dispatch oversight, invoice finalization, and reporting
- `Dispatcher / Staff`: operates service request and assignment workflows inside the tenant SMS workspace
- `Technician`: receives assignments, updates work status, and submits execution evidence
- `Customer`: registers under a tenant domain, submits service requests, tracks service progress, views invoices, and leaves feedback
- `Finance / Cashier / Loan Officer`: handles invoice settlement review, loan conversion, payment posting, and ledger follow-up in MLS

## 3. Platform-Level Workflow

### 3.1 Superadmin Access

1. The platform operator signs in through the root superadmin surface.
2. The superadmin opens the platform dashboard to review overall tenant counts, subscription mix, and system health.
3. The superadmin reviews tenant records, module catalog visibility, and subscription-tier data.

### 3.2 Tenant Provisioning

1. A new tenant is registered through the platform onboarding flow.
2. The root registration flow now creates a Stripe subscription checkout session for the selected MSME tier.
3. After Stripe confirms the checkout, the platform provisions the tenant with:
   - identity information
   - domain slug
   - MSME size segment
   - subscription edition and plan
   - activation status
   - the first tenant administrator account
4. The tenant then becomes reachable through tenant-scoped routes such as:
   - `/t/{tenant}/sms/*`
   - `/t/{tenant}/c/*`
   - `/t/{tenant}/mls/*` or the MLS desktop channel

### 3.3 Platform Governance

1. The superadmin can review whether a tenant is active or suspended.
2. The superadmin can inspect subscription posture and module catalog metadata.
3. Tenant billing can now follow two commercial paths:
   - `Manual`, where tenant admins submit renewal proof for review
   - `Stripe`, where the subscription is collected through Stripe Checkout and later managed in the Stripe billing portal
4. Future entitlement enforcement and broader platform-side billing review will tighten this layer further.

## 4. Tenant Entry Workflow

### 4.1 Tenant Staff Authentication

1. A tenant staff member signs in under a tenant domain.
2. The system resolves the tenant context from the tenant route or login scope.
3. The user enters the internal tenant workspace, primarily the SMS web application.

### 4.2 Customer Authentication Surface

1. A customer signs in or registers under a tenant-specific customer route such as:
   - `/t/{tenant}/c/login`
   - `/t/{tenant}/c/register`
2. Customer identity is isolated per tenant domain.
3. The customer enters a separate customer portal and does not receive tenant staff navigation or staff APIs.

## 5. Tenant SMS Workflow

### 5.1 Customer Record Preparation

1. A tenant administrator or staff member creates or updates customer records in SMS.
2. These records hold the tenant-scoped customer identity used by:
   - service intake
   - dispatch
   - invoice linkage
   - finance handoff

### 5.2 Service Request Intake

Service requests can begin in two ways:

- tenant staff creates the request from the internal SMS workspace
- the customer creates the request from the tenant-scoped customer portal

The intake workflow is:

1. a customer record is selected or already known
2. the service request is created with item details, issue description, priority, and optional requested date
3. the request receives a request number and initial status
4. the request becomes visible in the tenant service request register

### 5.3 Dispatch and Assignment

1. A tenant administrator or dispatch-capable staff member opens the dispatch workspace.
2. A service request is scheduled and assigned to a technician or staff owner.
3. The assignment records:
   - assigned staff
   - assigning staff
   - schedule window
   - assignment status
4. The system keeps assignment history, reassignment events, and conflict checks for overlapping schedules.

### 5.4 Technician Execution

1. The technician opens `My tasks` or assignment views.
2. The technician accepts, starts, pauses, or completes assigned work.
3. The technician can submit evidence such as:
   - job notes
   - proof attachments
   - execution updates
4. Assignment updates push service-state changes back into the linked service request.

### 5.5 Service Status Tracking

1. Each meaningful status change is logged to the request history.
2. Tenant staff can inspect the service request and dispatch detail views for:
   - current service status
   - audit trail
   - assignment trail
   - evidence trail
3. The customer portal can read the customer-safe subset of this history for tracking.

### 5.6 Invoice Finalization in SMS

1. Once the work is assessed or completed, tenant staff finalizes the service request into an invoice.
2. The invoice becomes linked to the originating customer and service request.
3. SMS then marks the record for finance handoff visibility:
   - not yet invoiced
   - finance-ready
   - already converted into MLS flow
4. This is the transition point from pure service operations into finance handling.

## 6. Customer Portal Workflow

### 6.1 Customer Registration and Login

1. The customer creates a tenant-scoped account under the active tenant domain.
2. The customer signs in through the customer portal.
3. The customer reaches a separate authenticated shell designed for customer-only actions.

### 6.2 Customer Request Submission

1. The customer creates a new service request from the portal.
2. The request is saved directly into the same tenant service pipeline used by internal SMS staff.
3. The request appears in both:
   - the customer portal request list
   - the tenant SMS service request register

### 6.3 Customer Request Tracking

1. The customer opens the request list.
2. The customer can open a request detail page to inspect:
   - current service status
   - status timeline
   - assignment context
   - invoice handoff visibility
3. This gives the customer tracking visibility without exposing internal back-office controls.

### 6.4 Customer Invoice Visibility

1. Once a service invoice exists, it appears in the customer invoice list.
2. The customer can view:
   - invoice number
   - total amount
   - outstanding amount
   - invoice status
   - linked service request
   - whether the invoice has already become an MLS loan account
3. The customer side currently tracks invoice and settlement state only.

### 6.5 Customer Feedback

1. After a request is completed or closed, the customer can submit a rating and comment.
2. The feedback is attached directly to the completed service request.
3. This allows later reporting or service-quality review from the tenant side.

## 7. Payment and Settlement Responsibility

ServiFinance separates visibility from financial authority.

The intended split is:

- customer portal: see invoice and settlement status
- tenant internal side: confirm settlement, review proof if later enabled, and control invoice-state changes
- MLS side: post finance transactions and loan payments when the invoice has already entered loan workflow

This means:

1. Customers may eventually submit proof or payment intent, but they should not self-approve settlement.
2. Tenant staff remain responsible for confirming normal service-invoice settlement.
3. MLS finance users remain responsible for loan-related payment posting and ledger mutation.

## 8. MLS Finance Workflow

### 8.1 Entry Into MLS

1. A finalized SMS invoice becomes visible for finance review.
2. Finance staff open the MLS desktop or tenant MLS finance workspace.
3. They review the invoice, customer, and finance-ready balance.

### 8.2 Finance Decision

The finance operator chooses one of the following:

- keep the invoice as a normal settled service invoice
- convert the invoice into a micro-loan
- create a standalone loan when the finance case starts outside a service invoice

### 8.3 Invoice-To-Loan Conversion

1. A finance-ready invoice is selected.
2. The operator enters financing terms such as:
   - annual interest rate
   - term in months
   - loan start date
3. The system computes:
   - principal
   - installment amount
   - total interest
   - total repayable amount
   - amortization schedule
4. The system creates the micro-loan and links it back to the source invoice and customer.

### 8.4 Payment Posting

1. A finance user posts payment against the active loan account.
2. The system updates:
   - amortization schedule rows
   - outstanding balance
   - payment counts
   - ledger entries
3. Collections and balances can then be reviewed through:
   - loan accounts
   - collections workspace
   - customer finance view
   - ledger
   - audit

### 8.5 MLS Monitoring

Finance users can continue reviewing:

- finance-ready invoices
- active loan portfolio
- overdue collections
- payment history
- ledger trail
- audit events
- finance reports

## 9. Reporting Workflow

### 9.1 SMS Reporting

Tenant staff can review operational reporting for:

- customer growth
- intake volume
- assignment scheduling
- completion counts
- invoice finalization activity
- technician workload
- service-status distribution
- turnaround performance

### 9.2 MLS Reporting

Finance users can review financial reporting for:

- active loans
- outstanding balances
- collections in period
- payment counts
- overdue exposure
- borrower concentration
- ledger transaction mix

## 10. Current Deferred Workflow Areas

These are part of the broader product direction but are still incomplete or deferred:

- tenant-facing subscription billing workspace
- tenant renewal and payment-history workflow
- direct online customer invoice payment capture
- customer proof-of-payment submission surface
- guest or token-only tracking without customer login
- full role-permission matrix across admin, dispatcher, technician, and finance actions
- full MSME subscription-entitlement enforcement across all routes and backend actions

## 11. Condensed End-To-End Scenario

The system-wide business flow can be summarized as:

1. superadmin provisions and activates a tenant
2. tenant administrator signs in and sets up staff operations
3. customer registers under that tenant domain or is created by tenant staff
4. service request enters SMS from staff intake or customer self-service
5. tenant staff schedules and assigns the request
6. technician performs the work and submits evidence
7. tenant staff updates statuses and finalizes the invoice
8. customer tracks progress and reviews invoice state from the portal
9. tenant finance staff either confirms direct settlement or hands the invoice into MLS
10. MLS finance users convert to loan if needed, post payments, and maintain the ledger until fully settled

## 12. Operational Boundary Summary

- `Superadmin` owns platform and tenant governance
- `Tenant SMS` owns service operations
- `Customer Portal` owns customer self-service and visibility only
- `Tenant MLS` owns finance execution, loan conversion, payment posting, and ledger accountability

That separation is the core workflow boundary of ServiFinance as a whole.
