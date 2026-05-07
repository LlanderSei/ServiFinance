import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { CurrentSessionUser } from "@/shared/api/contracts";
import { getAuthenticatedHomeRoute } from "./routing";
import { getCurrentSession } from "./session";
import { useRefreshSession } from "./useRefreshSession";
import { AuthenticatedShell } from "./AuthenticatedShell";
import { hasPermission } from "./permissions";

type Props = {
  children?: ReactNode;
  requireRole?: string;
  requireAnyRole?: string[];
  requirePermission?: string;
  tenantSlug?: string;
  requireSurface?: CurrentSessionUser["surface"];
  unauthenticatedRedirectTo?: string;
  unauthorizedRedirectTo?: string;
};

export function ProtectedRoute({
  children,
  requireRole,
  requireAnyRole,
  requirePermission,
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

  if (requireAnyRole && !requireAnyRole.some(role => session.user.roles.includes(role))) {
    return <Navigate to={unauthorizedRedirectTo ?? getAuthenticatedHomeRoute(session.user)} replace />;
  }

  if (tenantSlug && session.user.tenantDomainSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
    return <Navigate to={unauthorizedRedirectTo ?? getAuthenticatedHomeRoute(session.user)} replace />;
  }

  if (requirePermission && !hasPermission(session.user, requirePermission)) {
    return (
      <AuthenticatedShell user={session.user}>
        <main className="grid h-full min-h-0 place-items-center p-6">
          <section className="max-w-xl rounded-[2rem] border border-base-300/70 bg-base-100 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
              Permission required
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-base-content">
              This workspace view is not available for this role.
            </h1>
            <p className="mt-3 text-sm leading-6 text-base-content/68">
              Your account can sign in to this workspace, but the assigned role does not include <span className="font-semibold text-base-content">{requirePermission}</span>. Ask an owner or administrator to update the role before using this screen.
            </p>
          </section>
        </main>
      </AuthenticatedShell>
    );
  }

  return (
    <AuthenticatedShell user={session.user}>
      {children ?? <Outlet />}
    </AuthenticatedShell>
  );
}
