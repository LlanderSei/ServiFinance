# ServiFinance Data Dictionary

Last updated: 2026-05-01

## Scope

- This dictionary is based on the current EF Core schema in `src/backend/ServiFinance.Domain/Entities.cs` and `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext.cs`.
- It also includes clearly marked future tables inferred from the existing docs under `docs/`, especially `service-management-system-outline.md`, `msme-tiering-and-module-matrix.md`, and `root-saas-auth-split-status.md`.
- `Length` shows the configured database length or precision where available.
- `uniqueidentifier` fields are stored as GUID values.
- `datetime2`, `bit`, `int`, and `decimal` fields do not use character length, so the precision or `-` is shown instead.

## Level 1 - Super Admin

Tables primarily handled by this user:

- `Tenants`
- `SubscriptionTiers`
- `ModuleCatalog`
- `SubscriptionTierModules`
- `Users` (platform superadmin accounts)
- `Roles` (platform roles)
- `UserRoles` (platform role assignments)
- `RefreshSessions`
- `TenantModuleEntitlements` (future addition)
- `AuditLogs` (future addition)

### [Tenants] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant record
Name | nvarchar | 200 | Tenant or business display name
Code | nvarchar | 50 | Unique business code used by the platform
DomainSlug | nvarchar | 100 | Unique route slug used for tenant URLs
BusinessSizeSegment | nvarchar | 50 | MSME size segment such as Micro, Small, or Medium
SubscriptionEdition | nvarchar | 50 | Product edition such as Standard or Premium
SubscriptionPlan | nvarchar | 100 | Commercial plan label for the tenant
SubscriptionStatus | nvarchar | 100 | Current subscription lifecycle state
DisplayName | nvarchar | 200 | Optional public-facing tenant name used in branded screens
LogoUrl | nvarchar | 500 | Optional logo path or URL for tenant branding
PrimaryColor | nvarchar | 20 | Optional primary brand color value
SecondaryColor | nvarchar | 20 | Optional secondary brand color value
HeaderBackgroundColor | nvarchar | 20 | Optional header background color value
PageBackgroundColor | nvarchar | 20 | Optional page background color value
CreatedAtUtc | datetime2 | - | UTC date and time when the tenant was created
IsActive | bit | 1 | Active or inactive status of the tenant
```
### [SubscriptionTiers] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the subscription tier
Code | nvarchar | 50 | Unique catalog code of the tier
DisplayName | nvarchar | 100 | User-facing name of the tier
BusinessSizeSegment | nvarchar | 50 | MSME segment covered by the tier
SubscriptionEdition | nvarchar | 50 | Edition covered by the tier
AudienceSummary | nvarchar | 200 | Short target audience summary
Description | nvarchar | 1000 | Full description of the tier
PriceDisplay | nvarchar | 100 | Price label shown in the UI
BillingLabel | nvarchar | 100 | Billing period or billing note
PlanSummary | nvarchar | 300 | Short summary of plan inclusions
HighlightLabel | nvarchar | 100 | Badge or marketing highlight label
SortOrder | int | 10 | Display order in the catalog
IncludesServiceManagementWeb | bit | 1 | Indicates if the web service module is included
IncludesMicroLendingDesktop | bit | 1 | Indicates if the desktop lending module is included
IsActive | bit | 1 | Active or inactive catalog state
```
### [ModuleCatalog] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the module catalog row
Code | nvarchar | 50 | Unique module code such as W1 or D1
Name | nvarchar | 150 | Module name shown to operators
Channel | nvarchar | 50 | Delivery channel such as Web or Desktop
Summary | nvarchar | 300 | Short purpose statement of the module
SortOrder | int | 10 | Display order in the module catalog
IsActive | bit | 1 | Active or inactive catalog state
```
### [SubscriptionTierModules] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tier-module mapping
SubscriptionTierId | uniqueidentifier | 36 | Foreign key to `SubscriptionTiers.Id`
PlatformModuleId | uniqueidentifier | 36 | Foreign key to `ModuleCatalog.Id`
AccessLevel | nvarchar | 30 | Access rule such as Included, Limited, or Not Included
SortOrder | int | 10 | Display order within the tier mapping
```
### [Users] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the user account
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`; platform superadmins use the reserved platform tenant
Email | nvarchar | 50 | Login email address of the user
PasswordHash | nvarchar | 512 | Hashed password value
FullName | nvarchar | 200 | Full name of the user
IsActive | bit | 1 | Active or inactive status of the account
CreatedAtUtc | datetime2 | - | UTC date and time when the account was created
```
### [Roles] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the role
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Name | nvarchar | 100 | Role name such as SuperAdmin, Administrator, or Staff
Description | nvarchar | 256 | Short description of the role purpose
```
### [UserRoles] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the role assignment
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
UserId | uniqueidentifier | 36 | Foreign key to `Users.Id`
RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id`
AssignedAtUtc | datetime2 | - | UTC date and time when the role was assigned
```
### [RefreshSessions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the refresh session
UserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id`
CustomerId | uniqueidentifier | 36 | Optional foreign key to `Customers.Id`
Surface | nvarchar | 50 | Client surface such as web or desktop
RememberMe | bit | 1 | Indicates whether a persistent session was requested
RefreshTokenHash | nvarchar | 128 | Unique hash of the refresh token
ExpiresAtUtc | datetime2 | - | UTC date and time when the refresh session expires
CreatedAtUtc | datetime2 | - | UTC date and time when the session was issued
LastRotatedAtUtc | datetime2 | - | UTC date and time when the refresh token was last rotated
```
### [TenantModuleEntitlements] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant-specific module entitlement
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
PlatformModuleId | uniqueidentifier | 36 | Foreign key to `ModuleCatalog.Id`
AccessLevel | nvarchar | 30 | Effective access level for the tenant
Source | nvarchar | 30 | Entitlement source such as tier-default, override, or promo
EffectiveFromUtc | datetime2 | - | Optional start date of the entitlement
EffectiveToUtc | datetime2 | - | Optional end date of the entitlement
IsActive | bit | 1 | Indicates whether the entitlement is currently active
CreatedAtUtc | datetime2 | - | UTC date and time when the entitlement was recorded
```
### [AuditLogs] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the audit log record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
UserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the actor
ActionType | nvarchar | 100 | Action category such as Login, ProvisionTenant, or UpdateRole
EntityName | nvarchar | 100 | Name of the affected table or business entity
EntityId | uniqueidentifier | 36 | Identifier of the affected record when applicable
Details | nvarchar | 2000 | Full audit details or serialized change summary
IpAddress | nvarchar | 45 | Source IP address if captured
CreatedAtUtc | datetime2 | - | UTC date and time when the action happened
```
## Level 2 - Tenant Administrator / Owner

Tables primarily handled by this user:

- `Users`
- `Roles`
- `UserRoles`
- `Customers`
- `ServiceRequests`
- `StatusLogs`
- `Assignments`
- `AssignmentEvents`
- `AssignmentEvidence`
- `Invoices`
- `InvoiceLines`
- `MicroLoans`
- `AmortizationSchedules`
- `Transactions`
- `CustomerFeedback` (future addition)
- `ServiceRequestPhotos` (future addition)

### [Users] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant user account
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Email | nvarchar | 50 | Login email address of the tenant user
PasswordHash | nvarchar | 512 | Hashed password value
FullName | nvarchar | 200 | Full name of the operator
IsActive | bit | 1 | Active or inactive status of the account
CreatedAtUtc | datetime2 | - | UTC date and time when the account was created
```
### [Roles] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant role
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Name | nvarchar | 100 | Role name used inside the tenant
Description | nvarchar | 256 | Short explanation of the role
```
### [UserRoles] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant role assignment
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
UserId | uniqueidentifier | 36 | Foreign key to `Users.Id`
RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id`
AssignedAtUtc | datetime2 | - | UTC date and time when the role was assigned
```
### [Customers] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerCode | nvarchar | 50 | Unique customer code within the tenant
FullName | nvarchar | 200 | Full name of the customer
MobileNumber | nvarchar | 50 | Mobile or contact number
Email | nvarchar | 50 | Customer email address
PasswordHash | nvarchar | 512 | Hashed customer password value
Address | nvarchar | 500 | Customer address
CreatedAtUtc | datetime2 | - | UTC date and time when the customer was registered
```
### [ServiceRequests] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service request
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
RequestNumber | nvarchar | 50 | Unique service request number within the tenant
ItemType | nvarchar | 100 | General item type, such as oven or laptop
ItemDescription | nvarchar | 500 | Detailed description of the service item
IssueDescription | nvarchar | 1000 | Customer-reported issue or complaint
RequestedServiceDate | datetime2 | - | Requested service schedule, if provided
Priority | nvarchar | 50 | Priority level of the request
CurrentStatus | nvarchar | 50 | Current workflow status of the request
Rating | int | 10 | Optional customer rating from 1 to 5
FeedbackComments | nvarchar | 1000 | Optional customer feedback comments after service
CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creator
CreatedAtUtc | datetime2 | - | UTC date and time when the request was created
```
### [StatusLogs] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the status log
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
Status | nvarchar | 50 | Status value recorded for the request
Remarks | nvarchar | 1000 | Remarks or explanation of the status change
ChangedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the operator who changed the status
ChangedAtUtc | datetime2 | - | UTC date and time when the status changed
```
### [Assignments] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the assignment
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
AssignedUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the assigned staff member
AssignedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the assigning manager
ScheduledStartUtc | datetime2 | - | Planned start date and time
ScheduledEndUtc | datetime2 | - | Planned end date and time
AssignmentStatus | nvarchar | 50 | Current status of the assignment
CreatedAtUtc | datetime2 | - | UTC date and time when the assignment was created
```
### [AssignmentEvents] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the assignment event row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
AssignmentId | uniqueidentifier | 36 | Foreign key to `Assignments.Id`
EventType | nvarchar | 50 | Event category such as Assigned, Rescheduled, or HandedOver
PreviousAssignedUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the previous assignee
AssignedUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the current assignee
PreviousScheduledStartUtc | datetime2 | - | Optional previous planned start date and time
PreviousScheduledEndUtc | datetime2 | - | Optional previous planned end date and time
ScheduledStartUtc | datetime2 | - | Optional current planned start date and time
ScheduledEndUtc | datetime2 | - | Optional current planned end date and time
AssignmentStatus | nvarchar | 50 | Assignment status recorded for the event
Remarks | nvarchar | 1000 | Notes explaining the assignment change
ChangedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the actor who changed the assignment
CreatedAtUtc | datetime2 | - | UTC date and time when the event was logged
```
### [AssignmentEvidence] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the assignment evidence row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
AssignmentId | uniqueidentifier | 36 | Foreign key to `Assignments.Id`
SubmittedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the uploader
Note | nvarchar | 2000 | Evidence note or submission remark
OriginalFileName | nvarchar | 260 | Optional original file name supplied by the client
StoredFileName | nvarchar | 260 | Optional stored file name used by the system
ContentType | nvarchar | 120 | Optional uploaded file content type
RelativeUrl | nvarchar | 500 | Optional relative path or URL to the uploaded evidence
CreatedAtUtc | datetime2 | - | UTC date and time when the evidence was submitted
```
### [Invoices] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Optional foreign key to `ServiceRequests.Id`
InvoiceNumber | nvarchar | 50 | Unique invoice number within the tenant
InvoiceDateUtc | datetime2 | - | UTC date and time of invoice issuance
SubtotalAmount | decimal | 12,2 | Sum of invoice line amounts before discount and loan handling
InterestableAmount | decimal | 12,2 | Amount eligible for financing or interest
DiscountAmount | decimal | 12,2 | Discount amount applied to the invoice
TotalAmount | decimal | 12,2 | Final total amount due
OutstandingAmount | decimal | 12,2 | Remaining unpaid amount
InvoiceStatus | nvarchar | 50 | Status of the invoice, such as Open or Paid
```
### [InvoiceLines] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice line
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id`
Description | nvarchar | 500 | Description of the billed item or service
Quantity | decimal | 10,2 | Quantity billed on the line
UnitPrice | decimal | 12,2 | Unit price of the line item
LineTotal | decimal | 12,2 | Extended amount of the line item
```
### [MicroLoans] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the micro-loan
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Optional foreign key to `Invoices.Id`; one invoice can produce at most one loan when present
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
PrincipalAmount | decimal | 12,2 | Loan principal amount
AnnualInterestRate | decimal | 6,2 | Annual interest rate used for computation
TermMonths | int | 10 | Loan term in months
MonthlyInstallment | decimal | 12,2 | Fixed installment amount per month
TotalInterestAmount | decimal | 12,2 | Total interest for the whole loan
TotalRepayableAmount | decimal | 12,2 | Total amount to be repaid
LoanStartDate | datetime2 | - | Start date of the loan
MaturityDate | datetime2 | - | Final due date of the loan
LoanStatus | nvarchar | 50 | Current status of the loan
CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creating operator
CreatedAtUtc | datetime2 | - | UTC date and time when the loan was created
```
### [AmortizationSchedules] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the amortization row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
MicroLoanId | uniqueidentifier | 36 | Foreign key to `MicroLoans.Id`
InstallmentNumber | int | 10 | Sequence number of the installment
DueDate | datetime2 | - | Due date of the installment
BeginningBalance | decimal | 12,2 | Loan balance before the installment
PrincipalPortion | decimal | 12,2 | Principal amount included in the installment
InterestPortion | decimal | 12,2 | Interest amount included in the installment
InstallmentAmount | decimal | 12,2 | Total installment amount due
EndingBalance | decimal | 12,2 | Balance after the installment
PaidAmount | decimal | 12,2 | Amount already paid against the installment
InstallmentStatus | nvarchar | 50 | Status of the installment, such as Unpaid, Partial, or Paid
```
### [Transactions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the ledger transaction
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
InvoiceId | uniqueidentifier | 36 | Optional foreign key to `Invoices.Id`
MicroLoanId | uniqueidentifier | 36 | Optional foreign key to `MicroLoans.Id`
AmortizationScheduleId | uniqueidentifier | 36 | Optional foreign key to `AmortizationSchedules.Id`
TransactionDateUtc | datetime2 | - | UTC date and time of the ledger event
TransactionType | nvarchar | 50 | Type of ledger event, such as Invoice, Loan, or Payment
ReferenceNumber | nvarchar | 100 | Human-readable transaction reference
DebitAmount | decimal | 12,2 | Debit amount recorded in the ledger
CreditAmount | decimal | 12,2 | Credit amount recorded in the ledger
RunningBalance | decimal | 12,2 | Balance after the transaction posting
Remarks | nvarchar | 1000 | Transaction remarks or explanation
CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creating operator
```
### [CustomerFeedback] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer feedback record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
Rating | int | 10 | Numeric service rating submitted by the customer
FeedbackText | nvarchar | 1000 | Comment or feedback text
SubmittedAtUtc | datetime2 | - | UTC date and time when feedback was submitted
Status | nvarchar | 50 | Review status of the feedback
```
### [ServiceRequestPhotos] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service request photo record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
UploadedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the uploader
FileName | nvarchar | 255 | Original or stored file name
FileUrl | nvarchar | 500 | File path or blob URL of the uploaded image
Caption | nvarchar | 255 | Optional caption or note for the image
UploadedAtUtc | datetime2 | - | UTC date and time when the image was uploaded
```
## Level 3 - Service Staff / Technician

Tables primarily handled by this user:

- `Customers`
- `ServiceRequests`
- `StatusLogs`
- `Assignments`
- `ServiceRequestPhotos` (future addition)
- `CustomerFeedback` (view or follow-up only, future addition)

### [Customers] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerCode | nvarchar | 50 | Unique customer code within the tenant
FullName | nvarchar | 200 | Customer full name
MobileNumber | nvarchar | 50 | Contact number used for service coordination
Email | nvarchar | 50 | Customer email address
PasswordHash | nvarchar | 512 | Hashed customer password value
Address | nvarchar | 500 | Customer address
CreatedAtUtc | datetime2 | - | UTC date and time when the customer was added
```
### [ServiceRequests] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service request
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
RequestNumber | nvarchar | 50 | Unique service request number
ItemType | nvarchar | 100 | Category of the service item
ItemDescription | nvarchar | 500 | Description of the item being serviced
IssueDescription | nvarchar | 1000 | Reported issue of the item
RequestedServiceDate | datetime2 | - | Requested schedule of service
Priority | nvarchar | 50 | Request priority
CurrentStatus | nvarchar | 50 | Current work status
Rating | int | 10 | Optional customer rating from 1 to 5
FeedbackComments | nvarchar | 1000 | Optional customer feedback comments after service
CreatedByUserId | uniqueidentifier | 36 | User who created the request
CreatedAtUtc | datetime2 | - | UTC date and time when the request was created
```
### [StatusLogs] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the status update row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
Status | nvarchar | 50 | Updated service status
Remarks | nvarchar | 1000 | Notes regarding the update
ChangedByUserId | uniqueidentifier | 36 | User who made the update
ChangedAtUtc | datetime2 | - | UTC date and time when the update was posted
```
### [Assignments] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the assignment row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
AssignedUserId | uniqueidentifier | 36 | Technician or staff assigned to the task
AssignedByUserId | uniqueidentifier | 36 | User who created the assignment
ScheduledStartUtc | datetime2 | - | Planned start schedule
ScheduledEndUtc | datetime2 | - | Planned completion schedule
AssignmentStatus | nvarchar | 50 | Current assignment status
CreatedAtUtc | datetime2 | - | UTC date and time when the assignment was logged
```
### [ServiceRequestPhotos] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service photo row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
UploadedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id`
FileName | nvarchar | 255 | Stored file name of the image
FileUrl | nvarchar | 500 | Path or URL of the image
Caption | nvarchar | 255 | Caption for the service photo
UploadedAtUtc | datetime2 | - | UTC date and time when the photo was uploaded
```
### [CustomerFeedback] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the feedback record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
Rating | int | 10 | Rating submitted by the customer
FeedbackText | nvarchar | 1000 | Written feedback
SubmittedAtUtc | datetime2 | - | UTC date and time when the feedback was submitted
Status | nvarchar | 50 | Internal follow-up status
```
## Level 4 - Finance Staff / Loan Officer / Cashier

Tables primarily handled by this user:

- `Customers`
- `Invoices`
- `InvoiceLines`
- `MicroLoans`
- `AmortizationSchedules`
- `Transactions`
- `AuditLogs` (future review access for higher tiers)

### [Customers] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerCode | nvarchar | 50 | Unique customer code used in finance and service flows
FullName | nvarchar | 200 | Customer full name
MobileNumber | nvarchar | 50 | Contact number
Email | nvarchar | 50 | Customer email address
PasswordHash | nvarchar | 512 | Hashed customer password value
Address | nvarchar | 500 | Customer address
CreatedAtUtc | datetime2 | - | UTC date and time when the customer was created
```
### [Invoices] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Optional source service request
InvoiceNumber | nvarchar | 50 | Unique invoice number
InvoiceDateUtc | datetime2 | - | Invoice issue date and time
SubtotalAmount | decimal | 12,2 | Total before discounts
InterestableAmount | decimal | 12,2 | Amount eligible for financing
DiscountAmount | decimal | 12,2 | Discount applied to the invoice
TotalAmount | decimal | 12,2 | Final billed amount
OutstandingAmount | decimal | 12,2 | Remaining unpaid balance
InvoiceStatus | nvarchar | 50 | Current invoice status
```
### [InvoiceLines] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice line
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id`
Description | nvarchar | 500 | Billed service or item description
Quantity | decimal | 10,2 | Quantity billed
UnitPrice | decimal | 12,2 | Unit price
LineTotal | decimal | 12,2 | Total amount of the line
```
### [MicroLoans] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the micro-loan
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Optional source invoice converted into a loan
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
PrincipalAmount | decimal | 12,2 | Loan principal
AnnualInterestRate | decimal | 6,2 | Annual interest rate
TermMonths | int | 10 | Repayment term in months
MonthlyInstallment | decimal | 12,2 | Monthly amortization amount
TotalInterestAmount | decimal | 12,2 | Total interest value
TotalRepayableAmount | decimal | 12,2 | Principal plus total interest
LoanStartDate | datetime2 | - | Loan start date
MaturityDate | datetime2 | - | Final due date
LoanStatus | nvarchar | 50 | Loan lifecycle status
CreatedByUserId | uniqueidentifier | 36 | User who created the loan
CreatedAtUtc | datetime2 | - | UTC date and time when the loan was created
```
### [AmortizationSchedules] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the amortization row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
MicroLoanId | uniqueidentifier | 36 | Foreign key to `MicroLoans.Id`
InstallmentNumber | int | 10 | Installment sequence number
DueDate | datetime2 | - | Installment due date
BeginningBalance | decimal | 12,2 | Balance before the installment
PrincipalPortion | decimal | 12,2 | Principal component of the installment
InterestPortion | decimal | 12,2 | Interest component of the installment
InstallmentAmount | decimal | 12,2 | Total installment amount
EndingBalance | decimal | 12,2 | Balance after the installment
PaidAmount | decimal | 12,2 | Amount already paid against the row
InstallmentStatus | nvarchar | 50 | Status of the installment
```
### [Transactions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the transaction row
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
InvoiceId | uniqueidentifier | 36 | Optional invoice reference
MicroLoanId | uniqueidentifier | 36 | Optional loan reference
AmortizationScheduleId | uniqueidentifier | 36 | Optional schedule reference
TransactionDateUtc | datetime2 | - | Date and time of the ledger posting
TransactionType | nvarchar | 50 | Kind of financial transaction
ReferenceNumber | nvarchar | 100 | Receipt number or ledger reference
DebitAmount | decimal | 12,2 | Debit amount
CreditAmount | decimal | 12,2 | Credit amount
RunningBalance | decimal | 12,2 | Balance after posting
Remarks | nvarchar | 1000 | Notes about the posting
CreatedByUserId | uniqueidentifier | 36 | User who created the transaction
```
### [AuditLogs] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the audit log
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
UserId | uniqueidentifier | 36 | User who performed the action
ActionType | nvarchar | 100 | Action being audited
EntityName | nvarchar | 100 | Affected entity or table name
EntityId | uniqueidentifier | 36 | Affected record identifier
Details | nvarchar | 2000 | Change summary or event details
IpAddress | nvarchar | 45 | Client IP address
CreatedAtUtc | datetime2 | - | UTC date and time when the action occurred
```
## Level 5 - Customer / External Client (Future self-service)

Tables primarily handled by this user:

- `Customers`
- `ServiceRequests`
- `Invoices`
- `CustomerFeedback` (future addition)

### [Customers] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer profile
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerCode | nvarchar | 50 | Unique customer code
FullName | nvarchar | 200 | Customer full name
MobileNumber | nvarchar | 50 | Customer contact number
Email | nvarchar | 50 | Customer email address
PasswordHash | nvarchar | 512 | Hashed customer password value
Address | nvarchar | 500 | Customer address
CreatedAtUtc | datetime2 | - | UTC date and time when the customer profile was created
```
### [ServiceRequests] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service request
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
RequestNumber | nvarchar | 50 | Service request number visible to the customer
ItemType | nvarchar | 100 | Item category
ItemDescription | nvarchar | 500 | Description of the submitted item
IssueDescription | nvarchar | 1000 | Reported problem
RequestedServiceDate | datetime2 | - | Requested service date
Priority | nvarchar | 50 | Priority category
CurrentStatus | nvarchar | 50 | Current service status visible to the customer
Rating | int | 10 | Optional customer rating from 1 to 5
FeedbackComments | nvarchar | 1000 | Optional customer feedback comments after service
CreatedByUserId | uniqueidentifier | 36 | User who registered the request
CreatedAtUtc | datetime2 | - | UTC date and time when the request was created
```
### [Invoices] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Related service request when applicable
InvoiceNumber | nvarchar | 50 | Invoice number given to the customer
InvoiceDateUtc | datetime2 | - | Invoice issue date
SubtotalAmount | decimal | 12,2 | Amount before discount
InterestableAmount | decimal | 12,2 | Amount that may be financed
DiscountAmount | decimal | 12,2 | Discount amount
TotalAmount | decimal | 12,2 | Final amount due
OutstandingAmount | decimal | 12,2 | Remaining amount not yet paid
InvoiceStatus | nvarchar | 50 | Invoice payment status
```
### [CustomerFeedback] table (Future addition)

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the feedback record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
Rating | int | 10 | Customer rating value
FeedbackText | nvarchar | 1000 | Text feedback from the customer
SubmittedAtUtc | datetime2 | - | UTC date and time when the feedback was submitted
Status | nvarchar | 50 | Review or follow-up status
```
## Notes

- Implemented tables in the current codebase: `Tenants`, `SubscriptionTiers`, `ModuleCatalog`, `SubscriptionTierModules`, `Users`, `Roles`, `UserRoles`, `RefreshSessions`, `Customers`, `ServiceRequests`, `StatusLogs`, `Assignments`, `AssignmentEvents`, `AssignmentEvidence`, `Invoices`, `InvoiceLines`, `MicroLoans`, `AmortizationSchedules`, `Transactions`.
- Assumed future tables from existing docs: `TenantModuleEntitlements`, `AuditLogs`, `CustomerFeedback`, `ServiceRequestPhotos`.
- `Collections Queue` and reporting screens are currently better modeled as derived queries, dashboards, or views from `MicroLoans`, `AmortizationSchedules`, and `Transactions`, not as standalone base tables.
