import { Navigate, Outlet, useParams } from "react-router-dom";
import { getCurrentCustomerSession } from "./customerAuth";
import { getCustomerHomeRoute } from "./customerNav";
import { getAuthenticatedHomeRoute } from "@/shared/auth/routing";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";

export function CustomerProtectedRoute() {
  const { tenantDomainSlug = "" } = useParams();
  const currentSession = getCurrentCustomerSession();
  const { data, isLoading, isError } = useRefreshSession(!currentSession);
  const session = currentSession ?? data;

  if (!session && isLoading) {
    return (
      <main className="grid min-h-[40vh] place-content-center text-center">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer session</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Loading...</h1>
      </main>
    );
  }

  if (isError || !session) {
    return <Navigate to={`/t/${tenantDomainSlug}/c/login`} replace />;
  }

  if (session.user.surface !== "CustomerWeb") {
    return <Navigate to={getAuthenticatedHomeRoute(session.user)} replace />;
  }

  if (session.user.tenantDomainSlug.toLowerCase() !== tenantDomainSlug.toLowerCase()) {
    return <Navigate to={getCustomerHomeRoute(session.user)} replace />;
  }

  return <Outlet />;
}
