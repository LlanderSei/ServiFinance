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
  monthlyPriceAmount: number;
  currencyCode: string;
  priceDisplay: string;
  billingLabel: string;
  planSummary: string;
  highlightLabel: string;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  modules: SubscriptionTierModuleCard[];
};

export type SuperadminCatalogModule = {
  id: string;
  code: string;
  name: string;
  channel: "Web" | "Desktop" | string;
  summary: string;
  sortOrder: number;
  isActive: boolean;
};

export type SuperadminSubscriptionTierModule = {
  id: string;
  platformModuleId: string;
  moduleCode: string;
  moduleName: string;
  channel: "Web" | "Desktop" | string;
  accessLevel: "Included" | "Limited" | string;
  summary: string;
  sortOrder: number;
  isActive: boolean;
};

export type SuperadminSubscriptionTier = {
  id: string;
  code: string;
  displayName: string;
  businessSizeSegment: "Micro" | "Small" | "Medium" | string;
  subscriptionEdition: "Standard" | "Premium" | string;
  audienceSummary: string;
  description: string;
  monthlyPriceAmount: number;
  currencyCode: string;
  priceDisplay: string;
  billingLabel: string;
  planSummary: string;
  highlightLabel: string;
  sortOrder: number;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  isActive: boolean;
  modules: SuperadminSubscriptionTierModule[];
};

export type SuperadminSubscriptionCatalog = {
  tiers: SuperadminSubscriptionTier[];
  modules: SuperadminCatalogModule[];
};

export type SuperadminSubscriptionRecoverySummary = {
  totalTenantAccounts: number;
  highRiskTenants: number;
  paymentFailedTenants: number;
  dueSoonTenants: number;
  pastDueTenants: number;
  readOnlyRecommendedTenants: number;
  suspensionReviewTenants: number;
  pendingPlanChanges: number;
  cooldownLockedTenants: number;
};

export type SuperadminSubscriptionRecoveryRow = {
  tenantId: string;
  tenantName: string;
  domainSlug: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  isActive: boolean;
  billingProvider: string;
  accountStanding: string;
  suspensionRisk: string;
  recoveryStage: string;
  recoveryStageDescription: string;
  overdueDays: number | null;
  readOnlyRecommendedAtUtc: string | null;
  suspensionReviewAtUtc: string | null;
  nextRenewalDateUtc: string | null;
  expectedRenewalAmount: number | null;
  expectedRenewalCurrencyCode: string | null;
  lastConfirmedCoverageEndUtc: string | null;
  latestBillingStatus: string | null;
  latestBillingAtUtc: string | null;
  pendingReviewCount: number;
  pendingPlanChange: string | null;
  pendingPlanChangeEffectiveAtUtc: string | null;
  cooldownUntilUtc: string | null;
  recommendedAction: string;
};

export type SuperadminSubscriptionRecoveryResponse = {
  summary: SuperadminSubscriptionRecoverySummary;
  rows: SuperadminSubscriptionRecoveryRow[];
};

export type SuperadminSubscriptionRecoveryActionResponse = {
  message: string;
  row: SuperadminSubscriptionRecoveryRow;
};

export type SuperadminSubscriptionTierModuleAssignmentRequest = {
  platformModuleId: string;
  accessLevel: "Included" | "Limited" | "Not Included" | string;
  sortOrder: number;
};

export type UpsertSuperadminSubscriptionTierRequest = {
  code: string;
  displayName: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  audienceSummary: string;
  description: string;
  monthlyPriceAmount: number;
  currencyCode: string;
  billingLabel: string;
  planSummary: string;
  highlightLabel: string;
  sortOrder: number;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  isActive: boolean;
  modules: SuperadminSubscriptionTierModuleAssignmentRequest[];
};

export type CreatePlatformTenantCheckoutRequest = {
  businessName: string;
  domainSlug: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  subscriptionTierId: string;
  captcha?: CaptchaProof | null;
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

export type AddressLookupResult = {
  displayName: string;
  latitude: number;
  longitude: number;
  openStreetMapUrl: string;
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
  addressDetails: string | null;
  createdAtUtc: string;
  serviceRequestCount: number;
};

export type CreateTenantCustomerRequest = {
  fullName: string;
  mobileNumber: string;
  email: string;
  address: string;
  addressDetails: string;
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
  serviceMode: string;
  serviceAddress: string;
  serviceAddressDetails: string | null;
  contactName: string;
  contactPhone: string;
  preferredScheduleStartUtc: string | null;
  preferredScheduleEndUtc: string | null;
  neededByUtc: string | null;
  priority: string;
  currentStatus: string;
  createdAtUtc: string;
  createdByUserName: string;
  rating: number | null;
  feedbackComments: string | null;
  feedbackSuggestionCategory: string | null;
  completedAtUtc: string | null;
  feedbackSubmittedAtUtc: string | null;
  feedbackExpiresAtUtc: string | null;
  cancellationRequestedAtUtc: string | null;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
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
  serviceMode?: string | null;
  serviceAddress?: string | null;
  serviceAddressDetails?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  preferredScheduleStartUtc?: string | null;
  preferredScheduleEndUtc?: string | null;
  neededByUtc?: string | null;
  priority: string;
};

export type FinalizeTenantServiceInvoiceRequest = {
  subtotalAmount: number;
  interestableAmount: number;
  discountAmount: number;
  remarks?: string | null;
};

export type RecordTenantServiceInvoicePaymentRequest = {
  amountReceived: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  note?: string | null;
};

export type UpdateTenantCostingPolicyRequest = {
  taxLabel: string;
  defaultTaxRate: number;
  taxEnabledByDefault: boolean;
};

export type UpsertServiceCostPresetRequest = {
  category: string;
  name: string;
  defaultSpecification?: string | null;
  defaultQuantity: number;
  defaultUnitPrice: number;
  isActive: boolean;
  sortOrder: number;
};

export type SaveTenantServiceCostLineRequest = {
  id?: string | null;
  serviceCostPresetId?: string | null;
  category: string;
  name: string;
  specification?: string | null;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
};

export type SaveTenantServiceCostSheetRequest = {
  isTaxEnabled: boolean;
  taxLabel: string;
  taxRate: number;
  notes?: string | null;
  lines: SaveTenantServiceCostLineRequest[];
};

export type TenantCostingPolicy = {
  id: string;
  taxLabel: string;
  defaultTaxRate: number;
  taxEnabledByDefault: boolean;
  updatedAtUtc: string;
};

export type ServiceCostPreset = {
  id: string;
  category: string;
  name: string;
  defaultSpecification: string | null;
  defaultQuantity: number;
  defaultUnitPrice: number;
  isActive: boolean;
  sortOrder: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ServiceCostLine = {
  id: string;
  serviceCostPresetId: string | null;
  category: string;
  name: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
};

export type ServiceCostSheet = {
  id: string;
  status: string;
  isTaxEnabled: boolean;
  taxLabel: string;
  taxRate: number;
  notes: string | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  finalizedAtUtc: string | null;
  lines: ServiceCostLine[];
};

export type TenantPricingWorkspaceResponse = {
  policy: TenantCostingPolicy;
  presets: ServiceCostPreset[];
  categories: string[];
};

export type TenantServiceRequestAuditRow = {
  id: string;
  status: string;
  remarks: string;
  changedByUserName: string;
  changedAtUtc: string;
};

export type TenantServiceRequestAttachmentRow = {
  id: string;
  originalFileName: string;
  contentType: string;
  relativeUrl: string;
  submittedByCustomerName: string;
  createdAtUtc: string;
};

export type TenantServiceRequestDetailResponse = {
  serviceRequest: TenantServiceRequestRow;
  auditTrail: TenantServiceRequestAuditRow[];
  attachments: TenantServiceRequestAttachmentRow[];
  costSheet: ServiceCostSheet | null;
  costingPolicy: TenantCostingPolicy;
  costPresets: ServiceCostPreset[];
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

export type TenantFeedbackSummary = {
  averageRating: number | null;
  ratedRequests: number;
  pendingFeedback: number;
  expiredFeedback: number;
  lowRatingCount: number;
  suggestionsCount: number;
};

export type TenantFeedbackHighlight = {
  serviceRequestId: string;
  requestNumber: string;
  customerName: string;
  currentStatus: string;
  rating: number | null;
  feedbackComments: string | null;
  suggestionCategory: string | null;
  completedAtUtc: string | null;
  feedbackSubmittedAtUtc: string | null;
  feedbackExpiresAtUtc: string | null;
};

export type TenantSuggestionTheme = {
  category: string;
  count: number;
  averageRating: number;
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
  feedbackSummary: TenantFeedbackSummary;
  feedbackHighlights: TenantFeedbackHighlight[];
  suggestionThemes: TenantSuggestionTheme[];
  totals: {
    customers: number;
    serviceRequests: number;
    activeAssignments: number;
    completedAssignments: number;
  };
};

export type TenantSmsSlaEscalationRow = {
  id: string;
  requestNumber: string;
  customerName: string;
  itemType: string;
  priority: string;
  currentStatus: string;
  targetDateUtc: string | null;
  latestAssignmentStatus: string | null;
  assignedStaff: string | null;
  scheduledStartUtc: string | null;
  scheduledEndUtc: string | null;
  minutesPastDue: number;
  severity: string;
};

export type TenantSmsSlaEscalationsResponse = {
  summary: {
    activeRequests: number;
    overdueRequests: number;
    dueTodayRequests: number;
    unscheduledRequests: number;
    criticalRequests: number;
  };
  rows: TenantSmsSlaEscalationRow[];
};

export type TenantSmsFeedbackCrmRow = {
  id: string;
  requestNumber: string;
  customerName: string;
  itemType: string;
  currentStatus: string;
  rating: number | null;
  feedbackComments: string | null;
  suggestionCategory: string | null;
  completedAtUtc: string | null;
  feedbackSubmittedAtUtc: string | null;
  feedbackExpiresAtUtc: string | null;
  feedbackState: string;
};

export type TenantSmsFeedbackCrmTheme = {
  category: string;
  count: number;
  averageRating: number;
};

export type TenantSmsFeedbackCrmResponse = {
  summary: TenantFeedbackSummary;
  suggestionThemes: TenantSmsFeedbackCrmTheme[];
  rows: TenantSmsFeedbackCrmRow[];
};

export type TenantSmsCostControlRow = {
  id: string;
  requestNumber: string;
  customerName: string;
  itemType: string;
  currentStatus: string;
  completedAtUtc: string | null;
  costSheetStatus: string | null;
  costSubtotal: number;
  costTaxAmount: number;
  costTotal: number;
  costLineCount: number;
  updatedAtUtc: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  invoiceTotalAmount: number | null;
  invoiceOutstandingAmount: number | null;
  needsCosting: boolean;
  needsInvoice: boolean;
};

export type TenantSmsCostControlResponse = {
  policy: {
    taxLabel: string;
    defaultTaxRate: number;
    taxEnabledByDefault: boolean;
  };
  summary: {
    activePresetCount: number;
    draftCostSheets: number;
    finalizedCostSheets: number;
    needsCosting: number;
    needsInvoice: number;
    estimatedCostTotal: number;
  };
  presetCategories: Array<{
    category: string;
    activePresets: number;
    presetCount: number;
  }>;
  categoryTotals: Array<{
    category: string;
    lineCount: number;
    totalAmount: number;
  }>;
  rows: TenantSmsCostControlRow[];
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
  monthlyPriceAmount: number | null;
  currencyCode: string | null;
  priceDisplay: string | null;
  billingLabel: string | null;
  audienceSummary: string | null;
  planSummary: string | null;
  modules: TenantBillingModuleAccessRow[];
};

export type TenantBillingTierOption = {
  id: string;
  code: string;
  displayName: string;
  businessSizeSegment: string;
  subscriptionEdition: string;
  monthlyPriceAmount: number;
  currencyCode: string;
  priceDisplay: string;
  billingLabel: string;
  audienceSummary: string;
  planSummary: string;
  includesServiceManagementWeb: boolean;
  includesMicroLendingDesktop: boolean;
  modules: TenantBillingModuleAccessRow[];
};

export type TenantBillingModuleImpactRow = {
  moduleCode: string;
  moduleName: string;
  channel: string;
  currentAccessLevel: string | null;
  targetAccessLevel: string | null;
};

export type TenantBillingWorkloadImpactRow = {
  moduleCode: string;
  moduleName: string;
  activeWorkCount: number;
  detail: string;
};

export type TenantBillingDowngradeImpact = {
  isDowngrade: boolean;
  lockedModules: TenantBillingModuleImpactRow[];
  workloadWarnings: TenantBillingWorkloadImpactRow[];
  summary: string;
};

export type TenantBillingPendingPlanChange = {
  targetTierId: string;
  targetPlan: string;
  targetEdition: string;
  targetSegment: string;
  changeDirection: string;
  requestedAtUtc: string;
  effectiveAtUtc: string;
  impact: TenantBillingDowngradeImpact;
};

export type TenantBillingChangeControls = {
  canRequestChange: boolean;
  cooldownUntilUtc: string | null;
  blockedReason: string | null;
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
  availableTiers: TenantBillingTierOption[];
  pendingPlanChange: TenantBillingPendingPlanChange | null;
  changeControls: TenantBillingChangeControls;
};

export type TenantBillingPortalSessionResponse = {
  url: string;
};

export type TenantBillingPlanChangeRequest = {
  targetTierId: string;
  confirmDowngrade: boolean;
};

export type TenantBillingPlanChangeResponse = {
  message: string;
  pendingPlanChange: TenantBillingPendingPlanChange;
  impact: TenantBillingDowngradeImpact;
};

export type TenantBillingCancelPlanChangeResponse = {
  message: string;
  cooldownUntilUtc: string;
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
  loanApprovalStatus: string;
  loanApprovalRemarks: string | null;
  loanApprovalRequestedAtUtc: string | null;
  loanApprovalRequestedByUserName: string | null;
  loanApprovalReviewedAtUtc: string | null;
  loanApprovalReviewedByUserName: string | null;
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
  approvalWorkflowRequired: boolean;
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
  lateFeeAmount: number;
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
  mobileNumber: string;
  email: string;
  address: string;
  addressDetails: string | null;
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

export type TenantMlsInvoicePaymentSubmissionRow = {
  submissionId: string;
  invoiceId: string;
  serviceRequestId: string | null;
  serviceRequestNumber: string | null;
  amountSubmitted: number;
  approvedAmount: number | null;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  note: string | null;
  reviewRemarks: string | null;
  proofOriginalFileName: string | null;
  proofRelativeUrl: string | null;
  submittedAtUtc: string;
  reviewedAtUtc: string | null;
  reviewedByUserName: string | null;
};

export type TenantMlsCustomerServiceInvoiceRow = {
  invoiceId: string;
  serviceRequestId: string | null;
  serviceRequestNumber: string | null;
  invoiceNumber: string;
  invoiceDateUtc: string;
  totalAmount: number;
  outstandingAmount: number;
  invoiceStatus: string;
  hasMicroLoan: boolean;
  microLoanStatus: string | null;
  paymentSubmissions: TenantMlsInvoicePaymentSubmissionRow[];
};

export type TenantMlsCustomerFinanceDetailResponse = {
  customer: TenantMlsCustomerFinanceRow;
  loans: TenantMlsLoanAccountRow[];
  ledger: TenantMlsLedgerRow[];
  serviceInvoices: TenantMlsCustomerServiceInvoiceRow[];
};

export type ApproveTenantMlsInvoicePaymentSubmissionRequest = {
  approvedAmount: number;
  reviewRemarks?: string | null;
};

export type RejectTenantMlsInvoicePaymentSubmissionRequest = {
  reviewRemarks: string;
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

export type AccountProfileResponse = {
  userId: string;
  tenantId: string;
  tenantDomainSlug: string;
  email: string;
  fullName: string;
  roles: string[];
  platformScopes: string[];
  surface: "Root" | "TenantWeb" | "TenantDesktop" | "CustomerWeb";
  createdAtUtc: string;
  isActive: boolean;
};

export type UpdateAccountProfileRequest = {
  fullName: string;
};

export type ChangeAccountPasswordRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type AccountPasswordChangeResponse = {
  message: string;
};

export type AccountSecurityResponse = {
  mfaEnabled: boolean;
  surface: string;
  googleConfigured: boolean;
  googleLinked: boolean;
  googleEmail: string | null;
  googleName: string | null;
  googleLinkedAtUtc: string | null;
};

export type TenantBrandingSettingsResponse = {
  tenantId: string;
  tenantDomainSlug: string;
  tenantName: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  headerBackgroundColor: string | null;
  pageBackgroundColor: string | null;
};

export type UpdateTenantBrandingSettingsRequest = {
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  headerBackgroundColor: string | null;
  pageBackgroundColor: string | null;
};

export type RolePermissionDefinition = {
  key: string;
  name: string;
  category: string;
  description: string;
  scope: string;
};

export type RolePermissionRoleRow = {
  id: string;
  name: string;
  description: string;
  platformScope: string;
  rank: number;
  isSystemRole: boolean;
  isPermissionSetLocked: boolean;
  assignedUserCount: number;
  permissionKeys: string[];
  canEditPermissions: boolean;
};

export type RolePermissionWorkspaceResponse = {
  scope: string;
  scopeLabel: string;
  roles: RolePermissionRoleRow[];
  permissions: RolePermissionDefinition[];
  rankPolicy: string;
};

export type UpdateRolePermissionSetRequest = {
  permissionKeys: string[];
};

export type CreateRoleRequest = {
  name: string;
  description: string;
  platformScope: string;
  rank: number;
};

export type UpdateRoleRequest = CreateRoleRequest;

export type RoleUserListItem = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAtUtc: string;
};

export type RoleUsersResponse = {
  roleId: string;
  roleName: string;
  users: RoleUserListItem[];
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

export type TenantMlsPortfolioRiskSummary = {
  activeLoans: number;
  portfolioBalance: number;
  overdueLoans: number;
  overdueBalance: number;
  dueThisWeekBalance: number;
  portfolioAtRiskRate: number;
};

export type TenantMlsPortfolioRiskBucket = {
  label: string;
  loanCount: number;
  outstandingBalance: number;
  overdueAmount: number;
};

export type TenantMlsPortfolioRiskRow = {
  microLoanId: string;
  customerName: string;
  loanLabel: string;
  loanStatus: string;
  outstandingBalance: number;
  overdueAmount: number;
  daysPastDue: number;
  nextDueDate: string | null;
  riskState: string;
};

export type TenantMlsPortfolioRiskResponse = {
  summary: TenantMlsPortfolioRiskSummary;
  agingBuckets: TenantMlsPortfolioRiskBucket[];
  rows: TenantMlsPortfolioRiskRow[];
};

export type TenantMlsLoanApprovalSummary = {
  serviceLinkedCandidates: number;
  standaloneLoansCreated: number;
  needsReview: number;
  blockedCandidates: number;
  averageCandidateAmount: number;
};

export type TenantMlsLoanApprovalRow = {
  candidateId: string;
  candidateKind: string;
  serviceRequestNumber: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  sourceType: string;
  readinessState: string;
  riskFlag: string;
  createdAtUtc: string;
  reason: string;
  canApprove: boolean;
  canReject: boolean;
  requestedByUserName: string | null;
  requestedAtUtc: string | null;
  reviewedByUserName: string | null;
  reviewedAtUtc: string | null;
  reviewRemarks: string | null;
};

export type TenantMlsLoanApprovalWorkspaceResponse = {
  summary: TenantMlsLoanApprovalSummary;
  rows: TenantMlsLoanApprovalRow[];
};

export type TenantMlsFinancePolicySummary = {
  loanCount: number;
  averageInterestRate: number | null;
  minimumInterestRate: number | null;
  maximumInterestRate: number | null;
  averageTermMonths: number;
  policyExceptionCount: number;
};

export type TenantMlsFinancePolicyBand = {
  label: string;
  loanCount: number;
  principalAmount: number;
};

export type TenantMlsFinancePolicyLateFeePolicy = {
  isEnabled: boolean;
  gracePeriodDays: number;
  flatAmount: number;
  ratePercent: number;
  assessedInstallments: number;
  assessedAmount: number;
};

export type TenantMlsFinancePolicyRow = {
  microLoanId: string;
  customerName: string;
  loanLabel: string;
  annualInterestRate: number;
  termMonths: number;
  principalAmount: number;
  loanStatus: string;
  policyState: string;
  createdAtUtc: string;
};

export type TenantMlsFinancePolicyControlResponse = {
  summary: TenantMlsFinancePolicySummary;
  lateFeePolicy: TenantMlsFinancePolicyLateFeePolicy;
  policyBands: TenantMlsFinancePolicyBand[];
  rows: TenantMlsFinancePolicyRow[];
};

export type CurrentSessionModuleAccess = {
  moduleCode: string;
  channel: string;
  accessLevel: string;
};

export type CurrentSessionUser = {
  userId: string;
  tenantId: string;
  tenantDomainSlug: string;
  email: string;
  fullName: string;
  roles: string[];
  platformScopes: string[];
  permissionKeys: string[];
  moduleAccess: CurrentSessionModuleAccess[];
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

export type CaptchaProof = {
  challengeId?: string | null;
  answer?: string | null;
  token?: string | null;
  provider?: string | null;
};

export type PasswordResetStartRequest = {
  surface: "root" | "tenant" | "mls" | "customer" | string;
  tenantDomainSlug?: string | null;
  email: string;
  captcha?: CaptchaProof | null;
};

export type PasswordResetStartResponse = {
  resetId: string;
  message: string;
  expiresAtUtc: string;
  emailDeliveryConfigured: boolean;
  developmentCode: string | null;
};

export type PasswordResetCompleteRequest = {
  resetId: string;
  code: string;
  newPassword: string;
};

export type PasswordResetCompleteResponse = {
  message: string;
};

export type MfaChallengeResponse = {
  isRequired: boolean;
  challengeId: string;
  message: string;
  expiresAtUtc: string;
  developmentCode: string | null;
};
