import { Navigate, Outlet, useParams } from "react-router-dom";
import { getCurrentCustomerSession } from "./customerAuth";
import { getCustomerHomeRoute } from "./customerNav";

export function CustomerProtectedRoute() {
  const { tenantDomainSlug = "" } = useParams();
  const session = getCurrentCustomerSession();

  if (!session) {
    return <Navigate to={`/t/${tenantDomainSlug}/c/login`} replace />;
  }

  if (session.user.tenantDomainSlug.toLowerCase() !== tenantDomainSlug.toLowerCase()) {
    return <Navigate to={getCustomerHomeRoute(session.user)} replace />;
  }

  return <Outlet />;
}
