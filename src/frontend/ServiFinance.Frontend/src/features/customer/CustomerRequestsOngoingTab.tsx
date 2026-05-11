import { CustomerRequestCard } from "./CustomerRequestCard";
import type { CustomerRequest } from "./useCustomerRequests";

type CustomerRequestsOngoingTabProps = {
  requests: CustomerRequest[];
  tenantDomainSlug: string;
  isLoading: boolean;
};

export function CustomerRequestsOngoingTab({
  requests,
  tenantDomainSlug,
  isLoading
}: CustomerRequestsOngoingTabProps) {
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
        You have no ongoing service requests right now.
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
