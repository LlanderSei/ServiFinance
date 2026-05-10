# ServiFinance Process Workflow

This document describes the current end-to-end workflow of ServiFinance across:

- root superadmin operations
- tenant SMS web operations
- tenant MLS desktop finance operations
- tenant-scoped customer portal activity
- Stripe-backed onboarding and subscription billing

## 1. System Overview

ServiFinance is a multi-tenant platform with four connected surfaces:

- `Root SaaS` for platform control and commercial governance
- `SMS Web` for service intake, dispatch, execution, costing, invoicing, and reporting
- `Customer Portal` for tenant-scoped self-service
- `MLS Desktop` for finance review, loan conversion, collections, ledger work, and audit review

The normal business flow is:

1. superadmin manages the platform catalog and tenant posture
2. a tenant is onboarded through Stripe-backed registration
3. tenant staff operate service workflows in SMS
4. customers interact through the tenant-scoped portal
5. finalized service invoices either settle directly or move into MLS finance handling

## 2. Main Actors

- `Superadmin`: manages the SaaS platform, tenants, subscription catalog, recovery posture, and root administration
- `Tenant Owner / Administrator`: manages tenant staff, service operations, pricing, billing, branding, and reporting
- `Dispatcher / Staff`: runs customer intake, service requests, dispatch scheduling, and service follow-up
- `Technician`: works assigned jobs, updates service status, and submits execution evidence
- `Customer`: registers inside a tenant domain, submits requests, tracks work, reviews invoices, pays or submits proof, and leaves feedback
- `Finance / Cashier / Loan Officer`: reviews settlement proofs, converts invoices to loans, posts payments, works collections, and maintains the ledger in MLS

## 3. Root Platform Workflow

### 3.1 Superadmin Access

1. The platform operator signs in through the root surface.
2. The superadmin opens root workspaces for:
   - dashboard
   - system health
   - tenants
   - subscription tiers
   - modules
   - audits
   - root users
   - roles and permissions

### 3.2 Tenant Onboarding

1. A new tenant is registered from `/register`.
2. The operator selects the commercial tier and edition from the active subscription catalog.
3. The root onboarding flow creates a Stripe subscription checkout session for that selected tier.
4. After Stripe confirms the checkout, the platform provisions:
   - tenant identity
   - domain slug
   - business size segment
   - edition and subscription plan
   - active Stripe billing linkage
   - the first tenant owner or administrator account

### 3.3 Platform Subscription Governance

1. Superadmin can review catalog tiers, module access, and tenant recovery posture.
2. Tenant subscription renewal is now Stripe-managed by default.
3. Manual tenant subscription renewal proof submission is discontinued.
4. Recovery actions now focus on:
   - Stripe sync
   - billing portal recovery
   - pending plan switch review
   - suspension review when renewal stays unresolved

## 4. Tenant Entry Workflow

### 4.1 Tenant Staff Entry

1. SMS staff sign in through the tenant web entry under `/t/{tenant}/sms/`.
2. MLS staff sign in through the desktop entry under `/t/mls/`.
3. The authenticated surface determines whether the user enters:
   - SMS web operations
   - MLS desktop finance operations

### 4.2 Customer Entry

1. Customers sign in or register under `/t/{tenant}/c/*`.
2. Customer identity remains isolated per tenant domain.
3. The customer shell does not expose tenant staff navigation or staff APIs.

## 5. Tenant SMS Workflow

### 5.1 Customer Records

1. Tenant staff create or update tenant-scoped customer records.
2. These records support:
   - service request linkage
   - dispatch
   - invoice linkage
   - finance handoff

### 5.2 Service Intake

Service requests can begin from:

- the tenant SMS workspace
- the tenant-scoped customer portal

The flow is:

1. the customer is selected or already known
2. the request captures item, issue, logistics, and scheduling preference details
3. the system assigns a request number and initial status
4. the request appears in the SMS request register

### 5.3 Dispatch

1. Dispatch-capable staff open the dispatch workspace.
2. A live service request is scheduled to a technician or staff owner.
3. The assignment records:
   - assigned staff
   - assigning user
   - schedule window
   - assignment status
4. The workspace tracks:
   - acceptance queue
   - assignment ledger
   - my tasks
   - timeline
   - archive
   - reassignment and conflict visibility

### 5.4 Service Execution

1. The technician accepts or starts assigned work.
2. The technician can pause, resume, complete, hand over, or abandon work based on permission and status.
3. The technician submits notes and hosted evidence attachments.
4. Assignment changes push service-state changes back into the linked request.

### 5.5 Costing And Invoice Finalization

1. Tenant staff maintain service costing with base charges, services, parts, tax options, and notes.
2. The costing sheet stays visible to the customer for transparency.
3. Once ready, the service request is finalized into an invoice.
4. The invoice then follows one of two paths:
   - direct settlement
   - MLS finance conversion review

## 6. Customer Portal Workflow

### 6.1 Customer Requests

1. The customer creates a service request from the portal.
2. The request enters the same tenant SMS pipeline used by internal staff.
3. Customers can track ongoing work and view completed or cancelled history separately.

### 6.2 Customer Tracking

1. The customer opens request details to see customer-safe operational history.
2. Notifications can reflect service movement from the tenant side.
3. After completion, the customer can leave a rating, suggestion category, and optional comment within the feedback window.

### 6.3 Customer Invoice And Settlement

1. Finalized invoices appear in the customer invoice workspace.
2. For eligible direct-settlement invoices, the customer can:
   - start hosted Stripe Checkout
   - submit manual payment proof for offline settlement review
3. The customer can also see:
   - settlement review outcomes
   - approved or rejected proof history
   - linked finance status
   - whether the invoice has already been converted into an MLS loan

## 7. Payment And Settlement Responsibility

ServiFinance separates visibility from authority.

### 7.1 Tenant Subscription Billing

- handled by Stripe-backed auto-renewal
- reviewed through the tenant billing workspace and hosted billing portal
- recovered through Stripe sync and payment-method update flows

### 7.2 Service Invoice Settlement

- customers can initiate hosted online checkout or submit manual payment proof
- tenant or MLS finance staff remain responsible for confirming or rejecting settlement outcomes
- customers never self-approve settlement or mutate ledger-side finance records directly

## 8. MLS Finance Workflow

### 8.1 Finance Intake

1. Finance staff open the MLS desktop workspace under `/t/mls/*`.
2. They review customer finance posture, finance-ready invoices, and direct settlement submissions.

### 8.2 Finance Decision

The operator decides whether to:

- keep the invoice on a direct-settlement path
- approve or reject a customer-submitted settlement proof
- convert the invoice into a micro-loan
- create a standalone loan outside the service workflow

### 8.3 Loan Conversion And Creation

1. A finance-ready invoice can be previewed for conversion.
2. A standalone borrower can also be originated directly.
3. The system computes:
   - principal
   - interest
   - installment amount
   - amortization schedule
   - total repayable amount
4. The resulting loan links back to the customer and, when relevant, the original service invoice.

### 8.4 Loan Servicing

1. Finance staff post payments and, where allowed, reverse entries.
2. The system updates:
   - amortization rows
   - outstanding balance
   - payment history
   - ledger transactions
3. Collections, reports, and audit views then reflect the updated posture.

## 9. Reporting Workflow

### 9.1 SMS Reporting

SMS reporting covers:

- intake movement
- technician workload
- assignment completion
- invoicing and finance handoff
- feedback and suggestion signals
- turnaround and operational comparisons

### 9.2 MLS Reporting

MLS reporting currently covers:

- active loans
- outstanding balances
- payment volume
- overdue exposure
- borrower concentration
- ledger and collections signals

This area exists today, but it is still a known depth gap compared with the richer SMS reporting surface.

## 10. Current Deferred Or Incomplete Areas

- deeper MLS reporting and comparison depth
- persisted maker-checker loan approval decisions
- Google auth, MFA, password recovery, and stronger lockout or throttling
- broader Stripe provider-event coverage and recovery hardening
- final cleanup of redundant page-level and route-level MLS guard duplication

## 11. Condensed End-To-End Scenario

1. superadmin maintains the commercial catalog and platform recovery posture
2. a tenant is onboarded through Stripe-backed registration
3. tenant staff operate service workflows in SMS
4. customer requests move through intake, dispatch, execution, and invoice finalization
5. the customer tracks work, pays online, or submits settlement proof when needed
6. tenant or MLS finance staff confirm direct settlement or move the invoice into MLS
7. MLS staff convert to loan when needed, post payments, work collections, and maintain the ledger until fully settled

## 12. Operational Boundary Summary

- `Root SaaS` owns platform governance and commercial catalog control
- `Tenant SMS` owns service operations
- `Customer Portal` owns customer self-service and transparency
- `Tenant MLS` owns finance execution, collections, ledger mutation, and loan accountability

That surface split remains the core workflow boundary of ServiFinance.
