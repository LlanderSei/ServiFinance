import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/shared/api/http";

export type CustomerInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  totalAmount: number;
  outstandingAmount: number;
  invoiceStatus: string;
  serviceRequestNumber?: string | null;
};

export function useCustomerInvoices() {
  return useQuery({
    queryKey: ["customer", "invoices"],
    queryFn: () => httpGet<CustomerInvoice[]>("/api/customer-portal/invoices")
  });
}
