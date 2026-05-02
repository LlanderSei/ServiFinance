-- ServiFinance ERD import script for dbdiagram.io
-- Last updated: 2026-05-03
-- Implemented tables are listed first.
-- Planned tables inferred from existing docs are listed at the end.

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
  CreatedAtUtc datetime2 NOT NULL,
  IsActive bit NOT NULL
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

CREATE TABLE SubscriptionTiers (
  Id uniqueidentifier PRIMARY KEY,
  Code nvarchar(50) NOT NULL UNIQUE,
  DisplayName nvarchar(100) NOT NULL,
  BusinessSizeSegment nvarchar(50) NOT NULL,
  SubscriptionEdition nvarchar(50) NOT NULL,
  AudienceSummary nvarchar(200) NOT NULL,
  Description nvarchar(1000) NOT NULL,
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
  CONSTRAINT UQ_Roles_Tenant_Name UNIQUE (TenantId, Name),
  CONSTRAINT FK_Roles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
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
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_Customers_Tenant_CustomerCode UNIQUE (TenantId, CustomerCode),
  CONSTRAINT FK_Customers_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
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

CREATE TABLE ServiceRequests (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  RequestNumber nvarchar(50) NOT NULL,
  ItemType nvarchar(100) NOT NULL,
  ItemDescription nvarchar(500) NOT NULL,
  IssueDescription nvarchar(1000) NOT NULL,
  RequestedServiceDate datetime2,
  Priority nvarchar(50) NOT NULL,
  CurrentStatus nvarchar(50) NOT NULL,
  Rating int,
  FeedbackComments nvarchar(1000),
  CreatedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_ServiceRequests_Tenant_RequestNumber UNIQUE (TenantId, RequestNumber),
  CONSTRAINT FK_ServiceRequests_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequests_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_ServiceRequests_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE StatusLogs (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  Status nvarchar(50) NOT NULL,
  Remarks nvarchar(1000) NOT NULL,
  ChangedByUserId uniqueidentifier NOT NULL,
  ChangedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_StatusLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_StatusLogs_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_StatusLogs_Users FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id)
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

CREATE TABLE Invoices (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier,
  InvoiceNumber nvarchar(50) NOT NULL,
  InvoiceDateUtc datetime2 NOT NULL,
  SubtotalAmount decimal(12,2) NOT NULL,
  InterestableAmount decimal(12,2) NOT NULL,
  DiscountAmount decimal(12,2) NOT NULL,
  TotalAmount decimal(12,2) NOT NULL,
  OutstandingAmount decimal(12,2) NOT NULL,
  InvoiceStatus nvarchar(50) NOT NULL,
  CONSTRAINT UQ_Invoices_Tenant_InvoiceNumber UNIQUE (TenantId, InvoiceNumber),
  CONSTRAINT FK_Invoices_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_Invoices_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_Invoices_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id)
);

CREATE TABLE InvoiceLines (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  InvoiceId uniqueidentifier NOT NULL,
  Description nvarchar(500) NOT NULL,
  Quantity decimal(10,2) NOT NULL,
  UnitPrice decimal(12,2) NOT NULL,
  LineTotal decimal(12,2) NOT NULL,
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
  LoanStatus nvarchar(50) NOT NULL,
  CreatedByUserId uniqueidentifier NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_MicroLoans_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_MicroLoans_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
  CONSTRAINT FK_MicroLoans_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_MicroLoans_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
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
  CONSTRAINT FK_Transactions_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

-- Planned tables inferred from docs

CREATE TABLE TenantModuleEntitlements (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  PlatformModuleId uniqueidentifier NOT NULL,
  AccessLevel nvarchar(30) NOT NULL,
  Source nvarchar(30) NOT NULL,
  EffectiveFromUtc datetime2,
  EffectiveToUtc datetime2,
  IsActive bit NOT NULL,
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT UQ_TenantModuleEntitlements_Tenant_Module UNIQUE (TenantId, PlatformModuleId),
  CONSTRAINT FK_TenantModuleEntitlements_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_TenantModuleEntitlements_ModuleCatalog FOREIGN KEY (PlatformModuleId) REFERENCES ModuleCatalog(Id)
);

CREATE TABLE AuditLogs (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  UserId uniqueidentifier NOT NULL,
  ActionType nvarchar(100) NOT NULL,
  EntityName nvarchar(100) NOT NULL,
  EntityId uniqueidentifier,
  Details nvarchar(2000) NOT NULL,
  IpAddress nvarchar(45),
  CreatedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_AuditLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE TABLE CustomerFeedback (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  Rating int NOT NULL,
  FeedbackText nvarchar(1000) NOT NULL,
  SubmittedAtUtc datetime2 NOT NULL,
  Status nvarchar(50) NOT NULL,
  CONSTRAINT FK_CustomerFeedback_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_CustomerFeedback_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
  CONSTRAINT FK_CustomerFeedback_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id)
);

CREATE TABLE ServiceRequestPhotos (
  Id uniqueidentifier PRIMARY KEY,
  TenantId uniqueidentifier NOT NULL,
  ServiceRequestId uniqueidentifier NOT NULL,
  UploadedByUserId uniqueidentifier NOT NULL,
  FileName nvarchar(255) NOT NULL,
  FileUrl nvarchar(500) NOT NULL,
  Caption nvarchar(255),
  UploadedAtUtc datetime2 NOT NULL,
  CONSTRAINT FK_ServiceRequestPhotos_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  CONSTRAINT FK_ServiceRequestPhotos_ServiceRequests FOREIGN KEY (ServiceRequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_ServiceRequestPhotos_Users FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
);
