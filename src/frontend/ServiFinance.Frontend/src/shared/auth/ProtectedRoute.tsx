import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRefreshSession } from "./useRefreshSession";
import { AuthenticatedShell } from "./AuthenticatedShell";

type Props = {
  children: ReactNode;
  requireRole?: string;
  tenantSlug?: string;
};

export function ProtectedRoute({ children, requireRole, tenantSlug }: Props) {
  const { data, isLoading, isError } = useRefreshSession(true);

  if (isLoading) {
    return (
      <main className="page">
        <p className="eyebrow">Session</p>
        <h1>Loading...</h1>
      </main>
    );
  }

  if (isError || !data) {
    return <Navigate to={tenantSlug ? `/t/${tenantSlug}/sms/?showLogin=true` : "/?showLogin=true"} replace />;
  }

  if (requireRole && !data.user.roles.includes(requireRole)) {
    return <Navigate to={tenantSlug ? `/t/${tenantSlug}/sms/dashboard` : "/dashboard"} replace />;
  }

  if (tenantSlug && data.user.tenantDomainSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  return <AuthenticatedShell user={data.user}>{children}</AuthenticatedShell>;
}
