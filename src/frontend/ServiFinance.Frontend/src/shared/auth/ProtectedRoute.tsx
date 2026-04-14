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
      <main className="mx-auto grid min-h-screen w-full max-w-5xl place-content-center gap-2 px-6 text-center">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-base-content/60">Session</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-base-content">Loading...</h1>
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
