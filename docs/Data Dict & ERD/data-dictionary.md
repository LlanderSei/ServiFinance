# ServiFinance Data Dictionary

Last updated: 2026-05-11

## Scope

- This dictionary is based on the current EF Core schema in `src/backend/ServiFinance.Domain/Entities.cs` and the split EF configuration files under `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext/`.
- It includes only implemented tables unless a note explicitly calls out future hardening. Several workflow features, such as customer feedback and module access, are stored on existing tables instead of separate future tables.
- `Length` shows the configured database length or precision where available.
- `uniqueidentifier` fields are stored as GUID values.
- `datetime2`, `bit`, `int`, and `decimal` fields do not use character length, so the precision or `-` is shown instead.

## Level 1 - Super Admin

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
BillingProvider | nvarchar | 50 | Billing owner such as Manual or Stripe
StripeCustomerId | nvarchar | 200 | Optional external Stripe customer reference
StripeSubscriptionId | nvarchar | 200 | Optional external Stripe subscription reference
PendingSubscriptionTierId | uniqueidentifier | 36 | Optional target tier scheduled for the next renewal cycle
PendingSubscriptionChangeRequestedAtUtc | datetime2 | - | UTC date and time when a plan switch was requested
PendingSubscriptionChangeEffectiveAtUtc | datetime2 | - | UTC date and time when the pending switch should apply
PendingSubscriptionChangeCancelledAtUtc | datetime2 | - | UTC date and time when the pending switch was cancelled
SubscriptionChangeCooldownUntilUtc | datetime2 | - | UTC date and time until another switch request is blocked after cancellation
CreatedAtUtc | datetime2 | - | UTC date and time when the tenant was created
IsActive | bit | 1 | Active or inactive status of the tenant
```
### [TenantThemes] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant theme record
TenantId | uniqueidentifier | 36 | Unique foreign key to `Tenants.Id`
DisplayName | nvarchar | 200 | Optional public-facing tenant name used in branded screens
LogoUrl | nvarchar | 500 | Optional logo path or URL for tenant branding
PrimaryColor | nvarchar | 20 | Optional primary brand color value
SecondaryColor | nvarchar | 20 | Optional secondary brand color value
HeaderBackgroundColor | nvarchar | 20 | Optional header background color value
PageBackgroundColor | nvarchar | 20 | Optional page background color value
```
### [PlatformTenantRegistrations] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant onboarding attempt
SubscriptionTierId | uniqueidentifier | 36 | Foreign key to `SubscriptionTiers.Id`
TenantId | uniqueidentifier | 36 | Optional tenant created after successful provisioning
BusinessName | nvarchar | 200 | Business name submitted during registration
TenantCode | nvarchar | 50 | Tenant code generated from registration data
DomainSlug | nvarchar | 100 | Requested tenant route slug
OwnerFullName | nvarchar | 200 | Initial owner or administrator full name
OwnerEmail | nvarchar | 50 | Initial owner or administrator email
OwnerPasswordHash | nvarchar | 512 | Hashed password staged until provisioning completes
Status | nvarchar | 50 | Registration state such as PendingCheckout, Paid, Provisioned, or Failed
StripeCheckoutSessionId | nvarchar | 200 | Stripe Checkout session linked to the attempt
StripeCustomerId | nvarchar | 200 | Stripe customer linked to the attempt
StripeSubscriptionId | nvarchar | 200 | Stripe subscription linked to the attempt
CreatedAtUtc | datetime2 | - | UTC date and time when the attempt was created
UpdatedAtUtc | datetime2 | - | UTC date and time when the attempt was last updated
CheckoutExpiresAtUtc | datetime2 | - | UTC date and time when hosted checkout expires
ProvisionedAtUtc | datetime2 | - | UTC date and time when tenant provisioning completed
FailureReason | nvarchar | 500 | Failure detail when provisioning or checkout handling fails
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
MonthlyPriceAmount | decimal | 18,2 | Numeric monthly price used for billing calculations
CurrencyCode | nvarchar | 3 | Currency code used with the numeric price
PriceDisplay | nvarchar | 100 | Price label shown in the UI; display-only copy derived from the numeric price
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
PlatformScope | nvarchar | 30 | Scope such as Root, SMS, MLS, or OwnerAdmin
Rank | int | 10 | Role ranking used to prevent editing peer or higher roles
IsSystemRole | bit | 1 | Indicates whether the role is seeded by the platform
IsPermissionSetLocked | bit | 1 | Indicates whether the permission set cannot be changed
```
### [RolePermissions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the role permission grant
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id`
PermissionKey | nvarchar | 160 | Permission key granted to the role
GrantedAtUtc | datetime2 | - | UTC date and time when the permission was granted
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
### [ExternalServiceStates] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the external service state row
Provider | nvarchar | 50 | External provider name such as Nominatim
StateKey | nvarchar | 200 | Provider-specific state or rate-limit key
PayloadJson | nvarchar | max | Optional serialized provider response or state payload
ExpiresAtUtc | datetime2 | - | Optional UTC expiry for cached provider state
NextAllowedRequestUtc | datetime2 | - | UTC timestamp used to guard provider rate limits
UpdatedAtUtc | datetime2 | - | UTC date and time when the state was last updated
```
### [AuditEvents] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the audit event
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Scope | nvarchar | 50 | Audit scope such as Root, SMS, or MLS
Category | nvarchar | 50 | Audit category such as System or Security
ActionType | nvarchar | 100 | Action category such as Login, ProvisionTenant, UpdateRole, or PostPayment
Outcome | nvarchar | 50 | Result such as Success, Failed, or Blocked
ActorUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the actor
ActorName | nvarchar | 200 | Snapshot of actor name
ActorEmail | nvarchar | 50 | Snapshot of actor email
SubjectType | nvarchar | 100 | Business subject type affected by the action
SubjectId | uniqueidentifier | 36 | Optional identifier of the affected record
SubjectLabel | nvarchar | 300 | Human-readable subject label
Detail | nvarchar | 1000 | Audit detail or event summary
IpAddress | nvarchar | 80 | Source IP address if captured
UserAgent | nvarchar | 500 | Client user-agent string if captured
OccurredAtUtc | datetime2 | - | UTC date and time when the action happened
```
## Level 2 - Tenant Administrator / Owner

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
PlatformScope | nvarchar | 30 | Scope such as SMS, MLS, or OwnerAdmin
Rank | int | 10 | Role ranking used to prevent editing peer or higher roles
IsSystemRole | bit | 1 | Indicates whether the role is seeded by the platform
IsPermissionSetLocked | bit | 1 | Indicates whether the permission set cannot be changed
```
### [RolePermissions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the role permission grant
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
RoleId | uniqueidentifier | 36 | Foreign key to `Roles.Id`
PermissionKey | nvarchar | 160 | Tenant-scoped permission key granted to the role
GrantedAtUtc | datetime2 | - | UTC date and time when the permission was granted
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
AddressDetails | nvarchar | 500 | Extra address detail such as lot, floor, unit, or landmark
CreatedAtUtc | datetime2 | - | UTC date and time when the customer was registered
```
### [CustomerContactOptions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the reusable customer contact or address option
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
Label | nvarchar | 120 | Customer-facing label for the saved contact or address
ContactName | nvarchar | 200 | Person to contact for the saved option
PhoneNumber | nvarchar | 50 | Phone number for the saved option
Address | nvarchar | 500 | Search-selected or manually entered address
AddressDetails | nvarchar | 500 | Extra address detail not expected to resolve through geocoding
IsDefault | bit | 1 | Indicates the default saved option
CreatedAtUtc | datetime2 | - | UTC date and time when the option was created
```
### [TenantCostingPolicies] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant costing and loan penalty policy
TenantId | uniqueidentifier | 36 | Unique foreign key to `Tenants.Id`
TaxLabel | nvarchar | 80 | Tax label used on service costing
DefaultTaxRate | decimal | 6,2 | Default tax percentage used on service costing
TaxEnabledByDefault | bit | 1 | Indicates whether tax is included by default
LoanLateFeeEnabled | bit | 1 | Indicates whether late-loan penalties are enabled
LoanLateFeeGracePeriodDays | int | 10 | Number of days before a late penalty can apply
LoanLateFeeFlatAmount | decimal | 12,2 | Flat late fee amount
LoanLateFeeRatePercent | decimal | 6,2 | Percentage late fee rate
CreatedAtUtc | datetime2 | - | UTC date and time when the policy was created
UpdatedAtUtc | datetime2 | - | UTC date and time when the policy was last updated
```
### [ServiceCostPresets] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the reusable service costing preset
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Category | nvarchar | 50 | Preset category such as Base, Service, Part, or Other
Name | nvarchar | 160 | Preset line-item name
DefaultSpecification | nvarchar | 300 | Optional default specification
DefaultQuantity | decimal | 10,2 | Default quantity copied into a cost sheet
DefaultUnitPrice | decimal | 12,2 | Default unit price copied into a cost sheet
IsActive | bit | 1 | Active or inactive preset state
SortOrder | int | 10 | Display order inside the pricing workspace
CreatedAtUtc | datetime2 | - | UTC date and time when the preset was created
UpdatedAtUtc | datetime2 | - | UTC date and time when the preset was last updated
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
ServiceMode | nvarchar | 50 | Visit mode such as drop-off, pickup, or onsite
ServiceAddress | nvarchar | 500 | Service address used when the work needs a visit or pickup
ServiceAddressDetails | nvarchar | 500 | Extra service address detail such as unit, building, or landmark
ContactName | nvarchar | 200 | Contact person for the request
ContactPhone | nvarchar | 50 | Contact phone number for the request
PreferredScheduleStartUtc | datetime2 | - | Optional preferred service window start
PreferredScheduleEndUtc | datetime2 | - | Optional preferred service window end
NeededByUtc | datetime2 | - | Optional due date or pre-order target date
Priority | nvarchar | 50 | Priority level of the request
CurrentStatus | nvarchar | 50 | Current workflow status of the request
Rating | int | 10 | Optional customer rating from 1 to 5
FeedbackComments | nvarchar | 1000 | Optional customer feedback comments after service
FeedbackSuggestionCategory | nvarchar | 80 | Optional customer suggestion category
CompletedAtUtc | datetime2 | - | UTC date and time when service work completed
FeedbackSubmittedAtUtc | datetime2 | - | UTC date and time when feedback was submitted
FeedbackExpiresAtUtc | datetime2 | - | UTC date and time when feedback collection expires
CancellationRequestedAtUtc | datetime2 | - | UTC date and time when customer cancellation was requested
CancelledAtUtc | datetime2 | - | UTC date and time when the request was cancelled
CancellationReason | nvarchar | 500 | Customer or operator cancellation reason
CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creator
CreatedByCustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` when created through the customer portal
CreatedAtUtc | datetime2 | - | UTC date and time when the request was created
```
### [ServiceCostSheets] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service cost sheet
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Unique foreign key to `ServiceRequests.Id`
Status | nvarchar | 50 | Cost sheet state such as Draft or Finalized
IsTaxEnabled | bit | 1 | Indicates whether tax is included in totals
TaxLabel | nvarchar | 80 | Tax label used for this request
TaxRate | decimal | 6,2 | Tax percentage used for this request
Notes | nvarchar | 1000 | Technician or admin costing notes
CreatedAtUtc | datetime2 | - | UTC date and time when the sheet was created
UpdatedAtUtc | datetime2 | - | UTC date and time when the sheet was last updated
FinalizedAtUtc | datetime2 | - | UTC date and time when the sheet was finalized
```
### [ServiceCostLines] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the service cost line
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceCostSheetId | uniqueidentifier | 36 | Foreign key to `ServiceCostSheets.Id`
ServiceCostPresetId | uniqueidentifier | 36 | Optional foreign key to the copied `ServiceCostPresets.Id`
Category | nvarchar | 50 | Cost line category such as Base, Service, Part, or Other
Name | nvarchar | 160 | Cost line name
Specification | nvarchar | 300 | Optional part or service specification
Quantity | decimal | 10,2 | Quantity applied to the line
UnitPrice | decimal | 12,2 | Unit price applied to the line
SortOrder | int | 10 | Display order inside the cost sheet
CreatedAtUtc | datetime2 | - | UTC date and time when the line was created
UpdatedAtUtc | datetime2 | - | UTC date and time when the line was last updated
```
### [ServiceRequestAttachments] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the customer request attachment
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
ServiceRequestId | uniqueidentifier | 36 | Foreign key to `ServiceRequests.Id`
SubmittedByCustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id` for the uploader
OriginalFileName | nvarchar | 260 | Original uploaded file name
StoredFileName | nvarchar | 260 | Stored provider or local file name
ContentType | nvarchar | 120 | Uploaded file content type
RelativeUrl | nvarchar | 500 | Relative path or hosted image URL
CreatedAtUtc | datetime2 | - | UTC date and time when the attachment was submitted
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
ChangedByCustomerId | uniqueidentifier | 36 | Optional foreign key to `Customers.Id` for customer-originated changes
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
### [TenantBillingRecords] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the tenant subscription billing record
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
SubmittedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the operator or owner who submitted the record
BillingPeriodLabel | nvarchar | 100 | Human-readable billing cycle label
CoverageStartUtc | datetime2 | - | UTC date and time when coverage starts
CoverageEndUtc | datetime2 | - | UTC date and time when coverage ends
DueDateUtc | datetime2 | - | UTC due date of the billing cycle
AmountDue | decimal | 12,2 | Amount expected for the billing cycle
AmountSubmitted | decimal | 12,2 | Amount submitted or recorded as paid
PaymentMethod | nvarchar | 50 | Payment method such as Stripe, Cash, GCash, or Manual
ReferenceNumber | nvarchar | 100 | External or manual payment reference
Status | nvarchar | 50 | Review or billing state
Note | nvarchar | 1000 | Optional submitter note
ReviewRemarks | nvarchar | 1000 | Optional reviewer remarks
ProofOriginalFileName | nvarchar | 260 | Original uploaded proof file name
ProofStoredFileName | nvarchar | 260 | Stored provider or local file name
ProofContentType | nvarchar | 120 | Uploaded proof content type
ProofRelativeUrl | nvarchar | 500 | Relative path or hosted proof URL
SubmittedAtUtc | datetime2 | - | UTC date and time when the record was submitted
ReviewedAtUtc | datetime2 | - | UTC date and time when the record was reviewed
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
TaxAmount | decimal | 12,2 | Tax amount calculated from the service cost sheet or invoice inputs
InterestableAmount | decimal | 12,2 | Amount eligible for financing or interest
DiscountAmount | decimal | 12,2 | Discount amount applied to the invoice
TotalAmount | decimal | 12,2 | Final total amount due
OutstandingAmount | decimal | 12,2 | Remaining unpaid amount
InvoiceStatus | nvarchar | 50 | Status of the invoice, such as Open or Paid
LoanApprovalStatus | nvarchar | 50 | Maker-checker approval state before invoice-to-loan release
LoanApprovalRequestedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the maker requesting loan approval
LoanApprovalRequestedAtUtc | datetime2 | - | UTC date and time when loan approval was requested
LoanApprovalReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the checker reviewing the request
LoanApprovalReviewedAtUtc | datetime2 | - | UTC date and time when the request was approved or rejected
LoanApprovalRemarks | nvarchar | 1000 | Maker or checker remarks attached to the approval request
```
### [InvoicePaymentSubmissions] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of a customer payment proof or online payment submission
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id`
CustomerId | uniqueidentifier | 36 | Foreign key to `Customers.Id`
ServiceRequestId | uniqueidentifier | 36 | Optional foreign key to `ServiceRequests.Id`
AmountSubmitted | decimal | 12,2 | Amount submitted by the customer
ApprovedAmount | decimal | 12,2 | Amount approved by tenant staff
PaymentMethod | nvarchar | 80 | Payment method such as Stripe, GCash, Cash, or Bank
ReferenceNumber | nvarchar | 120 | External or manual payment reference
Note | nvarchar | 1000 | Optional customer note
Status | nvarchar | 50 | Review state such as Pending, Approved, Rejected, or Paid
ReviewRemarks | nvarchar | 1000 | Optional tenant review remarks
ProofOriginalFileName | nvarchar | 260 | Original uploaded proof file name
ProofStoredFileName | nvarchar | 260 | Stored provider or local file name
ProofContentType | nvarchar | 120 | Uploaded proof content type
ProofRelativeUrl | nvarchar | 500 | Relative path or hosted proof URL
SubmittedAtUtc | datetime2 | - | UTC date and time when the submission was created
ReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the reviewer
ReviewedAtUtc | datetime2 | - | UTC date and time when the submission was reviewed
```
### [InvoiceLines] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the invoice line
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
InvoiceId | uniqueidentifier | 36 | Foreign key to `Invoices.Id`
Category | nvarchar | 50 | Invoice line category copied from costing or entered manually
Name | nvarchar | 160 | Invoice line name
Specification | nvarchar | 300 | Optional item or service specification
Description | nvarchar | 500 | Description of the billed item or service
Quantity | decimal | 10,2 | Quantity billed on the line
UnitPrice | decimal | 12,2 | Unit price of the line item
LineTotal | decimal | 12,2 | Extended amount of the line item
SortOrder | int | 10 | Display order of the invoice line
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
ReferenceNumber | nvarchar | 100 | Optional standalone loan reference retained before approval and ledger release
Remarks | nvarchar | 1000 | Optional loan or release remarks
LoanStatus | nvarchar | 50 | Current status of the loan
ApprovalStatus | nvarchar | 50 | Maker-checker approval state for standalone loan release
ApprovalRequestedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the maker requesting approval
ApprovalRequestedAtUtc | datetime2 | - | UTC date and time when approval was requested
ApprovalReviewedByUserId | uniqueidentifier | 36 | Optional foreign key to `Users.Id` for the checker reviewing the loan
ApprovalReviewedAtUtc | datetime2 | - | UTC date and time when the loan was approved or rejected
ApprovalRemarks | nvarchar | 1000 | Maker or checker remarks attached to the standalone approval
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
LateFeeAmount | decimal | 12,2 | Late penalty amount applied to the installment
LateFeeAppliedAtUtc | datetime2 | - | UTC date and time when the late fee was applied
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
ReversalOfTransactionId | uniqueidentifier | 36 | Optional foreign key to a transaction reversed by this posting
TransactionDateUtc | datetime2 | - | UTC date and time of the ledger event
TransactionType | nvarchar | 50 | Type of ledger event, such as Invoice, Loan, or Payment
ReferenceNumber | nvarchar | 100 | Human-readable transaction reference
DebitAmount | decimal | 12,2 | Debit amount recorded in the ledger
CreditAmount | decimal | 12,2 | Credit amount recorded in the ledger
RunningBalance | decimal | 12,2 | Balance after the transaction posting
Remarks | nvarchar | 1000 | Transaction remarks or explanation
CreatedByUserId | uniqueidentifier | 36 | Foreign key to `Users.Id` for the creating operator
```
### Feedback and attachment modeling note

Customer feedback is currently stored on `ServiceRequests` through `Rating`, `FeedbackComments`, `FeedbackSuggestionCategory`, `FeedbackSubmittedAtUtc`, and `FeedbackExpiresAtUtc`. Customer-uploaded request images are stored as `ServiceRequestAttachments`, while technician evidence is stored as `AssignmentEvidence`.

## Level 3 - Service Staff / Technician

Tables primarily handled by this user:

- `Customers`
- `ServiceRequests`
- `StatusLogs`
- `Assignments`
- `AssignmentEvidence`
- `ServiceRequestAttachments` (view only)

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
### Service evidence note

Technician work evidence is stored in `AssignmentEvidence`. Customer-submitted request images are stored in `ServiceRequestAttachments`. Feedback and rating fields remain on `ServiceRequests` instead of a separate feedback table.

## Level 4 - Finance Staff / Loan Officer / Cashier

Tables primarily handled by this user:

- `Customers`
- `Invoices`
- `InvoiceLines`
- `MicroLoans`
- `AmortizationSchedules`
- `Transactions`
- `AuditEvents`

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
### [AuditEvents] table

```text
Field Names | Datatype | Length | Description
Id | uniqueidentifier | 36 | Primary key of the audit event
TenantId | uniqueidentifier | 36 | Foreign key to `Tenants.Id`
Scope | nvarchar | 50 | Audit scope such as Root, SMS, or MLS
Category | nvarchar | 50 | Audit category such as System or Security
ActionType | nvarchar | 100 | Action being audited
Outcome | nvarchar | 50 | Result such as Success, Failed, or Blocked
ActorUserId | uniqueidentifier | 36 | Optional actor user reference
SubjectType | nvarchar | 100 | Affected business subject type
SubjectId | uniqueidentifier | 36 | Optional affected subject identifier
Detail | nvarchar | 1000 | Change summary or event detail
IpAddress | nvarchar | 80 | Client IP address
OccurredAtUtc | datetime2 | - | UTC date and time when the action occurred
```
## Level 5 - Customer / External Client

Tables primarily handled by this user:

- `Customers`
- `CustomerContactOptions`
- `ServiceRequests`
- `ServiceRequestAttachments`
- `Invoices`
- `InvoicePaymentSubmissions`

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
### Customer portal modeling note

The customer portal uses the same tenant-scoped `Customers`, `CustomerContactOptions`, `ServiceRequests`, `ServiceRequestAttachments`, `Invoices`, and `InvoicePaymentSubmissions` tables. Customer identity remains isolated per tenant domain; there is no shared cross-tenant customer profile table.

## Notes

- Implemented tables in the current codebase: `Tenants`, `TenantThemes`, `PlatformTenantRegistrations`, `SubscriptionTiers`, `ModuleCatalog`, `SubscriptionTierModules`, `Users`, `Roles`, `RolePermissions`, `UserRoles`, `RefreshSessions`, `ExternalServiceStates`, `AuditEvents`, `Customers`, `CustomerContactOptions`, `TenantCostingPolicies`, `ServiceCostPresets`, `ServiceRequests`, `ServiceCostSheets`, `ServiceCostLines`, `ServiceRequestAttachments`, `StatusLogs`, `Assignments`, `AssignmentEvents`, `AssignmentEvidence`, `TenantBillingRecords`, `Invoices`, `InvoicePaymentSubmissions`, `InvoiceLines`, `MicroLoans`, `AmortizationSchedules`, `Transactions`.
- Future hardening is better modeled as workflow depth over these implemented tables unless a new table is explicitly introduced by migration. Examples: deeper MLS reporting aggregates, Google auth/MFA artifacts, and optional tenant-specific entitlement overrides beyond `SubscriptionTierModules`.
- Persisted MLS maker-checker approval is now modeled through approval status, maker, checker, timestamp, and remarks fields on `Invoices` and `MicroLoans`.
- `Collections Queue` and reporting screens are currently better modeled as derived queries, dashboards, or views from `MicroLoans`, `AmortizationSchedules`, and `Transactions`, not as standalone base tables.
