import { useQuery } from "@tanstack/react-query";
import { SuperadminModuleRow } from "./contracts";
import { httpGet } from "./http";

export function useSuperadminModules() {
  return useQuery({
    queryKey: ["superadmin", "modules"],
    queryFn: () => httpGet<SuperadminModuleRow[]>("/api/superadmin/modules")
  });
}
