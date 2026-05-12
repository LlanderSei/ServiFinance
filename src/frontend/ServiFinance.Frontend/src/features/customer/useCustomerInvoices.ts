import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpGet, httpPostFormDataWithProgress, httpPostJson } from "@/shared/api/http";
import type { UploadProgressHandler } from "@/shared/api/http";

export type CustomerInvoicePaymentSubmission = {
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

export type CustomerInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  totalAmount: number;
  outstandingAmount: number;
  invoiceStatus: string;
  serviceRequestId?: string | null;
  serviceRequestNumber?: string | null;
  hasMicroLoan: boolean;
  microLoanStatus?: string | null;
  canSubmitPaymentProof: boolean;
  canStartStripeCheckout: boolean;
  paymentSubmissions: CustomerInvoicePaymentSubmission[];
};

type CustomerInvoiceStripeCheckoutSession = {
  invoiceId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
};

type CustomerInvoiceStripeCheckoutSyncResponse = {
  invoiceId: string;
  invoiceStatus: string;
  outstandingAmount: number;
  paymentApplied: boolean;
};

export function useCustomerInvoices() {
  return useQuery({
    queryKey: ["customer", "invoices"],
    queryFn: () => httpGet<CustomerInvoice[]>("/api/customer-portal/invoices")
  });
}

export function useSubmitCustomerInvoicePaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, payload, onProgress }: { invoiceId: string; serviceRequestId?: string | null; payload: FormData; onProgress?: UploadProgressHandler }) =>
      httpPostFormDataWithProgress<CustomerInvoicePaymentSubmission>(
        `/api/customer-portal/invoices/${invoiceId}/payment-submissions`,
        payload,
        onProgress
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["customer", "invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
      if (variables.serviceRequestId) {
        void queryClient.invalidateQueries({ queryKey: ["customer", "requests", variables.serviceRequestId, "details"] });
      }
    }
  });
}

export function useCreateCustomerInvoiceStripeCheckout() {
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) =>
      httpPostJson<CustomerInvoiceStripeCheckoutSession, Record<string, never>>(
        `/api/customer-portal/invoices/${invoiceId}/stripe-checkout`,
        {}
      )
  });
}

export function useSyncCustomerInvoiceStripeCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, checkoutSessionId }: { invoiceId: string; checkoutSessionId: string }) =>
      httpPostJson<CustomerInvoiceStripeCheckoutSyncResponse, { checkoutSessionId: string }>(
        `/api/customer-portal/invoices/${invoiceId}/stripe-checkout/sync`,
        { checkoutSessionId }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", "invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["customer", "requests"] });
    }
  });
}
