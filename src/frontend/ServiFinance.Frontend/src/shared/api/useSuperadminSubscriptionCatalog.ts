import { useQuery } from "@tanstack/react-query";
import type { SuperadminSubscriptionCatalog } from "./contracts";
import { httpGet } from "./http";

export function useSuperadminSubscriptionCatalog() {
  return useQuery({
    queryKey: ["superadmin", "subscriptions", "catalog"],
    queryFn: () => httpGet<SuperadminSubscriptionCatalog>("/api/superadmin/subscriptions/catalog")
  });
}
