import { CustomerRequestCard } from "./CustomerRequestCard";
import type { CustomerRequest } from "./useCustomerRequests";

type CustomerRequestsHistoryTabProps = {
  requests: CustomerRequest[];
  tenantDomainSlug: string;
  isLoading: boolean;
};

export function CustomerRequestsHistoryTab({
  requests,
  tenantDomainSlug,
  isLoading
}: CustomerRequestsHistoryTabProps) {
  if (isLoading) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-10 text-center text-slate-500 shadow-[0_12px_28px_rgba(35,46,76,0.06)]">
        Loading requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-slate-500">
        No completed or cancelled requests are in your history yet.
      </div>
    );
  }

  return (
    <section className="grid gap-3">
      {requests.map((request) => (
        <CustomerRequestCard key={request.id} request={request} tenantDomainSlug={tenantDomainSlug} />
      ))}
    </section>
  );
}
