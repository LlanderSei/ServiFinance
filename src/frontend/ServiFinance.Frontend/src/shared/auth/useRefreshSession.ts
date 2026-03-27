import { useQuery } from "@tanstack/react-query";
import { refreshSession } from "./session";

export function useRefreshSession(enabled = true) {
  return useQuery({
    queryKey: ["auth", "refresh"],
    queryFn: async () => {
      const session = await refreshSession();
      if (!session) {
        throw new Error("No active session.");
      }

      return session;
    },
    retry: false,
    enabled
  });
}
