import type { AuditEventRow } from "@/shared/api/contracts";

export type AuditQueryState = {
  actionType: string;
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
};

export const emptyAuditQueryState: AuditQueryState = {
  actionType: "",
  searchTerm: "",
  dateFrom: "",
  dateTo: ""
};

export function buildAuditQueryString(filters: AuditQueryState) {
  const searchParams = new URLSearchParams();
  if (filters.actionType.trim()) {
    searchParams.set("actionType", filters.actionType.trim());
  }
  if (filters.searchTerm.trim()) {
    searchParams.set("searchTerm", filters.searchTerm.trim());
  }
  if (filters.dateFrom) {
    searchParams.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    searchParams.set("dateTo", filters.dateTo);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function appendAuditQueryString(endpoint: string, filters: AuditQueryState) {
  const queryString = buildAuditQueryString(filters);
  if (!queryString) {
    return endpoint;
  }

  return endpoint.includes("?")
    ? `${endpoint}&${queryString.slice(1)}`
    : `${endpoint}${queryString}`;
}

export function getAuditTone(event: AuditEventRow) {
  if (event.outcome.toLowerCase().includes("fail") || event.outcome.toLowerCase().includes("denied")) {
    return "inactive" as const;
  }

  if (event.category === "Security") {
    return "warning" as const;
  }

  if (event.actionType.toLowerCase().includes("payment") || event.actionType.toLowerCase().includes("loan")) {
    return "active" as const;
  }

  return "progress" as const;
}

export function formatAuditDate(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
