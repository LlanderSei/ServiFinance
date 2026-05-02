export type SubscriptionTierModuleCard = {
  moduleCode: string;
  moduleName: string;
  channel: "Web" | "Desktop";
  accessLevel: "Included" | "Limited" | string;
  summary: string;
};

export type SubscriptionTierCard = {
  id: string;
  code: string;
  displayName: string;
  businessSizeSegment: "Micro" | "Small" | "Medium" | string;
  subscriptionEdition: "Standard" | "Premium" | string;
  audienceSummary: string;
  description: string;
  priceDisplay: string;
  billingLabel: string;
  planSummary: string;
  highlightLabel: string;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  modules: SubscriptionTierModuleCard[];
};

export type CreatePlatformTenantCheckoutRequest = {
  businessName: string;
  domainSlug: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  subscriptionTierId: string;
};

export type CreatePlatformTenantCheckoutResponse = {
  registrationId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
};

export type PlatformTenantRegistrationStatus = {
  registrationId: string;
  status: string;
  businessName: string;
  domainSlug: string;
  ownerEmail: string;
  subscriptionPlan: string;
  subscriptionEdition: string;
  billingProvider: string | null;
  stripeSubscriptionStatus: string | null;
  failureReason: string | null;
  tenantId: string | null;
  tenantLoginUrl: string | null;
  createdAtUtc: string;
  provisionedAtUtc: string | null;
};

export type SuperadminTenantRow = {
  id: string;
  name: string;
  code: string;
  domainSlug: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAtUtc: string;
  isActive: boolean;
};

export type SuperadminModuleRow = {
  id: string;
  code: string;
  name: string;
  channel: "Web" | "Desktop" | string;
  summary: string;
  assignedTierCount: number;
  isActive: boolean;
};

export type SuperadminOverviewWarning = {
  code: string;
  severity: "Info" | "Warning" | "Critical" | string;
  title: string;
  message: string;
};

export type SuperadminOverviewMetric = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  standardTenants: number;
  premiumTenants: number;
};

export type SuperadminOverviewMixRow = {
  businessSizeSegment: string;
  subscriptionEdition: string;
  count: number;
};

export type SuperadminOverviewRecentTenant = {
  id: string;
  name: string;
  domainSlug: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  subscriptionStatus: string;
  createdAtUtc: string;
};

export type SuperadminOverviewResponse = {
  summary: SuperadminOverviewMetric;
  subscriptionMix: SuperadminOverviewMixRow[];
  recentTenants: SuperadminOverviewRecentTenant[];
  warnings: SuperadminOverviewWarning[];
};

export type SuperadminSystemHealthApi = {
  status: string;
  environment: string;
  version: string;
  startedAtUtc: string;
  uptimeMinutes: number;
  buildTimestampUtc: string;
};

export type SuperadminSystemHealthDatabase = {
  status: string;
  canConnect: boolean;
  appliedMigrationCount: number;
  pendingMigrationCount: number;
  latestAppliedMigration: string;
};

export type SuperadminSystemHealthCatalog = {
  activeTierCount: number;
  inactiveTierCount: number;
  activeModuleCount: number;
  inactiveModuleCount: number;
};

export type SuperadminSystemHealthArea = {
  status: string;
  summary: string;
};

export type SuperadminSystemHealthResponse = {
  api: SuperadminSystemHealthApi;
  database: SuperadminSystemHealthDatabase;
  catalog: SuperadminSystemHealthCatalog;
  queues: SuperadminSystemHealthArea;
  hybrid: SuperadminSystemHealthArea;
  warnings: SuperadminOverviewWarning[];
};

export type TenantCustomerRow = {
  id: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  address: string;
  createdAtUtc: string;
  serviceRequestCount: number;
};

export type CreateTenantCustomerRequest = {
  fullName: string;
  mobileNumber: string;
  email: string;
  address: string;
};

export type UpdateTenantCustomerRequest = CreateTenantCustomerRequest;

export type TenantServiceRequestRow = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  requestNumber: string;
  itemType: string;
  itemDescription: string;
  issueDescription: string;
  requestedServiceDate: string | null;
  priority: string;
  currentStatus: string;
  createdAtUtc: string;
  createdByUserName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  invoiceTotalAmount: number | null;
  invoiceOutstandingAmount: number | null;
  interestableAmount: number | null;
  financeHandoffStatus: string;
  canFinalizeInvoice: boolean;
  canConvertToLoan: boolean;
  hasMicroLoan: boolean;
};

export type CreateTenantServiceRequestRequest = {
  customerId: string;
  itemType: string;
  itemDescription: string;
  issueDescription: string;
  requestedServiceDate?: string | null;
  priority: string;
};

export type FinalizeTenantServiceInvoiceRequest = {
  subtotalAmount: number;
  interestableAmount: number;
  discountAmount: number;
  remarks?: string | null;
};

export type TenantServiceRequestAuditRow = {
  id: string;
  status: string;
  remarks: string;
  changedByUserName: string;
  changedAtUtc: string;
};

export type TenantServiceRequestDetailResponse = {
  serviceRequest: TenantServiceRequestRow;
  auditTrail: TenantServiceRequestAuditRow[];
};

export type TenantDispatchAssignmentRow = {
  id: string;
  serviceRequestId: string;
  requestNumber: string;
  customerName: string;
  itemType: string;
  priority: string;
  serviceStatus: string;
  assignedUserId: string;
  assignedUserName: string;
  assignedByUserId: string;
  assignedByUserName: string;
  scheduledStartUtc: string | null;
  scheduledEndUtc: string | null;
  assignmentStatus: string;
  createdAtUtc: string;
  financeHandoffStatus: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  scheduleConflictCount: number;
  canConvertToLoan: boolean;
  hasMicroLoan: boolean;
};

export type TenantDispatchAssignableUser = {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
};

export type TenantDispatchServiceRequestOption = {
  id: string;
  requestNumber: string;
  customerName: string;
  itemType: string;
  priority: string;
  currentStatus: string;
};

export type TenantDispatchMetaResponse = {
  assignableUsers: TenantDispatchAssignableUser[];
  serviceRequests: TenantDispatchServiceRequestOption[];
};

export type CreateTenantAssignmentRequest = {
  serviceRequestId: string;
  assignedUserId: string;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  assignmentStatus: string;
};

export type UpdateTenantAssignmentStatusRequest = {
  assignmentStatus: string;
  serviceStatus?: string | null;
  remarks?: string | null;
};

export type RescheduleTenantAssignmentRequest = {
  assignedUserId: string;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  assignmentStatus: string;
  remarks?: string | null;
};

export type TenantDispatchAssignmentEventRow = {
  id: string;
  eventType: string;
  assignedUserName: string;
  previousAssignedUserName: string | null;
  scheduledStartUtc: string | null;
  scheduledEndUtc: string | null;
  previousScheduledStartUtc: string | null;
  previousScheduledEndUtc: string | null;
  assignmentStatus: string;
  remarks: string;
  changedByUserName: string;
  createdAtUtc: string;
};

export type TenantDispatchAssignmentEvidenceRow = {
  id: string;
  submittedByUserId: string;
  note: string;
  originalFileName: string | null;
  relativeUrl: string | null;
  submittedByUserName: string;
  createdAtUtc: string;
};

export type TenantDispatchConflictRow = {
  assignmentId: string;
  requestNumber: string;
  customerName: string;
  assignedUserName: string;
  scheduledStartUtc: string | null;
  scheduledEndUtc: string | null;
  assignmentStatus: string;
};

export type TenantDispatchAssignmentDetailResponse = {
  assignment: TenantDispatchAssignmentRow;
  auditTrail: TenantServiceRequestAuditRow[];
  events: TenantDispatchAssignmentEventRow[];
  evidence: TenantDispatchAssignmentEvidenceRow[];
  conflicts: TenantDispatchConflictRow[];
};

export type UpdateTenantAssignmentEvidenceRequest = {
  note: string;
};

export type TenantReportCatalogRow = {
  key: string;
  title: string;
  scope: string;
  freshness: string;
  owner: string;
  description: string;
};

export type TenantDailyActivitySummary = {
  newCustomersToday: number;
  newRequestsToday: number;
  assignmentsScheduledToday: number;
  assignmentsCompletedToday: number;
};

export type TenantServiceStatusDistributionRow = {
  status: string;
  count: number;
};

export type TenantTechnicianWorkloadRow = {
  userId: string;
  fullName: string;
  activeAssignments: number;
  scheduledAssignments: number;
  completedAssignments: number;
};

export type TenantReportWindow = {
  dateFromUtc: string;
  dateToUtc: string;
  previousDateFromUtc: string;
  previousDateToUtc: string;
  dayCount: number;
};

export type TenantReportWindowActivity = {
  newCustomers: number;
  newRequests: number;
  assignmentsScheduled: number;
  assignmentsCompleted: number;
  completedRequests: number;
  invoicesFinalized: number;
};

export type TenantReportComparisonMetric = {
  key: string;
  label: string;
  currentValue: number;
  previousValue: number;
  deltaValue: number;
  deltaPercentage: number | null;
};

export type TenantReportTurnaround = {
  completedRequests: number;
  averageIntakeToCompletionHours: number | null;
  averageRequestToScheduleHours: number | null;
  averageScheduledWorkHours: number | null;
  overdueOpenRequests: number;
};

export type TenantOperationalReportsResponse = {
  catalog: TenantReportCatalogRow[];
  dailyActivity: TenantDailyActivitySummary;
  serviceStatusDistribution: TenantServiceStatusDistributionRow[];
  technicianWorkload: TenantTechnicianWorkloadRow[];
  reportingWindow: TenantReportWindow;
  windowedActivity: TenantReportWindowActivity;
  comparison: TenantReportComparisonMetric[];
  turnaround: TenantReportTurnaround;
  totals: {
    customers: number;
    serviceRequests: number;
    activeAssignments: number;
    completedAssignments: number;
  };
};

export type TenantBillingModuleAccessRow = {
  moduleCode: string;
  moduleName: string;
  channel: string;
  accessLevel: string;
};

export type TenantBillingPlanSummary = {
  businessSizeSegment: string;
  subscriptionEdition: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  priceDisplay: string | null;
  billingLabel: string | null;
  audienceSummary: string | null;
  planSummary: string | null;
  modules: TenantBillingModuleAccessRow[];
};

export type TenantBillingStanding = {
  accountStanding: string;
  suspensionRisk: string;
  billingProvider: string;
  nextRenewalDateUtc: string | null;
  expectedRenewalAmount: number | null;
  latestSubmissionAtUtc: string | null;
  latestSubmissionStatus: string | null;
  lastConfirmedCoverageEndUtc: string | null;
  pendingReviewCount: number;
  canSubmitRenewalProof: boolean;
  canOpenBillingPortal: boolean;
};

export type TenantBillingRecordRow = {
  id: string;
  billingPeriodLabel: string;
  coverageStartUtc: string;
  coverageEndUtc: string;
  dueDateUtc: string;
  amountDue: number;
  amountSubmitted: number;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  note: string | null;
  reviewRemarks: string | null;
  proofOriginalFileName: string | null;
  proofRelativeUrl: string | null;
  submittedByUserName: string;
  submittedAtUtc: string;
  reviewedAtUtc: string | null;
};

export type TenantBillingOverviewResponse = {
  plan: TenantBillingPlanSummary;
  standing: TenantBillingStanding;
  history: TenantBillingRecordRow[];
};

export type TenantBillingPortalSessionResponse = {
  url: string;
};

export type TenantMlsDashboardSummary = {
  financeReadyInvoices: number;
  convertedLoans: number;
  finalizedInvoices: number;
  ledgerEntries: number;
  readyOutstandingAmount: number;
  activeLoanPrincipalAmount: number;
};

export type TenantMlsFinanceQueueRow = {
  invoiceId: string;
  serviceRequestId: string | null;
  customerId: string;
  customerName: string;
  requestNumber: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  outstandingAmount: number;
  interestableAmount: number;
  financeHandoffStatus: string;
  hasMicroLoan: boolean;
};

export type TenantMlsLoanRow = {
  microLoanId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  principalAmount: number;
  totalRepayableAmount: number;
  loanStatus: string;
  createdAtUtc: string;
};

export type TenantMlsHandoffDistributionRow = {
  label: string;
  count: number;
};

export type TenantMlsDashboardResponse = {
  summary: TenantMlsDashboardSummary;
  financeQueue: TenantMlsFinanceQueueRow[];
  recentLoans: TenantMlsLoanRow[];
  handoffDistribution: TenantMlsHandoffDistributionRow[];
};

export type TenantMlsLoanConversionCandidate = {
  invoiceId: string;
  serviceRequestId: string | null;
  customerId: string;
  customerName: string;
  requestNumber: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  outstandingAmount: number;
  interestableAmount: number;
};

export type TenantMlsLoanConversionSummary = {
  principalAmount: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  totalInterestAmount: number;
  totalRepayableAmount: number;
  loanStartDate: string;
  maturityDate: string;
};

export type TenantMlsAmortizationScheduleRow = {
  installmentNumber: number;
  dueDate: string;
  beginningBalance: number;
  principalPortion: number;
  interestPortion: number;
  installmentAmount: number;
  endingBalance: number;
};

export type TenantMlsLoanConversionWorkspaceResponse = {
  candidates: TenantMlsLoanConversionCandidate[];
};

export type TenantMlsLoanConversionPreviewResponse = {
  invoice: TenantMlsLoanConversionCandidate;
  summary: TenantMlsLoanConversionSummary;
  schedule: TenantMlsAmortizationScheduleRow[];
};

export type TenantMlsLoanCreatedResponse = {
  microLoanId: string;
  invoiceNumber: string;
  customerName: string;
  summary: TenantMlsLoanConversionSummary;
};

export type TenantMlsLoanAccountRow = {
  microLoanId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaidAmount: number;
  outstandingBalance: number;
  pendingInstallments: number;
  nextDueDate: string | null;
  loanStatus: string;
  createdAtUtc: string;
};

export type TenantMlsLoanAccountsWorkspaceResponse = {
  loans: TenantMlsLoanAccountRow[];
};

export type TenantMlsLoanLedgerRow = {
  transactionId: string;
  transactionDateUtc: string;
  transactionType: string;
  referenceNumber: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  remarks: string;
  canReverse: boolean;
};

export type TenantMlsLoanDetailResponse = {
  loan: TenantMlsLoanAccountRow;
  schedule: TenantMlsAmortizationScheduleRow[];
  ledger: TenantMlsLoanLedgerRow[];
};

export type TenantMlsLoanPaymentPostedResponse = {
  microLoanId: string;
  amountApplied: number;
  outstandingBalance: number;
  remainingInstallments: number;
  loanStatus: string;
};

export type TenantMlsLoanPaymentReversedResponse = {
  microLoanId: string;
  reversedTransactionId: string;
  amountReversed: number;
  outstandingBalance: number;
  remainingInstallments: number;
  loanStatus: string;
};

export type TenantMlsCollectionsSummary = {
  overdueInstallments: number;
  dueTodayInstallments: number;
  dueThisWeekInstallments: number;
  overdueBalance: number;
  dueThisWeekBalance: number;
};

export type TenantMlsCollectionRow = {
  microLoanId: string;
  customerId: string;
  customerName: string;
  loanLabel: string;
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysPastDue: number;
  collectionState: string;
  loanStatus: string;
};

export type TenantMlsCollectionsWorkspaceResponse = {
  summary: TenantMlsCollectionsSummary;
  entries: TenantMlsCollectionRow[];
};

export type TenantMlsCustomerFinanceSummary = {
  totalBorrowers: number;
  activeBorrowers: number;
  outstandingPortfolioBalance: number;
  totalCollectedAmount: number;
};

export type TenantMlsCustomerFinanceRow = {
  customerId: string;
  customerCode: string;
  customerName: string;
  activeLoanCount: number;
  settledLoanCount: number;
  outstandingBalance: number;
  totalCollectedAmount: number;
  nextDueDate: string | null;
  lastPaymentDateUtc: string | null;
};

export type TenantMlsCustomerFinanceWorkspaceResponse = {
  summary: TenantMlsCustomerFinanceSummary;
  customers: TenantMlsCustomerFinanceRow[];
};

export type TenantMlsCustomerFinanceDetailResponse = {
  customer: TenantMlsCustomerFinanceRow;
  loans: TenantMlsLoanAccountRow[];
  ledger: TenantMlsLedgerRow[];
};

export type TenantMlsAuditSummary = {
  totalEvents: number;
  loanCreationEvents: number;
  standaloneLoanEvents: number;
  paymentEvents: number;
  paymentReversalEvents: number;
};

export type TenantMlsAuditRow = {
  eventId: string;
  occurredAtUtc: string;
  actionType: string;
  actorName: string;
  customerName: string;
  subjectLabel: string;
  referenceLabel: string;
  detail: string;
};

export type TenantMlsAuditWorkspaceResponse = {
  summary: TenantMlsAuditSummary;
  events: TenantMlsAuditRow[];
};

export type AuditSummary = {
  totalEvents: number;
  systemEvents: number;
  securityEvents: number;
  failedEvents: number;
};

export type AuditEventRow = {
  eventId: string;
  occurredAtUtc: string;
  scope: string;
  category: string;
  actionType: string;
  outcome: string;
  actorName: string;
  actorEmail: string;
  subjectType: string;
  subjectLabel: string;
  detail: string;
  ipAddress: string | null;
};

export type AuditWorkspaceResponse = {
  summary: AuditSummary;
  events: AuditEventRow[];
};

export type TenantMlsStandaloneLoanCustomer = {
  customerId: string;
  customerCode: string;
  customerName: string;
};

export type TenantMlsStandaloneLoanWorkspaceResponse = {
  customers: TenantMlsStandaloneLoanCustomer[];
};

export type TenantMlsStandaloneLoanPreviewResponse = {
  customer: TenantMlsStandaloneLoanCustomer;
  summary: TenantMlsLoanConversionSummary;
  schedule: TenantMlsAmortizationScheduleRow[];
};

export type TenantMlsStandaloneLoanCreatedResponse = {
  microLoanId: string;
  customerName: string;
  summary: TenantMlsLoanConversionSummary;
};

export type TenantMlsLedgerSummary = {
  totalEntries: number;
  totalLoanDisbursed: number;
  totalCollections: number;
  currentRunningBalance: number;
};

export type TenantMlsLedgerRow = {
  transactionId: string;
  transactionDateUtc: string;
  transactionType: string;
  referenceNumber: string;
  customerName: string;
  loanLabel: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  remarks: string;
};

export type TenantMlsLedgerWorkspaceResponse = {
  summary: TenantMlsLedgerSummary;
  entries: TenantMlsLedgerRow[];
};

export type TenantMlsReportsWindow = {
  rangeDays: number;
  dateFromUtc: string;
  dateToUtc: string;
};

export type TenantMlsReportsSummary = {
  activeLoans: number;
  outstandingPortfolioBalance: number;
  collectionsInWindow: number;
  paymentCountInWindow: number;
  loanDisbursedInWindow: number;
  overdueBalance: number;
};

export type TenantMlsReportsAgingBucketRow = {
  label: string;
  loanCount: number;
  installmentCount: number;
  outstandingAmount: number;
};

export type TenantMlsReportsTrendRow = {
  periodLabel: string;
  collectedAmount: number;
  paymentCount: number;
};

export type TenantMlsReportsTransactionMixRow = {
  transactionType: string;
  count: number;
  totalAmount: number;
};

export type TenantMlsReportsBorrowerRow = {
  customerId: string;
  customerName: string;
  activeLoanCount: number;
  outstandingBalance: number;
  nextDueDate: string | null;
};

export type TenantMlsReportsWorkspaceResponse = {
  window: TenantMlsReportsWindow;
  summary: TenantMlsReportsSummary;
  agingBuckets: TenantMlsReportsAgingBucketRow[];
  collectionTrend: TenantMlsReportsTrendRow[];
  transactionMix: TenantMlsReportsTransactionMixRow[];
  topBorrowers: TenantMlsReportsBorrowerRow[];
};

export type CurrentSessionUser = {
  userId: string;
  tenantId: string;
  tenantDomainSlug: string;
  email: string;
  fullName: string;
  roles: string[];
  surface: "Root" | "TenantWeb" | "TenantDesktop" | "CustomerWeb";
};

export type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
};

export type AuthSessionResponse = {
  tokens: AuthSessionTokens;
  user: CurrentSessionUser;
};
