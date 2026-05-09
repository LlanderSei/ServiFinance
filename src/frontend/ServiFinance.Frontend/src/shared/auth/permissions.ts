import type { CurrentSessionUser } from "@/shared/api/contracts";

export const SmsModuleCodes = {
  serviceIntake: "W1_SERVICE_INTAKE",
  staffAccounts: "W2_STAFF_ACCOUNTS",
  scheduling: "W3_SCHEDULING",
  jobUpdates: "W4_JOB_UPDATES",
  invoicing: "W5_INVOICING",
  reports: "W6_REPORTS",
  workforceOverview: "W7_WORKFORCE_OVERVIEW",
  slaEscalations: "W8_SLA_ESCALATIONS",
  feedbackCrm: "W9_FEEDBACK_CRM",
  partsCostControl: "W10_PARTS_COST_CONTROL"
} as const;

export const MlsModuleCodes = {
  serviceLinkedLoans: "D1_SERVICE_LINKED_LOANS",
  standaloneLoans: "D2_STANDALONE_LOANS",
  financialRecords: "D3_FINANCIAL_RECORDS",
  amortization: "D4_AMORTIZATION",
  ledgerReports: "D5_LEDGER_REPORTS",
  auditLogs: "D6_AUDIT_LOGS",
  collectionsQueue: "D7_COLLECTIONS_QUEUE",
  portfolioRiskDashboard: "D8_PORTFOLIO_RISK_DASHBOARD",
  loanApprovalWorkflow: "D9_LOAN_APPROVAL_WORKFLOW",
  financePolicyControl: "D10_FINANCE_POLICY_CONTROL"
} as const;

export type ModuleAccessRequirement = "any" | "full";

export function hasPermission(user: CurrentSessionUser | null | undefined, permissionKey: string) {
  if (!user) {
    return false;
  }

  if (user.permissionKeys?.includes(permissionKey)) {
    return true;
  }

  // Legacy fallback for sessions minted before permission keys were added.
  if (permissionKey.startsWith("root.")) {
    return user.roles.includes("SuperAdmin");
  }

  if (permissionKey.startsWith("sms.") || permissionKey.startsWith("mls.")) {
    return user.roles.includes("Owner") || user.roles.includes("Administrator");
  }

  return false;
}

export function hasModuleAccess(
  user: CurrentSessionUser | null | undefined,
  moduleCode: string,
  requirement: ModuleAccessRequirement = "any",
) {
  if (!user) {
    return false;
  }

  const accessLevel = getModuleAccessLevel(user, moduleCode);
  return requirement === "full"
    ? isFullAccessLevel(accessLevel)
    : isGrantedAccessLevel(accessLevel);
}

export function hasFullModuleAccess(user: CurrentSessionUser | null | undefined, moduleCode: string) {
  return hasModuleAccess(user, moduleCode, "full");
}

export function getModuleAccessLevel(user: CurrentSessionUser | null | undefined, moduleCode: string) {
  if (!user) {
    return null;
  }

  const normalizedModuleCode = moduleCode.toLowerCase();
  return (user.moduleAccess ?? []).find((moduleAccess) =>
    moduleAccess.moduleCode.toLowerCase() === normalizedModuleCode
  )?.accessLevel ?? null;
}

export function isLimitedModuleAccess(user: CurrentSessionUser | null | undefined, moduleCode: string) {
  return normalizeAccessLevel(getModuleAccessLevel(user, moduleCode)) === "limited";
}

export function hasAnyPermission(user: CurrentSessionUser | null | undefined, permissionKeys: string[]) {
  return permissionKeys.some(permissionKey => hasPermission(user, permissionKey));
}

export function hasPermissionAndModule(
  user: CurrentSessionUser | null | undefined,
  permissionKey: string,
  moduleCode?: string,
  requirement: ModuleAccessRequirement = "any",
) {
  return hasPermission(user, permissionKey) && (!moduleCode || hasModuleAccess(user, moduleCode, requirement));
}

function isGrantedAccessLevel(accessLevel: string | null | undefined) {
  const normalized = normalizeAccessLevel(accessLevel);
  return Boolean(normalized) && !["excluded", "none", "not included"].includes(normalized);
}

function isFullAccessLevel(accessLevel: string | null | undefined) {
  return normalizeAccessLevel(accessLevel) === "included";
}

function normalizeAccessLevel(accessLevel: string | null | undefined) {
  return accessLevel?.trim().toLowerCase() ?? "";
}
