import { useQuery } from "@tanstack/react-query";
import { SuperadminSystemHealthResponse } from "./contracts";
import { httpGet } from "./http";

export function useSuperadminSystemHealth() {
  return useQuery({
    queryKey: ["superadmin", "system-health"],
    queryFn: () => httpGet<SuperadminSystemHealthResponse>("/api/superadmin/system-health")
  });
}
