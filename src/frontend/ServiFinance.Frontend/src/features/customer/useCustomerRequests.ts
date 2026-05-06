import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { httpGet, httpPostFormData, httpPostJson } from "@/shared/api/http";

export type CustomerRequest = {
  id: string;
  requestNumber: string;
  itemType: string;
  itemDescription: string;
  issueDescription: string;
  requestedServiceDate?: string | null;
  serviceMode: string;
  serviceAddress: string;
  serviceAddressDetails?: string | null;
  contactName: string;
  contactPhone: string;
  preferredScheduleStartUtc?: string | null;
  preferredScheduleEndUtc?: string | null;
  neededByUtc?: string | null;
  priority: string;
  currentStatus: string;
  createdAtUtc: string;
  rating?: number | null;
  feedbackComments?: string | null;
  feedbackSuggestionCategory?: string | null;
  completedAtUtc?: string | null;
  feedbackSubmittedAtUtc?: string | null;
  feedbackExpiresAtUtc?: string | null;
  cancellationRequestedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  canCancelDirectly: boolean;
  canRequestCancellation: boolean;
};

export type CustomerRequestInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceStatus: string;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  outstandingAmount: number;
  interestableAmount: number;
  invoiceDateUtc: string;
  hasMicroLoan: boolean;
  microLoanStatus?: string | null;
  canSubmitPaymentProof: boolean;
  canStartStripeCheckout: boolean;
  lines: CustomerRequestInvoiceLine[];
  paymentSubmissions: CustomerRequestInvoicePaymentSubmission[];
};

export type CustomerRequestInvoiceLine = {
  id: string;
  category: string;
  name: string;
  specification?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerRequestInvoicePaymentSubmission = {
  id: string;
  amountSubmitted: number;
  approvedAmount?: number | null;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  note?: string | null;
  reviewRemarks?: string | null;
  proofOriginalFileName?: string | null;
  proofRelativeUrl?: string | null;
  submittedAtUtc: string;
  reviewedAtUtc?: string | null;
};

export type CustomerRequestCostLine = {
  id: string;
  category: string;
  name: string;
  specification?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerRequestCostSheet = {
  id: string;
  status: string;
  isTaxEnabled: boolean;
  taxLabel: string;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  updatedAtUtc: string;
  lines: CustomerRequestCostLine[];
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

export type CustomerRequestAttachment = {
  id: string;
  originalFileName: string;
  contentType: string;
  relativeUrl: string;
  createdAtUtc: string;
};

export type CustomerRequestDetailsResponse = {
  request: CustomerRequest & { invoice?: CustomerRequestInvoice | null; costSheet?: CustomerRequestCostSheet | null };
  timeline: CustomerRequestTimelineEntry[];
  assignments: CustomerRequestAssignment[];
  attachments: CustomerRequestAttachment[];
};

export type CustomerRequestNotification = {
  id: string;
  requestId: string;
  requestNumber: string;
  itemType: string;
  status: string;
  remarks: string;
  changedAtUtc: string;
};

export type CustomerRequestNotificationFeed = {
  cursorUtc: string;
  events: CustomerRequestNotification[];
};

export type CreateCustomerRequestPayload = {
  itemType: string;
  itemDescription: string;
  issueDescription: string;
  serviceMode?: string | null;
  serviceAddress?: string | null;
  serviceAddressDetails?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  preferredScheduleStartUtc?: string | null;
  preferredScheduleEndUtc?: string | null;
  neededByUtc?: string | null;
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

export function useCancelCustomerRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      httpPostJson<
        { currentStatus: string; message: string; canCancelDirectly: boolean; canRequestCancellation: boolean },
        { reason: string }
      >(`/api/customer-portal/requests/${id}/cancel`, { reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "requests", variables.id, "details"] });
    }
  });
}

export function useUploadCustomerRequestAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormData }) =>
      httpPostFormData<CustomerRequestAttachment[]>(`/api/customer-portal/requests/${id}/attachments`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "requests", variables.id, "details"] });
    }
  });
}

export function useSubmitCustomerFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, rating, feedbackComments, suggestionCategory }: { id: string; rating: number; feedbackComments?: string; suggestionCategory?: string }) =>
      httpPostJson<void, { rating: number; feedbackComments?: string; suggestionCategory?: string }>(
        `/api/customer-portal/requests/${id}/feedback`,
        { rating, feedbackComments, suggestionCategory }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "requests", variables.id, "details"] });
    }
  });
}

export function fetchCustomerRequestNotifications(sinceUtc?: string | null) {
  const query = sinceUtc
    ? `?sinceUtc=${encodeURIComponent(sinceUtc)}`
    : "";

  return httpGet<CustomerRequestNotificationFeed>(`/api/customer-portal/requests/notifications${query}`);
}
