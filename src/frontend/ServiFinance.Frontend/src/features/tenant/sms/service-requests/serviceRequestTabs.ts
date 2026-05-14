import type { TenantServiceRequestRow } from "@/shared/api/contracts";

export type ServiceRequestWorkspaceTab = "new" | "ongoing" | "history";

export type ServiceRequestFilterState = {
  search: string;
  priority: string;
  status: string;
  financeStatus: string;
  feedbackState: string;
  serviceMode: string;
  dateFrom: string;
  dateTo: string;
};

export type ServiceRequestStatusTone = "active" | "inactive" | "warning" | "progress" | "neutral";

export const serviceRequestWorkspaceTabs: Array<{ key: ServiceRequestWorkspaceTab; label: string }> = [
  { key: "new", label: "New" },
  { key: "ongoing", label: "Ongoing" },
  { key: "history", label: "History" }
];

export const emptyServiceRequestFilters: ServiceRequestFilterState = {
  search: "",
  priority: "",
  status: "",
  financeStatus: "",
  feedbackState: "",
  serviceMode: "",
  dateFrom: "",
  dateTo: ""
};

export const baseStatusOptionsByTab: Record<ServiceRequestWorkspaceTab, string[]> = {
  new: ["New"],
  ongoing: ["Scheduled", "In Service", "In Progress", "On Hold", "Cancellation Requested"],
  history: ["Completed", "Closed", "Cancelled", "Abandoned"]
};

export function getServiceRequestWorkspaceTab(request: TenantServiceRequestRow): ServiceRequestWorkspaceTab {
  const normalizedStatus = request.currentStatus.trim().toLowerCase();
  if (["new", "pending", "submitted"].includes(normalizedStatus)) {
    return "new";
  }

  if (["completed", "closed", "cancelled", "abandoned"].includes(normalizedStatus)) {
    return "history";
  }

  return "ongoing";
}

export function serviceRequestMatchesFilters(request: TenantServiceRequestRow, filters: ServiceRequestFilterState) {
  const search = filters.search.trim().toLowerCase();
  if (search) {
    const searchable = [
      request.requestNumber,
      request.customerName,
      request.customerCode,
      request.itemType,
      request.itemDescription,
      request.issueDescription,
      request.currentStatus,
      request.financeHandoffStatus,
      request.invoiceNumber ?? ""
    ].join(" ").toLowerCase();

    if (!searchable.includes(search)) {
      return false;
    }
  }

  if (filters.status && request.currentStatus !== filters.status) {
    return false;
  }

  if (filters.priority && request.priority !== filters.priority) {
    return false;
  }

  if (filters.financeStatus && request.financeHandoffStatus !== filters.financeStatus) {
    return false;
  }

  if (filters.serviceMode && request.serviceMode !== filters.serviceMode) {
    return false;
  }

  if (!matchesFeedbackState(request, filters.feedbackState)) {
    return false;
  }

  return matchesRequestedDateRange(request, filters.dateFrom, filters.dateTo);
}

export function getUniqueOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right));
}

export function formatFeedbackCell(serviceRequest: TenantServiceRequestRow) {
  if (serviceRequest.rating !== null) {
    return `${serviceRequest.rating}/5`;
  }

  if (serviceRequest.feedbackExpiresAtUtc) {
    return new Date(serviceRequest.feedbackExpiresAtUtc).getTime() < Date.now() ? "Expired" : "Pending";
  }

  return "-";
}

export function getFinanceTone(status: string): ServiceRequestStatusTone {
  switch (status) {
    case "Loan created":
    case "Direct settlement completed":
      return "active";
    case "Ready for loan conversion":
    case "Ready for invoicing":
      return "warning";
    case "Customer checkout in progress":
    case "Invoice finalized":
    case "Direct settlement under review":
    case "Direct settlement in progress":
      return "progress";
    default:
      return "neutral";
  }
}

function matchesFeedbackState(request: TenantServiceRequestRow, feedbackState: string) {
  if (!feedbackState) {
    return true;
  }

  const hasRating = request.rating !== null;
  const feedbackExpiresAt = request.feedbackExpiresAtUtc ? new Date(request.feedbackExpiresAtUtc).getTime() : null;
  const isFeedbackOpen = !hasRating && feedbackExpiresAt !== null && feedbackExpiresAt >= Date.now();
  const isFeedbackExpired = !hasRating && feedbackExpiresAt !== null && feedbackExpiresAt < Date.now();

  if (feedbackState === "rated") {
    return hasRating;
  }

  if (feedbackState === "pending") {
    return isFeedbackOpen;
  }

  if (feedbackState === "expired") {
    return isFeedbackExpired;
  }

  if (feedbackState === "none") {
    return !hasRating && feedbackExpiresAt === null;
  }

  return true;
}

function matchesRequestedDateRange(request: TenantServiceRequestRow, dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  if (!request.requestedServiceDate) {
    return false;
  }

  const requestedDate = normalizeDateOnly(request.requestedServiceDate);
  if (dateFrom && requestedDate < dateFrom) {
    return false;
  }

  if (dateTo && requestedDate > dateTo) {
    return false;
  }

  return true;
}

function normalizeDateOnly(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}
