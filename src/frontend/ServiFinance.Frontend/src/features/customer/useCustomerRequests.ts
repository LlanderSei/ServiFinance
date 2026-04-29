import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { httpGet, httpPostJson } from "@/shared/api/http";

export type CustomerRequest = {
  id: string;
  requestNumber: string;
  itemType: string;
  itemDescription: string;
  issueDescription: string;
  priority: string;
  currentStatus: string;
  createdAtUtc: string;
  rating?: number | null;
  feedbackComments?: string | null;
};

export type CreateCustomerRequestPayload = {
  itemType: string;
  itemDescription: string;
  issueDescription: string;
};

export function useCustomerRequests() {
  return useQuery({
    queryKey: ["customer", "requests"],
    queryFn: () => httpGet<CustomerRequest[]>("/api/customer-portal/requests")
  });
}

export function useCreateCustomerRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCustomerRequestPayload) =>
      httpPostJson<{ id: string; requestNumber: string }, CreateCustomerRequestPayload>(
        "/api/customer-portal/requests",
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
    }
  });
}

export function useSubmitCustomerFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, rating, feedbackComments }: { id: string; rating: number; feedbackComments?: string }) =>
      httpPostJson<void, { rating: number; feedbackComments?: string }>(
        `/api/customer-portal/requests/${id}/feedback`,
        { rating, feedbackComments }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
    }
  });
}
