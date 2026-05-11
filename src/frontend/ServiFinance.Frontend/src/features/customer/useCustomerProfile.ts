import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountPasswordChangeResponse,
  AccountSecurityResponse,
  ChangeAccountPasswordRequest
} from "@/shared/api/contracts";
import { httpDelete, httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";

export type CustomerContactOption = {
  id: string;
  label: string;
  contactName: string;
  phoneNumber: string;
  address: string;
  addressDetails: string | null;
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
  addressDetails: string | null;
  contactOptions: CustomerContactOption[];
};

export type UpdateCustomerProfilePayload = {
  fullName: string;
  mobileNumber: string;
  address: string;
  addressDetails: string;
};

export type UpsertCustomerContactOptionPayload = {
  label: string;
  contactName: string;
  phoneNumber: string;
  address: string;
  addressDetails: string;
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

export function useChangeCustomerPassword() {
  return useMutation({
    mutationFn: (payload: ChangeAccountPasswordRequest) =>
      httpPostJson<AccountPasswordChangeResponse, ChangeAccountPasswordRequest>("/api/customer-portal/password", payload)
  });
}

export function useCustomerSecurity() {
  return useQuery({
    queryKey: ["customer", "security"],
    queryFn: () => httpGet<AccountSecurityResponse>("/api/customer-portal/security")
  });
}

export function useEnableCustomerMfa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/customer-portal/mfa/enable", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["customer", "security"], response);
    }
  });
}

export function useDisableCustomerMfa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/customer-portal/mfa/disable", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["customer", "security"], response);
    }
  });
}

export function useUnlinkCustomerGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => httpPostJson<AccountSecurityResponse, Record<string, never>>("/api/customer-portal/google/unlink", {}),
    onSuccess: (response) => {
      queryClient.setQueryData(["customer", "security"], response);
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
