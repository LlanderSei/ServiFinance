# ServiFinance Technical Design Document

## 1. Project Definition

### 1.1 Project Name

**ServiFinance**

### 1.2 Project Overview

ServiFinance is a unified platform for Philippine MSMEs that combines:

- A **SaaS Web-based Service Management System** for service intake, scheduling, job tracking, customer feedback, and reporting
- A **Desktop-based Financial and Micro-lending Terminal** for invoices, loan conversion, amortization, payment posting, and secure ledger tracking

The platform addresses a common business scenario in which a customer brings in a high-value item, such as a bakery oven or laptop, for repair. The service workflow begins in the web application. If the cost is too high for immediate payment, the desktop terminal converts the bill into a micro-loan with interest-bearing installments and a tenant-scoped transaction ledger.

### 1.3 Delivery Model

- **Backend**: ASP.NET Core 10 Web API / application services
- **Database**: SQL Server via Entity Framework Core
- **Shared UI Layer**: Razor Class Library using Tailwind CSS and DaisyUI
- **Web Delivery**: Blazor Web App
- **Desktop Delivery**: .NET MAUI Blazor Hybrid
- **Architecture Style**: Shared domain and application logic first, then channel-specific UI delivery

### 1.4 Core Architectural Goal

The system must satisfy both class requirements without duplicating core logic:

- The **web application** fulfills the SaaS Service Management requirement
- The **desktop application** fulfills the Financial / Transaction requirement
- Shared models, validation, tenancy rules, and financial logic must be implemented once and reused by both

### 1.5 MSME Tiering Direction

ServiFinance should use one shared product model across MSMEs instead of separate products for Micro, Small, and Medium enterprises.

Recommended product structure:

- `Standard` = web-based Service Management System
- `Premium` = `Standard` plus the desktop Financial and Micro-Lending Terminal
- `Micro` should receive a reduced module set
- `Small` should be the full operational baseline
- `Medium` should mostly reuse `Small` modules with stronger reporting and audit visibility

The detailed matrix is documented in:

- `Docs/msme-tiering-and-module-matrix.md`

## 2. Solution Architecture

### 2.1 Logical Components

The intended solution is composed of four logical layers:

- **Presentation Layer**
  - Blazor Web App for browser-based operations
  - .NET MAUI Blazor Hybrid desktop terminal for financial workflows
- **Shared UI Layer**
  - Razor Class Library containing reusable components, forms, layout elements, and design tokens
- **Application / Domain Layer**
  - Shared business rules for service requests, invoices, loans, amortization, payments, tenant security, and reporting
- **Infrastructure Layer**
  - Entity Framework Core data access
  - SQL Server persistence
  - Authentication, tenant resolution, and audit support

### 2.2 Channel Responsibilities

**Web Application**

- Accept service requests
- Manage schedules and technician assignments
- Track work status and service history
- Capture feedback
- Present operational reports

**Desktop Terminal**

- Review invoices generated from service work
- Convert invoices into micro-loans
- Generate amortization schedules
- Record payments and update the ledger
- Review loan balances and transaction history

**Shared Logic**

- Tenant-aware business validation
- Customer, request, invoice, and loan relationship rules
- Currency and rounding logic
- Ledger posting rules
- Role and permission checks

### 2.3 End-To-End Business Flow

1. A customer submits or is registered with a service request.
2. The request is assessed, scheduled, and assigned through the web portal.
3. The technician performs the work and the service status is updated.
4. The business generates an invoice after assessment or completion.
5. If the customer cannot pay in full, the desktop terminal converts the invoice into a micro-loan.
6. The system computes monthly installments with interest.
7. Payments are posted to the ledger and balances are updated until the obligation is settled.

## 3. Multi-Tenant Data Model

### 3.1 Tenant Rule

Every table except `Tenants` must include `TenantId` of type `Guid`.

This rule ensures:

- Every business record belongs to exactly one tenant
- Queries can be filtered automatically by tenant
- Cross-tenant record access is prevented at the data layer

### 3.2 Core Schema Principles

- Use normalized tables with clear foreign-key relationships
- Separate master records from transactional records
- Keep ledger and loan history append-oriented where possible
- Ensure financial records can always be traced back to the source tenant, customer, and invoice
- Preserve tenant ownership in all cross-module relationships

### 3.3 SaaS Core Tables

#### `Tenants`

- `Id`
- `Name`
- `Code`
- `BusinessSizeSegment`
- `SubscriptionEdition`
- `SubscriptionPlan`
- `SubscriptionStatus`
- `CreatedAtUtc`
- `IsActive`

This is the only table without `TenantId`.

Recommended supporting entitlement tables:

- `SubscriptionTiers`
- `ModuleCatalog`
- `TenantModuleEntitlements`

These support module gating by MSME segment and edition without hard-coding the full matrix into UI routing alone.

#### `Users`

- `Id`
- `TenantId`
- `Email`
- `PasswordHash`
- `FullName`
- `IsActive`
- `CreatedAtUtc`

Relationship:

- `Users` belongs to `Tenants`

#### `Roles`

- `Id`
- `TenantId`
- `Name`
- `Description`

Relationship:

- `Roles` belongs to `Tenants`

#### `UserRoles`

- `Id`
- `TenantId`
- `UserId`
- `RoleId`
- `AssignedAtUtc`

Relationships:

- `UserRoles` links `Users` and `Roles`
- `TenantId` must match the linked user and role tenant

### 3.4 Supporting Business Tables

#### `Customers`

- `Id`
- `TenantId`
- `CustomerCode`
- `FullName`
- `MobileNumber`
- `Email`
- `Address`
- `CreatedAtUtc`

Relationship:

- `Customers` belongs to `Tenants`

### 3.5 Service Module Tables

#### `ServiceRequests`

- `Id`
- `TenantId`
- `CustomerId`
- `RequestNumber`
- `ItemType`
- `ItemDescription`
- `IssueDescription`
- `RequestedServiceDate`
- `Priority`
- `CurrentStatus`
- `CreatedByUserId`
- `CreatedAtUtc`

Relationships:

- `ServiceRequests` belongs to `Customers`
- `ServiceRequests` belongs to `Users` through creator or staff reference

#### `StatusLogs`

- `Id`
- `TenantId`
- `ServiceRequestId`
- `Status`
- `Remarks`
- `ChangedByUserId`
- `ChangedAtUtc`

Relationship:

- One `ServiceRequest` has many `StatusLogs`

#### `Assignments`

- `Id`
- `TenantId`
- `ServiceRequestId`
- `AssignedUserId`
- `AssignedByUserId`
- `ScheduledStartUtc`
- `ScheduledEndUtc`
- `AssignmentStatus`
- `CreatedAtUtc`

Relationships:

- One `ServiceRequest` can have many `Assignments`
- Assigned and assigning users must belong to the same tenant

### 3.6 Financial Module Tables

#### `Invoices`

- `Id`
- `TenantId`
- `CustomerId`
- `ServiceRequestId`
- `InvoiceNumber`
- `InvoiceDateUtc`
- `SubtotalAmount`
- `InterestableAmount`
- `DiscountAmount`
- `TotalAmount`
- `OutstandingAmount`
- `InvoiceStatus`

Relationships:

- `Invoices` belongs to `Customers`
- `Invoices` optionally references `ServiceRequests`

#### `InvoiceLines`

- `Id`
- `TenantId`
- `InvoiceId`
- `Description`
- `Quantity`
- `UnitPrice`
- `LineTotal`

Relationship:

- One `Invoice` has many `InvoiceLines`

#### `MicroLoans`

- `Id`
- `TenantId`
- `InvoiceId`
- `CustomerId`
- `PrincipalAmount`
- `AnnualInterestRate`
- `TermMonths`
- `MonthlyInstallment`
- `TotalInterestAmount`
- `TotalRepayableAmount`
- `LoanStartDate`
- `MaturityDate`
- `LoanStatus`
- `CreatedByUserId`
- `CreatedAtUtc`

Relationships:

- One `Invoice` may produce zero or one `MicroLoan`
- `MicroLoans` belongs to `Customers`
- `MicroLoans` belongs to `Users` through creator

#### `AmortizationSchedules`

- `Id`
- `TenantId`
- `MicroLoanId`
- `InstallmentNumber`
- `DueDate`
- `BeginningBalance`
- `PrincipalPortion`
- `InterestPortion`
- `InstallmentAmount`
- `EndingBalance`
- `PaidAmount`
- `InstallmentStatus`

Relationship:

- One `MicroLoan` has many `AmortizationSchedules`

#### `Transactions`

- `Id`
- `TenantId`
- `CustomerId`
- `InvoiceId`
- `MicroLoanId`
- `AmortizationScheduleId`
- `TransactionDateUtc`
- `TransactionType`
- `ReferenceNumber`
- `DebitAmount`
- `CreditAmount`
- `RunningBalance`
- `Remarks`
- `CreatedByUserId`

Relationships:

- `Transactions` belongs to `Customers`
- `Transactions` may reference `Invoices`
- `Transactions` may reference `MicroLoans`
- `Transactions` may reference `AmortizationSchedules`

### 3.7 Relationship Summary

- Tenant -> Users
- Tenant -> Roles
- Tenant -> Customers
- Customer -> ServiceRequests
- ServiceRequest -> StatusLogs
- ServiceRequest -> Assignments
- ServiceRequest -> Invoice
- Invoice -> InvoiceLines
- Invoice -> optional MicroLoan
- MicroLoan -> AmortizationSchedules
- Invoice and MicroLoan -> Transactions ledger

### 3.8 Normalization Notes

- Role membership is split into `Roles` and `UserRoles` to avoid repeating role data on user records
- Invoice header and invoice detail are split into `Invoices` and `InvoiceLines`
- Loan schedule rows are split from the loan master to preserve payment history by installment
- Status history is kept in `StatusLogs` rather than overwriting only the latest value
- Ledger records are stored separately in `Transactions` so financial posting history remains auditable

## 4. Financial Logic Design

### 4.1 `LoanService` Responsibility

`LoanService` should centralize the shared financial logic used by both the web and desktop channels for:

- Loan eligibility based on invoice balance
- Monthly installment calculation
- Amortization schedule generation
- Posting payment effects to installments and ledger records
- Balance recomputation after each transaction

### 4.2 Why `decimal` Must Be Used

All Philippine Peso calculations must use `decimal`, not `double`.

Use `decimal` because:

- `decimal` is designed for base-10 arithmetic and preserves financial precision more reliably
- `double` uses binary floating-point representation, which can introduce tiny rounding errors
- Repeated interest and installment calculations using `double` can create centavo mismatches in totals and balances
- Loan, invoice, and ledger values must reconcile exactly in accounting-style scenarios

`decimal` should be used for:

- principal amount
- invoice totals
- interest amounts
- installment values
- paid amounts
- balances
- debit and credit ledger values

### 4.3 Default Loan Computation Model

The default model for ServiFinance is **fixed amortized monthly installments**.

This means:

- A financed invoice balance becomes the loan principal
- A monthly interest rate is derived from the annual rate
- A fixed installment amount is computed for the chosen term
- Each installment splits into principal and interest portions
- The interest portion gradually decreases while the principal portion increases over time

### 4.4 Calculation Flow

The intended logic flow is:

1. Read the invoice outstanding amount as the loan principal
2. Read the annual interest rate and term in months
3. Convert annual rate to monthly rate
4. Compute the fixed monthly installment
5. Generate each amortization row with:
   - beginning balance
   - interest portion
   - principal portion
   - ending balance
6. Round each monetary value to 2 decimal places
7. Adjust the final installment to absorb any residual centavo difference caused by rounding
8. Persist the `MicroLoan`, `AmortizationSchedules`, and opening `Transactions` records
9. On payment, apply the amount to the next unpaid installment or according to payment rules
10. Update paid amounts, installment status, remaining balance, and ledger entries

### 4.5 Rounding Rules

To keep Philippine Peso values consistent:

- Round all persisted money values to **2 decimal places**
- Use one consistent rounding policy across the system
- Avoid recomputing historical posted amounts from raw formulas after posting
- If installment rounding leaves a small centavo difference, apply that difference to the **final installment**
- The sum of amortization installments must equal the total repayable amount exactly

### 4.6 Ledger Posting Expectations

Each financial event should create traceable transaction records, such as:

- invoice issuance
- loan creation
- payment received
- balance adjustment if allowed by business rules

The ledger must always answer:

- how much the customer owes
- how much has been paid
- what balance remains
- which invoice or loan the transaction belongs to

## 5. SaaS Security Model

### 5.1 Security Objective

Tenant A must never be able to read or modify Tenant B's service or financial records accidentally or through normal application flow.

### 5.2 Tenant Resolution

The application should resolve the current tenant from a trusted request or session context, such as:

- authenticated user claims
- tenant subdomain or route strategy
- secure desktop login context for the terminal

This value should be exposed through a tenant provider abstraction used by application services and the EF Core DbContext.

### 5.3 Tenant-Scoped Entity Pattern

All tenant-owned entities should implement a shared interface or inherit from a shared base type, for example:

- `ITenantEntity`
- shared `TenantId` property

This allows the data layer to treat tenant-owned records consistently.

### 5.4 Global Query Filters In EF Core

Entity Framework Core global query filters should be applied to every tenant-owned entity.

Conceptually, the DbContext should:

- receive the current `TenantId`
- configure `HasQueryFilter` for each tenant-owned table
- automatically restrict queries to records whose `TenantId` matches the current tenant

This ensures normal queries for:

- `ServiceRequests`
- `Invoices`
- `MicroLoans`
- `Transactions`
- and other tenant-owned records

are automatically limited to the current tenant without requiring every developer to remember manual `where` clauses.

### 5.5 Write-Time Protection

Read filters alone are not enough. The save pipeline should also:

- stamp `TenantId` on new records
- reject inserts or updates whose `TenantId` does not match the active tenant
- validate that referenced foreign-key records belong to the same tenant

This prevents cross-tenant data pollution through programming mistakes.

### 5.6 Shared Enforcement Across Web And Desktop

Although the delivery channels differ, both must use the same tenant-aware application and data rules:

- the web application must enforce tenant filters for service-side records
- the desktop terminal must enforce the same rules for invoices, loans, and ledger transactions
- shared business services must assume tenant scoping is mandatory, not optional

### 5.7 Subscription Tier And Module Enforcement

Tenant isolation is not enough by itself. The system must also enforce which modules a tenant is allowed to access.

Recommended enforcement model:

- determine entitlement from `BusinessSizeSegment + SubscriptionEdition`
- expose effective module access through a shared resolver
- enforce module access in both UI navigation and backend endpoints
- treat any per-tenant override as an exception handled by superadmin controls

This keeps module access consistent between the SaaS web channel and the desktop finance terminal.

## 6. Implementation Phases

The roadmap assumes one solo developer building the system across a semester. Shared logic is intentionally built first to prevent duplicate validation, schema, and financial rules.

### Phase 1: Shared Foundation And Tenant Core

Goals:

- Define the shared domain model
- Establish the SQL Server schema and EF Core mappings
- Build tenant resolution and tenant-aware base entities
- Create shared DTOs, validation rules, and common services

Primary outputs:

- initial database design
- tenancy model
- authentication and role structure
- shared customer, invoice, and service entities

### Phase 2: Service Management Web MVP

Goals:

- Build web workflows for service request intake
- Add status tracking and technician assignments
- Provide the first usable operational interface for the service module

Primary outputs:

- service request creation
- status log updates
- assignment scheduling
- basic dashboard views for service operations

### Phase 3: Financial Core And Loan Engine

Goals:

- Implement invoice generation and invoice line support
- Build the shared `LoanService`
- Generate amortization schedules and financial totals
- Add ledger transaction posting rules

Primary outputs:

- invoice lifecycle
- loan conversion logic
- amortization generation
- transaction ledger foundation

### Phase 4: Desktop Financial Terminal

Goals:

- Build the .NET MAUI Blazor Hybrid terminal
- Surface invoice lookup, loan conversion, payment posting, and loan balance review
- Reuse the shared business logic without forking it into a desktop-only code path

Primary outputs:

- desktop loan processing screens
- payment entry flow
- customer financial account view

### Phase 5: Reporting, Hardening, And Semester Completion

Goals:

- Add reporting for service and financial modules
- Finalize feedback capture and operational summaries
- Strengthen auditability, validation, and tenant-isolation checks
- Prepare the system for demo, documentation, and final submission

Primary outputs:

- service reporting
- loan and payment summaries
- customer feedback support
- audit and verification readiness

## 7. Suggested Validation And Testing Focus

The implementation should later be validated with scenarios such as:

- Tenant A cannot query or update Tenant B service requests
- Tenant A cannot see Tenant B invoices, loans, or transactions
- A service request can progress from intake to assignment to invoice generation
- A single invoice can be converted into one micro-loan
- The amortization schedule totals exactly match the total repayable amount
- Rounding differences are absorbed by the last installment only
- Payment posting reduces outstanding balances correctly
- Ledger transactions remain traceable to customer, invoice, and loan records

## 8. Final Notes

- This document is a Technical Design Document, not a full implementation guide or code listing.
- The system is intentionally structured so the shared domain and financial logic are built first and reused by both delivery channels.
- The desktop terminal is assumed to be **online-only** and connected to the same central backend and database as the web application.
- The target financial context is **Philippine Peso**, with all monetary values handled using `decimal` and stored with consistent 2-decimal precision.
