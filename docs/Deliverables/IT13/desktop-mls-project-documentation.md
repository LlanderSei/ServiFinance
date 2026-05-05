# ServiFinance Desktop MLS Project Documentation

## 1. Cover Page

| Item | Details |
|---|---|
| Project Title | ServiFinance Desktop Micro-Lending System |
| System Short Name | Desktop MLS |
| Parent System | ServiFinance |
| Project Type | Desktop financial and micro-lending application for tenant finance users |
| Platform | .NET MAUI desktop host, React frontend, ASP.NET Core API, SQL Server database |
| Prepared For | IT13 System Documentation |
| Prepared By | [Student Name] |
| Date | May 5, 2026 |

## 2. Business Case

### 2.1 Background

ServiFinance is a multi-tenant service management and finance platform. Its web side, called SMS, handles tenant service operations such as customer records, service requests, dispatch, technician work, status tracking, invoicing, and reports. Its desktop side, called MLS, handles finance workflows that should be separated from normal service operations, including invoice-to-loan conversion, standalone loan processing, amortization, payment posting, collections, ledger review, audit review, and financial reporting.

### 2.2 Problem Statement

Small and medium service businesses often manage customer service records, invoices, and lending activities separately. This creates duplicate records, inconsistent balances, weak payment tracking, and limited audit visibility. When a service invoice needs to become a financed account, staff may manually compute loan terms and payment schedules, which increases the risk of calculation errors and poor accountability.

### 2.3 Proposed Solution

The ServiFinance Desktop MLS provides a dedicated desktop terminal for finance staff, cashiers, loan officers, owners, and administrators. It receives finance-ready invoices from the SMS workflow, converts eligible invoices into micro-loans, supports standalone loan creation, generates amortization schedules, posts loan payments, tracks collections, records ledger entries, and exposes audit and report views. The desktop app uses the same tenant database and backend services as the web app, but it has a separate MLS workspace and desktop-only route surface.

### 2.4 Objectives

- Provide a secure desktop entry point for tenant finance users.
- Convert finalized SMS invoices into micro-loan accounts.
- Support standalone loan creation when the loan does not originate from a service invoice.
- Calculate amortization schedules based on principal, interest rate, term, and start date.
- Post loan payments and update installment status, running balance, and ledger records.
- Provide customer financial records that combine loans and payment history.
- Provide collections, reports, ledger, audit, role, and platform-user administration views.
- Keep SMS service operations and MLS finance operations separated by surface and role scope.

### 2.5 Scope

The Desktop MLS scope includes:

- MLS desktop login
- MLS dashboard
- customer financial records
- invoice-to-loan conversion
- standalone loan processing
- loan accounts and payment posting
- collections queue
- reports
- ledger review
- audit review
- platform users
- roles and permissions

The current desktop MLS is focused on tenant finance operations. Superadmin desktop mode, multi-tenant employee switching, deeper export formats, and more advanced correction workflows can be treated as future enhancements unless required for final submission.

### 2.6 Stakeholders

| Stakeholder | Interest In The System |
|---|---|
| Tenant Owner / Administrator | Controls tenant users, roles, reports, and finance oversight. |
| Finance Staff / Loan Officer | Converts invoices into loans, creates standalone loans, reviews accounts, and monitors balances. |
| Cashier | Posts payments and checks collections or ledger entries. |
| SMS Staff / Dispatcher / Technician | Produces the service and invoice records that may become finance-ready. |
| Customer | Receives service, invoice, and loan/account settlement visibility through customer-facing records. |
| Superadmin | Governs the platform, tenant subscriptions, modules, and root-level administration. |

### 2.7 Business Benefits

- Reduces duplicate encoding between service operations and finance records.
- Improves traceability from service request to invoice to loan account.
- Helps finance staff compute installment schedules consistently.
- Provides a dedicated ledger trail for loan creation, payment posting, and reversals.
- Separates desktop finance functions from web-based service operations.
- Supports premium tenant value through desktop finance modules.
- Improves auditability for sensitive financial actions.

### 2.8 Risks And Controls

| Risk | Control |
|---|---|
| Incorrect money computation | Use backend-controlled amortization, payment posting, and ledger update rules. |
| Unauthorized MLS access | Use desktop-only routing, authenticated sessions, role checks, and tenant scope validation. |
| Duplicate payment posting | Validate action state and record ledger transactions with references. |
| Weak traceability | Store finance actions in ledger transactions and audit events. |
| Tenant data leakage | Keep tenant-owned records linked by `TenantId` and protect APIs by tenant context. |
| Desktop/backend startup failure | Desktop host bootstraps and waits for the owned backend before using API-backed screens. |

## 3. Entity-Relationship Diagram

The full ERD source is maintained in `docs/Data Dict & ERD/servifinance-erd.sql`. The MLS-focused relationship can be represented textually as follows for diagram conversion:

```text
Tenants -> Users | Roles | Customers | Invoices | MicroLoans | AmortizationSchedules | Transactions | AuditEvents
Users -> UserRoles -> Roles
Customers -> ServiceRequests -> Invoices -> InvoiceLines
Customers -> MicroLoans
Customers -> Transactions
Invoices -> MicroLoans
Invoices -> Transactions
MicroLoans -> AmortizationSchedules
MicroLoans -> Transactions
AmortizationSchedules -> Transactions
Users -> MicroLoans
Users -> Transactions
Users -> AuditEvents
SubscriptionTiers -> SubscriptionTierModules -> ModuleCatalog
Tenants -> TenantThemes | TenantBillingRecords | AuditEvents
```

### 3.1 MLS Core ERD View

```text
Tenant
  -> Customer
  -> Invoice
  -> MicroLoan
  -> AmortizationSchedule
  -> LedgerTransaction
  -> AuditEvent

Customer
  -> Invoice
  -> MicroLoan
  -> LedgerTransaction

Invoice
  -> InvoiceLine
  -> MicroLoan
  -> LedgerTransaction

MicroLoan
  -> AmortizationSchedule
  -> LedgerTransaction

AmortizationSchedule
  -> LedgerTransaction

User
  -> MicroLoan.CreatedByUserId
  -> LedgerTransaction.CreatedByUserId
  -> AuditEvent.ActorUserId
```

### 3.2 Important Relationship Notes

- A tenant owns the operational and finance records through `TenantId`.
- A customer can have many invoices, loans, and ledger transactions.
- A service invoice can optionally become one micro-loan.
- A micro-loan has many amortization schedule rows.
- A payment or reversal is recorded as a ledger transaction.
- Audit events record sensitive platform, SMS, and MLS actions by scope and category.

## 4. Data Dictionary

The complete data dictionary is maintained in `docs/Data Dict & ERD/data-dictionary.md`. The following table summarizes the MLS-related tables and fields needed for the desktop finance documentation.

### 4.1 Tenants

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the tenant. |
| BusinessName | nvarchar | 200 | Tenant business name. |
| DomainSlug | nvarchar | 100 | Tenant route/domain identifier. |
| SubscriptionTierId | uniqueidentifier | 36 | Selected subscription tier. |
| IsActive | bit | 1 | Indicates whether the tenant is active. |
| CreatedAtUtc | datetime2 | - | Date and time when the tenant was created. |

### 4.2 Users

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the user. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the user, when tenant-scoped. |
| FullName | nvarchar | 200 | User full name. |
| Email | nvarchar | 50 | User email address used for login. |
| PasswordHash | nvarchar | 512 | Hashed password value. |
| IsActive | bit | 1 | Indicates whether the account can sign in. |
| CreatedAtUtc | datetime2 | - | Date and time when the user was created. |

### 4.3 Roles

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the role. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the role, when tenant-scoped. |
| Name | nvarchar | 100 | Role name such as Owner, Administrator, SMS Staff, MLS Staff, or MLS Cashier. |
| PlatformScope | nvarchar | 30 | Role scope such as Root, OwnerAdmin, SMS, or MLS. |
| Rank | int | 10 | Role rank used for ordering and governance. |
| IsSystemRole | bit | 1 | Indicates whether the role is system-defined. |

### 4.4 UserRoles

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| UserId | uniqueidentifier | 36 | Foreign key to `Users.Id`. |
| RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id`. |

### 4.5 Customers

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the customer. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the customer. |
| CustomerCode | nvarchar | 50 | Unique customer code within the tenant. |
| FullName | nvarchar | 200 | Customer full name. |
| MobileNumber | nvarchar | 50 | Customer contact number. |
| Email | nvarchar | 50 | Customer email address. |
| Address | nvarchar | 500 | Customer address. |
| CreatedAtUtc | datetime2 | - | Date and time when the customer was created. |

### 4.6 Invoices

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the invoice. |
| CustomerId | uniqueidentifier | 36 | Linked customer. |
| ServiceRequestId | uniqueidentifier | 36 | Optional source service request. |
| InvoiceNumber | nvarchar | 50 | Unique invoice number within the tenant. |
| InvoiceDateUtc | datetime2 | - | Invoice issue date. |
| SubtotalAmount | decimal | 12,2 | Total before discounts. |
| InterestableAmount | decimal | 12,2 | Amount eligible for financing. |
| DiscountAmount | decimal | 12,2 | Discount applied to the invoice. |
| TotalAmount | decimal | 12,2 | Final invoice total. |
| OutstandingAmount | decimal | 12,2 | Remaining unpaid balance. |
| InvoiceStatus | nvarchar | 50 | Current invoice status. |

### 4.7 InvoiceLines

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the invoice line. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the invoice line. |
| InvoiceId | uniqueidentifier | 36 | Linked invoice. |
| Description | nvarchar | 500 | Billed item or service description. |
| Quantity | decimal | 10,2 | Quantity billed. |
| UnitPrice | decimal | 12,2 | Unit price. |
| LineTotal | decimal | 12,2 | Line total. |

### 4.8 MicroLoans

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the micro-loan. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the loan. |
| InvoiceId | uniqueidentifier | 36 | Optional source invoice. |
| CustomerId | uniqueidentifier | 36 | Linked customer. |
| PrincipalAmount | decimal | 12,2 | Principal loan amount. |
| AnnualInterestRate | decimal | 6,2 | Annual interest rate. |
| TermMonths | int | 10 | Repayment term in months. |
| MonthlyInstallment | decimal | 12,2 | Monthly installment amount. |
| TotalInterestAmount | decimal | 12,2 | Total interest for the loan. |
| TotalRepayableAmount | decimal | 12,2 | Principal plus total interest. |
| LoanStartDate | datetime2 | - | Loan start date. |
| MaturityDate | datetime2 | - | Final due date. |
| LoanStatus | nvarchar | 50 | Current loan status. |
| CreatedByUserId | uniqueidentifier | 36 | User who created the loan. |
| CreatedAtUtc | datetime2 | - | Date and time when the loan was created. |

### 4.9 AmortizationSchedules

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the schedule row. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the schedule row. |
| MicroLoanId | uniqueidentifier | 36 | Linked micro-loan. |
| InstallmentNumber | int | 10 | Sequence number of the installment. |
| DueDate | datetime2 | - | Installment due date. |
| BeginningBalance | decimal | 12,2 | Balance before the installment. |
| PrincipalPortion | decimal | 12,2 | Principal part of the installment. |
| InterestPortion | decimal | 12,2 | Interest part of the installment. |
| InstallmentAmount | decimal | 12,2 | Total installment amount. |
| EndingBalance | decimal | 12,2 | Balance after the installment. |
| PaidAmount | decimal | 12,2 | Amount already paid. |
| InstallmentStatus | nvarchar | 50 | Status such as Unpaid, Partial, or Paid. |

### 4.10 Transactions

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the ledger transaction. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the transaction. |
| CustomerId | uniqueidentifier | 36 | Linked customer. |
| InvoiceId | uniqueidentifier | 36 | Optional linked invoice. |
| MicroLoanId | uniqueidentifier | 36 | Optional linked micro-loan. |
| AmortizationScheduleId | uniqueidentifier | 36 | Optional linked amortization row. |
| ReversalOfTransactionId | uniqueidentifier | 36 | Optional original transaction when this row is a reversal. |
| TransactionDateUtc | datetime2 | - | Date and time of the transaction. |
| TransactionType | nvarchar | 50 | Type such as Loan, LoanPayment, or LoanPaymentReversal. |
| ReferenceNumber | nvarchar | 100 | Receipt or ledger reference number. |
| DebitAmount | decimal | 12,2 | Debit amount. |
| CreditAmount | decimal | 12,2 | Credit amount. |
| RunningBalance | decimal | 12,2 | Balance after posting. |
| Remarks | nvarchar | 1000 | Transaction notes. |
| CreatedByUserId | uniqueidentifier | 36 | User who posted the transaction. |

### 4.11 AuditEvents

| Field | Data Type | Length / Precision | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 36 | Primary key of the audit event. |
| TenantId | uniqueidentifier | 36 | Tenant that owns the audit event. |
| Scope | nvarchar | 50 | Workspace scope such as Platform, SMS, or MLS. |
| Category | nvarchar | 50 | Audit category such as System or Security. |
| ActionType | nvarchar | 100 | Action name being audited. |
| Outcome | nvarchar | 50 | Result of the action. |
| ActorUserId | uniqueidentifier | 36 | Optional user who performed the action. |
| ActorName | nvarchar | 200 | Actor display name. |
| ActorEmail | nvarchar | 50 | Actor email address. |
| SubjectType | nvarchar | 100 | Type of record affected. |
| SubjectId | uniqueidentifier | 36 | Optional affected record ID. |
| SubjectLabel | nvarchar | 300 | Human-readable affected record label. |
| Detail | nvarchar | 1000 | Audit event detail. |
| IpAddress | nvarchar | 80 | Source IP address when available. |
| UserAgent | nvarchar | 500 | Client user agent when available. |
| OccurredAtUtc | datetime2 | - | Date and time when the event occurred. |

## 5. Module Diagram

### 5.1 Desktop MLS Module Diagram

```text
ServiFinance Desktop MLS
  -> Desktop Shell And API Bootstrap
  -> Authentication And Tenant Context
  -> MLS Dashboard
  -> Customer Financial Records
  -> Loan Conversion
  -> Standalone Loans
  -> Loan Accounts
  -> Collections
  -> Reports
  -> Ledger
  -> Administration
    -> Platform Users
    -> Roles And Permissions
    -> Audits
```

### 5.2 Module Responsibilities

| Module | Main Responsibility |
|---|---|
| Desktop Shell And API Bootstrap | Starts the desktop experience and connects the MAUI host to the backend API. |
| Authentication And Tenant Context | Signs in tenant users and stores desktop session context. |
| MLS Dashboard | Shows finance overview, portfolio status, and important MLS metrics. |
| Customer Financial Records | Shows customer-level loans, balances, and ledger history. |
| Loan Conversion | Converts finance-ready service invoices into micro-loans. |
| Standalone Loans | Creates loans that do not originate from service invoices. |
| Loan Accounts | Reviews loan schedules, balances, payments, and reversible payment activity. |
| Collections | Shows due, overdue, and partially paid accounts for follow-up. |
| Reports | Shows finance and ledger reporting summaries. |
| Ledger | Shows transaction entries, balances, payment records, and finance trail. |
| Platform Users | Manages tenant users and assigns SMS/MLS platform roles. |
| Roles And Permissions | Manages available role behavior and permission matrix by platform scope. |
| Audits | Reviews MLS-related system and security events. |

## 6. Process Flow Diagram

### 6.1 Desktop Access Flow

```text
Open ServiFinance Desktop App
  -> Start MAUI Hybrid Host
  -> Bootstrap Or Connect To Backend API
  -> Open MLS Desktop Login
  -> Enter Tenant User Credentials
  -> Validate User, Tenant, Role, And Surface
  -> Store Desktop Session
  -> Load MLS Dashboard
```

### 6.2 SMS Invoice To MLS Loan Flow

```text
Customer Service Request
  -> SMS Work Assignment And Completion
  -> SMS Invoice Finalization
  -> Invoice Marked Finance-Ready
  -> Desktop MLS Loan Conversion
  -> Select Eligible Invoice
  -> Enter Loan Terms
  -> Preview Amortization
  -> Create MicroLoan
  -> Generate AmortizationSchedules
  -> Create LedgerTransaction
  -> Write AuditEvent
  -> Loan Appears In Loan Accounts, Collections, Reports, And Ledger
```

### 6.3 Standalone Loan Flow

```text
Open Standalone Loans
  -> Select Customer
  -> Enter Principal, Interest Rate, Term, And Start Date
  -> Preview Amortization
  -> Validate Loan Terms
  -> Create MicroLoan Without Source Invoice
  -> Generate AmortizationSchedules
  -> Create Opening LedgerTransaction
  -> Write AuditEvent
```

### 6.4 Payment Posting Flow

```text
Open Loan Accounts Or Collections
  -> Select Active Loan
  -> Review Schedule And Outstanding Balance
  -> Enter Payment Amount, Reference, And Remarks
  -> Validate Payment
  -> Allocate Payment To Schedule Rows
  -> Update Paid Amounts And Installment Statuses
  -> Create LedgerTransaction
  -> Recompute Running Balance
  -> Write AuditEvent
  -> Refresh Loan, Collections, Reports, Ledger, And Customer Financial Record
```

### 6.5 Payment Reversal Flow

```text
Open Loan Account
  -> Select Latest Reversible Payment
  -> Enter Reversal Remarks
  -> Validate Reversal Is Allowed
  -> Create Reversal LedgerTransaction
  -> Restore Schedule And Balance Effects
  -> Write AuditEvent
  -> Refresh Loan, Ledger, And Reports
```

### 6.6 Reporting And Monitoring Flow

```text
MicroLoans + AmortizationSchedules + Transactions + AuditEvents
  -> Dashboard Metrics
  -> Collections Queue
  -> Reports
  -> Ledger Review
  -> Audit Review
  -> Management Decision And Follow-Up
```

## 7. Screenshots Of User Interface Design

UI screenshots will be inserted after the final screenshot set is provided. The table below lists the recommended screenshots and the screen purpose so the final documentation can be completed consistently.

| Screenshot No. | Screen | Route / Surface | Description |
|---:|---|---|---|
| 1 | MLS Desktop Login | `/t/mls` | Shows tenant finance user sign-in for the desktop app. |
| 2 | MLS Dashboard | `/t/mls/dashboard` | Shows portfolio summary, finance metrics, and quick status indicators. |
| 3 | Customer Financial Records | `/t/mls/customers` | Shows customer records with linked loan and ledger information. |
| 4 | Loan Conversion | `/t/mls/loan-conversion` | Shows finance-ready invoice selection and loan term entry. |
| 5 | Standalone Loans | `/t/mls/standalone-loans` | Shows loan creation without a source service invoice. |
| 6 | Loan Accounts | `/t/mls/loans` | Shows active loans, schedules, payment posting, and reversal controls. |
| 7 | Collections | `/t/mls/collections` | Shows overdue, due, and partially paid accounts. |
| 8 | Reports | `/t/mls/reports` | Shows financial report summaries and trends. |
| 9 | Ledger | `/t/mls/ledger` | Shows transaction history, running balances, and filters. |
| 10 | Platform Users | `/t/mls/users` | Shows tenant user list and platform role assignment. |
| 11 | Roles And Permissions | `/t/mls/roles-permissions` | Shows MLS role and permission management. |
| 12 | Audits | `/t/mls/audit` | Shows MLS audit events and security/system activity. |

### 7.1 Screenshot Placeholder Format

Use the following format when adding the final images:

```markdown
### Screenshot 1: MLS Desktop Login

![MLS Desktop Login](relative/path/to/screenshot.png)

Caption: The login screen authenticates tenant finance users before allowing access to the desktop MLS workspace.
```

## 8. Source Basis

This documentation was prepared from the current ServiFinance codebase and documentation, especially:

- `docs/Deliverables/IT13/desktop-application-mls-development-model.md`
- `docs/System/mls-desktop-plan.md`
- `docs/System/servifinance-process-workflow.md`
- `docs/System/msme-tiering-and-module-matrix.md`
- `docs/Data Dict & ERD/data-dictionary.md`
- `docs/Data Dict & ERD/servifinance-erd.sql`
- `src/desktop/ServiFinance.Desktop`
- `src/frontend/ServiFinance.Frontend/src/app/router.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/auth/shell/navigation.ts`
- `src/backend/ServiFinance.Domain/Entities.cs`
