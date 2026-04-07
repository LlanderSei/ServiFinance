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
