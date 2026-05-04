import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpDelete, httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";

export type CustomerContactOption = {
  id: string;
  label: string;
  contactName: string;
  phoneNumber: string;
  address: string;
  isDefault: boolean;
  createdAtUtc: string;
};

export type CustomerProfile = {
  id: string;
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  contactOptions: CustomerContactOption[];
};

export type UpdateCustomerProfilePayload = {
  fullName: string;
  mobileNumber: string;
  address: string;
};

export type UpsertCustomerContactOptionPayload = {
  label: string;
  contactName: string;
  phoneNumber: string;
  address: string;
  isDefault: boolean;
};

export function useCustomerProfile() {
  return useQuery({
    queryKey: ["customer", "profile"],
    queryFn: () => httpGet<CustomerProfile>("/api/customer-portal/profile")
  });
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateCustomerProfilePayload) =>
      httpPutJson<CustomerProfile, UpdateCustomerProfilePayload>("/api/customer-portal/profile", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
    }
  });
}

export function useSaveCustomerContactOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertCustomerContactOptionPayload }) =>
      id
        ? httpPutJson<CustomerProfile, UpsertCustomerContactOptionPayload>(`/api/customer-portal/profile/contact-options/${id}`, payload)
        : httpPostJson<CustomerProfile, UpsertCustomerContactOptionPayload>("/api/customer-portal/profile/contact-options", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
    }
  });
}

export function useDeleteCustomerContactOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => httpDelete(`/api/customer-portal/profile/contact-options/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
    }
  });
}
