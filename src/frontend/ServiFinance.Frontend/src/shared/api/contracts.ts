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
