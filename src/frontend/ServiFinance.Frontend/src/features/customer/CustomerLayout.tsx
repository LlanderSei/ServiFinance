import { Outlet, useParams } from "react-router-dom";
import { CustomerShell } from "./CustomerShell";
import { getCurrentCustomerSession } from "./customerAuth";

export function CustomerLayout() {
  const { tenantDomainSlug = "" } = useParams();
  const currentSession = getCurrentCustomerSession();
  const session = currentSession?.tenantDomainSlug.toLowerCase() === tenantDomainSlug.toLowerCase()
    ? currentSession
    : null;

  return (
    <CustomerShell session={session}>
      <Outlet />
    </CustomerShell>
  );
}
