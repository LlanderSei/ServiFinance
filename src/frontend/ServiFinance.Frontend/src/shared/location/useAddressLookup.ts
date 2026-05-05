import { useMutation } from "@tanstack/react-query";
import type { AddressLookupResult } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";

type SearchAddressLookupRequest = {
  query: string;
  limit?: number;
};

export function useAddressLookup() {
  return useMutation({
    mutationFn: async ({ query, limit = 5 }: SearchAddressLookupRequest) => {
      const searchParams = new URLSearchParams({
        query,
        limit: String(limit)
      });

      return httpGet<AddressLookupResult[]>(`/api/location/address-search?${searchParams.toString()}`);
    }
  });
}
