import { useQuery } from "@tanstack/react-query";
import { SubscriptionTierCard } from "./contracts";
import { httpGet } from "./http";

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ["subscription-tiers"],
    queryFn: () => httpGet<SubscriptionTierCard[]>("/api/catalog/subscription-tiers")
  });
}
