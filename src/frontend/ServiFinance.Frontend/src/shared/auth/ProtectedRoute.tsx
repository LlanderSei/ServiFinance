import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { CurrentSessionUser } from "@/shared/api/contracts";
import { getAuthenticatedHomeRoute } from "./routing";
import { getCurrentSession } from "./session";
import { useRefreshSession } from "./useRefreshSession";
import { AuthenticatedShell } from "./AuthenticatedShell";

type Props = {
  children: ReactNode;
  requireRole?: string;
  tenantSlug?: string;
  requireSurface?: CurrentSessionUser["surface"];
  unauthenticatedRedirectTo?: string;
  unauthorizedRedirectTo?: string;
};

export function ProtectedRoute({
  children,
  requireRole,
  tenantSlug,
  requireSurface,
  unauthenticatedRedirectTo,
  unauthorizedRedirectTo
}: Props) {
  const currentSession = getCurrentSession();
  const { data, isLoading, isError } = useRefreshSession(!currentSession);
  const session = currentSession ?? data;

  if (!session && isLoading) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl place-content-center gap-2 px-6 text-center">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-base-content/60">Session</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-base-content">Loading...</h1>
      </main>
    );
  }

  if (isError || !session) {
    return (
      <Navigate
        to={unauthenticatedRedirectTo ?? (tenantSlug ? `/t/${tenantSlug}/sms/?showLogin=true` : "/?showLogin=true")}
        replace
      />
    );
  }

  if (requireSurface && session.user.surface !== requireSurface) {
    return <Navigate to={unauthorizedRedirectTo ?? getAuthenticatedHomeRoute(session.user)} replace />;
  }

  if (requireRole && !session.user.roles.includes(requireRole)) {
    return <Navigate to={unauthorizedRedirectTo ?? getAuthenticatedHomeRoute(session.user)} replace />;
  }

  if (tenantSlug && session.user.tenantDomainSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
    return <Navigate to={unauthorizedRedirectTo ?? getAuthenticatedHomeRoute(session.user)} replace />;
  }

  return <AuthenticatedShell user={session.user}>{children}</AuthenticatedShell>;
}
