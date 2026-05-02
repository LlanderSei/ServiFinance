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

export type CustomerRequestInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceStatus: string;
  totalAmount: number;
  outstandingAmount: number;
  invoiceDateUtc: string;
  hasMicroLoan: boolean;
  microLoanStatus?: string | null;
};

export type CustomerRequestTimelineEntry = {
  id: string;
  status: string;
  remarks: string;
  changedAtUtc: string;
  changedByLabel: string;
};

export type CustomerRequestAssignment = {
  id: string;
  assignmentStatus: string;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  createdAtUtc: string;
  assignedUserName: string;
  assignedByUserName: string;
};

export type CustomerRequestDetailsResponse = {
  request: CustomerRequest & {
    requestedServiceDate?: string | null;
    invoice?: CustomerRequestInvoice | null;
  };
  timeline: CustomerRequestTimelineEntry[];
  assignments: CustomerRequestAssignment[];
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

export function useCustomerRequestDetails(requestId: string | null) {
  return useQuery({
    queryKey: ["customer", "requests", requestId, "details"],
    queryFn: () => httpGet<CustomerRequestDetailsResponse>(`/api/customer-portal/requests/${requestId}/details`),
    enabled: Boolean(requestId)
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
