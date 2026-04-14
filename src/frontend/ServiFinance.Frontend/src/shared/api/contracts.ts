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

export type TenantOperationalReportsResponse = {
  catalog: TenantReportCatalogRow[];
  dailyActivity: TenantDailyActivitySummary;
  serviceStatusDistribution: TenantServiceStatusDistributionRow[];
  technicianWorkload: TenantTechnicianWorkloadRow[];
  totals: {
    customers: number;
    serviceRequests: number;
    activeAssignments: number;
    completedAssignments: number;
  };
};

export type CurrentSessionUser = {
  userId: string;
  tenantId: string;
  tenantDomainSlug: string;
  email: string;
  fullName: string;
  roles: string[];
  surface: "Root" | "TenantWeb" | "TenantDesktop";
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
