-- ServiFinance ERD import script for dbdiagram.io
-- Last updated: 2026-05-11
-- Implemented tables from the current EF Core model are listed below.

CREATE TABLE Tenants (
  Id uniqueidentifier PRIMARY KEY,
  Name nvarchar(200) NOT NULL,
  Code nvarchar(50) NOT NULL UNIQUE,
  DomainSlug nvarchar(100) NOT NULL UNIQUE,
  BusinessSizeSegment nvarchar(50) NOT NULL,
  SubscriptionEdition nvarchar(50) NOT NULL,
  SubscriptionPlan nvarchar(100) NOT NULL,
  SubscriptionStatus nvarchar(100) NOT NULL,
  BillingProvider nvarchar(50) NOT NULL,
  StripeCustomerId nvarchar(200),
  StripeSubscriptionId nvarchar(200),
  PendingSubscriptionTierId uniqueidentifier,
  PendingSubscriptionChangeRequestedAtUtc datetime2,
  PendingSubscriptionChangeEffectiveAtUtc datetime2,
  PendingSubscriptionChangeCancelledAtUtc datetime2,
  SubscriptionChangeCooldownUntilUtc datetime2,
  CreatedAtUtc datetime2 NOT NULL,
  IsActive bit NOT NULL,
  CONSTRAINT FK_Tenants_PendingSubscriptionTier FOREIGN KEY (PendingSubscriptionTierId) REFERENCES SubscriptionTiers(Id)
);

CREATE TABLE TenantThemes (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL UNIQUE,
  DisplayName nvarchar(200),
  LogoUrl nvarchar(500),
  PrimaryColor nvarchar(20),
  SecondaryColor nvarchar(20),
  HeaderBackgroundColor nvarchar(20),
  PageBackgroundColor nvarchar(20),
  CONSTRAINT FK_TenantThemes_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE PlatformTenantRegistrations (
  Id uniqueidentifier PRIMARY KEY,
  SubscriptionTierId uniqueidentifier NOT NULL,
  TenantId uniqueidentifier,
  BusinessName nvarchar(200) NOT NULL,
  TenantCode nvarchar(50) NOT NULL,
  DomainSlug nvarchar(100) NOT NULL,
  OwnerFullName nvarchar(200) NOT NULL,
  OwnerEmail nvarchar(50) NOT NULL,
  OwnerPasswordHash nvarchar(512) NOT NULL,
  Status nvarchar(50) NOT NULL,
  StripeCheckoutSessionId nvarchar(200) UNIQUE,
  StripeCustomerId nvarchar(200),
  StripeSubscriptionId nvarchar(200) UNIQUE,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CheckoutExpiresAtUtc datetime2,
  ProvisionedAtUtc datetime2,
  FailureReason nvarchar(500),
  CONSTRAINT FK_PlatformTenantRegistrations_SubscriptionTiers FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id),
  CONSTRAINT FK_PlatformTenantRegistrations_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE SubscriptionTiers (
  Id uniqueidentifier PRIMARY KEY,
  Code nvarchar(50) NOT NULL UNIQUE,
  DisplayName nvarchar(100) NOT NULL,
  BusinessSizeSegment nvarchar(50) NOT NULL,
  SubscriptionEdition nvarchar(50) NOT NULL,
  AudienceSummary nvarchar(200) NOT NULL,
  Description nvarchar(1000) NOT NULL,
  MonthlyPriceAmount decimal(18,2) NOT NULL,
  CurrencyCode nvarchar(3) NOT NULL,
  PriceDisplay nvarchar(100) NOT NULL,
  BillingLabel nvarchar(100) NOT NULL,
  PlanSummary nvarchar(300) NOT NULL,
  HighlightLabel nvarchar(100) NOT NULL,
  SortOrder int NOT NULL,
  IncludesServiceManagementWeb bit NOT NULL,
  IncludesMicroLendingDesktop bit NOT NULL,
  IsActive bit NOT NULL
);

CREATE TABLE ModuleCatalog (
  Id uniqueidentifier PRIMARY KEY,
  Code nvarchar(50) NOT NULL UNIQUE,
  Name nvarchar(150) NOT NULL,
  Channel nvarchar(50) NOT NULL,
  Summary nvarchar(300) NOT NULL,
  SortOrder int NOT NULL,
  IsActive bit NOT NULL
);

CREATE TABLE SubscriptionTierModules (
  Id uniqueidentifier PRIMARY KEY,
  SubscriptionTierId uniqueidentifier NOT NULL,
  PlatformModuleId uniqueidentifier NOT NULL,
  AccessLevel nvarchar(30) NOT NULL,
  SortOrder int NOT NULL,
  CONSTRAINT UQ_SubscriptionTierModules_Tier_Module UNIQUE (SubscriptionTierId, PlatformModuleId),
  CONSTRAINT FK_SubscriptionTierModules_SubscriptionTiers FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id),
  CONSTRAINT FK_SubscriptionTierModules_ModuleCatalog FOREIGN KEY (PlatformModuleId) REFERENCES ModuleCatalog(Id)
);

CREATE TABLE Users (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Email nvarchar(50) NOT NULL,
  PasswordHash nvarchar(512) NOT NULL,
  FullName nvarchar(200) NOT NULL,
  IsActive bit NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_Users_Email UNIQUE (Email),
  CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE Roles (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Name nvarchar(100) NOT NULL,
  Description nvarchar(256) NOT NULL,
  PlatformScope nvarchar(30) NOT NULL,
  Rank int NOT NULL,
  IsSystemRole bit NOT NULL,
  IsPermissionSetLocked bit NOT NULL,
  CONSTRAINT UQ_Roles_Tenant_Name UNIQUE (TenantId, Name),
  CONSTRAINT FK_Roles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE RolePermissions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  RoleId uniqueidentifier NOT NULL,
  PermissionKey nvarchar(160) NOT NULL,
  GrantedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_RolePermissions_Tenant_Role_Key UNIQUE (TenantId, RoleId, PermissionKey),
  CONSTRAINT FK_RolePermissions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE UserRoles (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  UserId uniqueidentifier NOT NULL,
  RoleId uniqueidentifier NOT NULL,
  AssignedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_UserRoles_Tenant_User_Role UNIQUE (TenantId, UserId, RoleId),
  CONSTRAINT FK_UserRoles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE Customers (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerCode nvarchar(50) NOT NULL,
  FullName nvarchar(200) NOT NULL,
  MobileNumber nvarchar(50) NOT NULL,
  Email nvarchar(50) NOT NULL,
  PasswordHash nvarchar(512) NOT NULL,
  Address nvarchar(500) NOT NULL,
  AddressDetails nvarchar(500),
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_Customers_Tenant_CustomerCode UNIQUE (TenantId, CustomerCode),
  CONSTRAINT FK_Customers_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE CustomerContactOptions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  Label nvarchar(120) NOT NULL,
  ContactName nvarchar(200) NOT NULL,
  PhoneNumber nvarchar(50) NOT NULL,
  Address nvarchar(500) NOT NULL,
  AddressDetails nvarchar(500),
  IsDefault bit NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_CustomerContactOptions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_CustomerContactOptions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id)
);

CREATE TABLE RefreshSessions (
  Id uniqueidentifier PRIMARY KEY,
  UserId uniqueidentifier,
  CustomerId uniqueidentifier,
  Surface nvarchar(50) NOT NULL,
  RememberMe bit NOT NULL,
  RefreshTokenHash nvarchar(128) NOT NULL UNIQUE,
  ExpiresAtUtc datetime2 NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  LastRotatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_RefreshSessions_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_RefreshSessions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id)
);

CREATE TABLE ExternalServiceStates (
  Id uniqueidentifier PRIMARY KEY,
  Provider nvarchar(50) NOT NULL,
  StateKey nvarchar(200) NOT NULL,
  PayloadJson nvarchar(max),
  ExpiresAtUtc datetime2,
  NextAllowedRequestUtc datetime2,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_ExternalServiceStates_Provider_Key UNIQUE (Provider, StateKey)
);

CREATE TABLE ServiceRequests (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  RequestNumber nvarchar(50) NOT NULL,
  ItemType nvarchar(100) NOT NULL,
  ItemDescription nvarchar(500) NOT NULL,
  IssueDescription nvarchar(1000) NOT NULL,
  RequestedServiceDate datetime2,
  ServiceMode nvarchar(50) NOT NULL,
  ServiceAddress nvarchar(500) NOT NULL,
  ServiceAddressDetails nvarchar(500),
  ContactName nvarchar(200) NOT NULL,
  ContactPhone nvarchar(50) NOT NULL,
  PreferredScheduleStartUtc datetime2,
  PreferredScheduleEndUtc datetime2,
  NeededByUtc datetime2,
  Priority nvarchar(50) NOT NULL,
  CurrentStatus nvarchar(50) NOT NULL,
  Rating int,
  FeedbackComments nvarchar(1000),
  FeedbackSuggestionCategory nvarchar(80),
  CompletedAtUtc datetime2,
  FeedbackSubmittedAtUtc datetime2,
  FeedbackExpiresAtUtc datetime2,
  CancellationRequestedAtUtc datetime2,
  CancelledAtUtc datetime2,
  CancellationReason nvarchar(500),
  CreatedByUserId uniqueidentifier,
  CreatedByCustomerId uniqueidentifier,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_ServiceRequests_Tenant_RequestNumber UNIQUE (TenantId, RequestNumber),
  CONSTRAINT FK_ServiceRequests_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequests_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_ServiceRequests_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_ServiceRequests_CreatedByCustomer FOREIGN KEY (CreatedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE TenantCostingPolicies (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL UNIQUE,
  TaxLabel nvarchar(80) NOT NULL,
  DefaultTaxRate decimal(6,2) NOT NULL,
  TaxEnabledByDefault bit NOT NULL,
  LoanLateFeeEnabled bit NOT NULL,
  LoanLateFeeGracePeriodDays int NOT NULL,
  LoanLateFeeFlatAmount decimal(12,2) NOT NULL,
  LoanLateFeeRatePercent decimal(6,2) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_TenantCostingPolicies_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE ServiceCostPresets (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Category nvarchar(50) NOT NULL,
  Name nvarchar(160) NOT NULL,
  DefaultSpecification nvarchar(300),
  DefaultQuantity decimal(10,2) NOT NULL,
  DefaultUnitPrice decimal(12,2) NOT NULL,
  IsActive bit NOT NULL,
  SortOrder int NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceCostPresets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE ServiceCostSheets (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL UNIQUE,
  Status nvarchar(50) NOT NULL,
  IsTaxEnabled bit NOT NULL,
  TaxLabel nvarchar(80) NOT NULL,
  TaxRate decimal(6,2) NOT NULL,
  Notes nvarchar(1000),
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  FinalizedAtUtc datetime2,
  CONSTRAINT FK_ServiceCostSheets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceCostSheets_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id)
);

CREATE TABLE ServiceCostLines (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceCostSheetId uniqueidentifier NOT NULL,
  ServiceCostPresetId uniqueidentifier,
  Category nvarchar(50) NOT NULL,
  Name nvarchar(160) NOT NULL,
  Specification nvarchar(300),
  Quantity decimal(10,2) NOT NULL,
  UnitPrice decimal(12,2) NOT NULL,
  SortOrder int NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  UpdatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceCostLines_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceCostLines_ServiceCostSheets FOREIGN KEY (ServiceCostSheetId) REFERENCES ServiceCostSheets(Id),
  CONSTRAINT FK_ServiceCostLines_ServiceCostPresets FOREIGN KEY (ServiceCostPresetId) REFERENCES ServiceCostPresets(Id)
);

CREATE TABLE ServiceRequestAttachments (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  SubmittedByCustomerId uniqueidentifier NOT NULL,
  OriginalFileName nvarchar(260) NOT NULL,
  StoredFileName nvarchar(260) NOT NULL,
  ContentType nvarchar(120) NOT NULL,
  RelativeUrl nvarchar(500) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceRequestAttachments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequestAttachments_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_ServiceRequestAttachments_Customers FOREIGN KEY (SubmittedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE StatusLogs (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  Status nvarchar(50) NOT NULL,
  Remarks nvarchar(1000) NOT NULL,
  ChangedByUserId uniqueidentifier,
  ChangedByCustomerId uniqueidentifier,
  ChangedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_StatusLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_StatusLogs_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_StatusLogs_Users FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_StatusLogs_Customers FOREIGN KEY (ChangedByCustomerId) REFERENCES Customers(Id)
);

CREATE TABLE Assignments (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  AssignedUserId uniqueidentifier NOT NULL,
  AssignedByUserId uniqueidentifier NOT NULL,
  ScheduledStartUtc datetime2,
  ScheduledEndUtc datetime2,
  AssignmentStatus nvarchar(50) NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_Assignments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Assignments_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Assignments_AssignedUser FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_Assignments_AssignedByUser FOREIGN KEY (AssignedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AssignmentEvents (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  AssignmentId uniqueidentifier NOT NULL,
  EventType nvarchar(50) NOT NULL,
  PreviousAssignedUserId uniqueidentifier,
  AssignedUserId uniqueidentifier NOT NULL,
  PreviousScheduledStartUtc datetime2,
  PreviousScheduledEndUtc datetime2,
  ScheduledStartUtc datetime2,
  ScheduledEndUtc datetime2,
  AssignmentStatus nvarchar(50) NOT NULL,
  Remarks nvarchar(1000) NOT NULL,
  ChangedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AssignmentEvents_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AssignmentEvents_Assignments FOREIGN KEY (AssignmentId) REFERENCES Assignments(Id),
  CONSTRAINT FK_AssignmentEvents_PreviousAssignedUser FOREIGN KEY (PreviousAssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_AssignmentEvents_AssignedUser FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_AssignmentEvents_ChangedByUser FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AssignmentEvidence (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  AssignmentId uniqueidentifier NOT NULL,
  SubmittedByUserId uniqueidentifier NOT NULL,
  Note nvarchar(2000) NOT NULL,
  OriginalFileName nvarchar(260),
  StoredFileName nvarchar(260),
  ContentType nvarchar(120),
  RelativeUrl nvarchar(500),
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AssignmentEvidence_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AssignmentEvidence_Assignments FOREIGN KEY (AssignmentId) REFERENCES Assignments(Id),
  CONSTRAINT FK_AssignmentEvidence_SubmittedByUser FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id)
);

CREATE TABLE TenantBillingRecords (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  SubmittedByUserId uniqueidentifier NOT NULL,
  BillingPeriodLabel nvarchar(100) NOT NULL,
  CoverageStartUtc datetime2 NOT NULL,
  CoverageEndUtc datetime2 NOT NULL,
  DueDateUtc datetime2 NOT NULL,
  AmountDue decimal(12,2) NOT NULL,
  AmountSubmitted decimal(12,2) NOT NULL,
  PaymentMethod nvarchar(50) NOT NULL,
  ReferenceNumber nvarchar(100) NOT NULL,
  Status nvarchar(50) NOT NULL,
  Note nvarchar(1000),
  ReviewRemarks nvarchar(1000),
  ProofOriginalFileName nvarchar(260),
  ProofStoredFileName nvarchar(260),
  ProofContentType nvarchar(120),
  ProofRelativeUrl nvarchar(500),
  SubmittedAtUtc datetime2 NOT NULL,
  ReviewedAtUtc datetime2,
  CONSTRAINT FK_TenantBillingRecords_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_TenantBillingRecords_SubmittedByUser FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id)
);

CREATE TABLE Invoices (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier,
  InvoiceNumber nvarchar(50) NOT NULL,
  InvoiceDateUtc datetime2 NOT NULL,
  SubtotalAmount decimal(12,2) NOT NULL,
  TaxAmount decimal(12,2) NOT NULL,
  InterestableAmount decimal(12,2) NOT NULL,
  DiscountAmount decimal(12,2) NOT NULL,
  TotalAmount decimal(12,2) NOT NULL,
  OutstandingAmount decimal(12,2) NOT NULL,
  InvoiceStatus nvarchar(50) NOT NULL,
  LoanApprovalStatus nvarchar(50) NOT NULL,
  LoanApprovalRequestedByUserId uniqueidentifier,
  LoanApprovalRequestedAtUtc datetime2,
  LoanApprovalReviewedByUserId uniqueidentifier,
  LoanApprovalReviewedAtUtc datetime2,
  LoanApprovalRemarks nvarchar(1000),
  CONSTRAINT UQ_Invoices_Tenant_InvoiceNumber UNIQUE (TenantId, InvoiceNumber),
  CONSTRAINT FK_Invoices_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Invoices_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_Invoices_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Invoices_LoanApprovalRequestedByUser FOREIGN KEY (LoanApprovalRequestedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_Invoices_LoanApprovalReviewedByUser FOREIGN KEY (LoanApprovalReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE InvoicePaymentSubmissions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier,
  AmountSubmitted decimal(12,2) NOT NULL,
  ApprovedAmount decimal(12,2),
  PaymentMethod nvarchar(80) NOT NULL,
  ReferenceNumber nvarchar(120) NOT NULL,
  Note nvarchar(1000),
  Status nvarchar(50) NOT NULL,
  ReviewRemarks nvarchar(1000),
  ProofOriginalFileName nvarchar(260),
  ProofStoredFileName nvarchar(260),
  ProofContentType nvarchar(120),
  ProofRelativeUrl nvarchar(500),
  SubmittedAtUtc datetime2 NOT NULL,
  ReviewedByUserId uniqueidentifier,
  ReviewedAtUtc datetime2,
  CONSTRAINT FK_InvoicePaymentSubmissions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_InvoicePaymentSubmissions_ReviewedByUser FOREIGN KEY (ReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE InvoiceLines (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier NOT NULL,
  Category nvarchar(50) NOT NULL,
  Name nvarchar(160) NOT NULL,
  Specification nvarchar(300),
  Description nvarchar(500) NOT NULL,
  Quantity decimal(10,2) NOT NULL,
  UnitPrice decimal(12,2) NOT NULL,
  LineTotal decimal(12,2) NOT NULL,
  SortOrder int NOT NULL,
  CONSTRAINT FK_InvoiceLines_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_InvoiceLines_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id)
);

CREATE TABLE MicroLoans (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier UNIQUE,
  CustomerId uniqueidentifier NOT NULL,
  PrincipalAmount decimal(12,2) NOT NULL,
  AnnualInterestRate decimal(6,2) NOT NULL,
  TermMonths int NOT NULL,
  MonthlyInstallment decimal(12,2) NOT NULL,
  TotalInterestAmount decimal(12,2) NOT NULL,
  TotalRepayableAmount decimal(12,2) NOT NULL,
  LoanStartDate datetime2 NOT NULL,
  MaturityDate datetime2 NOT NULL,
  ReferenceNumber nvarchar(100),
  Remarks nvarchar(1000),
  LoanStatus nvarchar(50) NOT NULL,
  ApprovalStatus nvarchar(50) NOT NULL,
  ApprovalRequestedByUserId uniqueidentifier,
  ApprovalRequestedAtUtc datetime2,
  ApprovalReviewedByUserId uniqueidentifier,
  ApprovalReviewedAtUtc datetime2,
  ApprovalRemarks nvarchar(1000),
  CreatedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_MicroLoans_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_MicroLoans_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_MicroLoans_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_MicroLoans_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_MicroLoans_ApprovalRequestedByUser FOREIGN KEY (ApprovalRequestedByUserId) REFERENCES Users(Id),
  CONSTRAINT FK_MicroLoans_ApprovalReviewedByUser FOREIGN KEY (ApprovalReviewedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AmortizationSchedules (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  MicroLoanId uniqueidentifier NOT NULL,
  InstallmentNumber int NOT NULL,
  DueDate datetime2 NOT NULL,
  BeginningBalance decimal(12,2) NOT NULL,
  PrincipalPortion decimal(12,2) NOT NULL,
  InterestPortion decimal(12,2) NOT NULL,
  InstallmentAmount decimal(12,2) NOT NULL,
  EndingBalance decimal(12,2) NOT NULL,
  PaidAmount decimal(12,2) NOT NULL,
  LateFeeAmount decimal(12,2) NOT NULL,
  LateFeeAppliedAtUtc datetime2,
  InstallmentStatus nvarchar(50) NOT NULL,
  CONSTRAINT UQ_AmortizationSchedules_Loan_Installment UNIQUE (MicroLoanId, InstallmentNumber),
  CONSTRAINT FK_AmortizationSchedules_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AmortizationSchedules_MicroLoans FOREIGN KEY (MicroLoanId) REFERENCES MicroLoans(Id)
);

CREATE TABLE Transactions (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier,
  MicroLoanId uniqueidentifier,
  AmortizationScheduleId uniqueidentifier,
  ReversalOfTransactionId uniqueidentifier,
  TransactionDateUtc datetime2 NOT NULL,
  TransactionType nvarchar(50) NOT NULL,
  ReferenceNumber nvarchar(100) NOT NULL,
  DebitAmount decimal(12,2) NOT NULL,
  CreditAmount decimal(12,2) NOT NULL,
  RunningBalance decimal(12,2) NOT NULL,
  Remarks nvarchar(1000) NOT NULL,
  CreatedByUserId uniqueidentifier NOT NULL,
  CONSTRAINT FK_Transactions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Transactions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_Transactions_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_Transactions_MicroLoans FOREIGN KEY (MicroLoanId) REFERENCES MicroLoans(Id),
  CONSTRAINT FK_Transactions_AmortizationSchedules FOREIGN KEY (AmortizationScheduleId) REFERENCES AmortizationSchedules(Id),
  CONSTRAINT FK_Transactions_Reversal FOREIGN KEY (ReversalOfTransactionId) REFERENCES Transactions(Id),
  CONSTRAINT FK_Transactions_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE AuditEvents (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  Scope nvarchar(50) NOT NULL,
  Category nvarchar(50) NOT NULL,
  ActionType nvarchar(100) NOT NULL,
  Outcome nvarchar(50) NOT NULL,
  ActorUserId uniqueidentifier,
  ActorName nvarchar(200) NOT NULL,
  ActorEmail nvarchar(50) NOT NULL,
  SubjectType nvarchar(100) NOT NULL,
  SubjectId uniqueidentifier,
  SubjectLabel nvarchar(300) NOT NULL,
  Detail nvarchar(1000) NOT NULL,
  IpAddress nvarchar(80),
  UserAgent nvarchar(500),
  OccurredAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AuditEvents_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AuditEvents_ActorUser FOREIGN KEY (ActorUserId) REFERENCES Users(Id)
);
