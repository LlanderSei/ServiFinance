import { useQuery } from "@tanstack/react-query";
import { SuperadminOverviewResponse } from "./contracts";
import { httpGet } from "./http";

export function useSuperadminOverview() {
  return useQuery({
    queryKey: ["superadmin", "overview"],
    queryFn: () => httpGet<SuperadminOverviewResponse>("/api/superadmin/overview")
  });
}
