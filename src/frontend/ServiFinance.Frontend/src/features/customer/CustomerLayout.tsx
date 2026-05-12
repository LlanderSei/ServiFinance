import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { CustomerShell } from "./CustomerShell";
import { getCurrentCustomerSession } from "./customerAuth";
import { refreshSession, subscribeToSessionChanges } from "@/shared/auth/session";

function isCustomerSessionForTenant(
  session: ReturnType<typeof getCurrentCustomerSession>,
  tenantDomainSlug: string
) {
  return session?.user.surface === "CustomerWeb"
    && session.user.tenantDomainSlug.toLowerCase() === tenantDomainSlug.toLowerCase();
}

export function CustomerLayout() {
  const { tenantDomainSlug = "" } = useParams();
  const [currentSession, setCurrentSession] = useState(() => getCurrentCustomerSession());
  const [isSessionRestoring, setIsSessionRestoring] = useState(() => !getCurrentCustomerSession());
  const session = isCustomerSessionForTenant(currentSession, tenantDomainSlug)
    ? currentSession!.user
    : null;

  useEffect(() => subscribeToSessionChanges(setCurrentSession), []);

  useEffect(() => {
    let isDisposed = false;
    const storedSession = getCurrentCustomerSession();
    setCurrentSession(storedSession);

    if (storedSession) {
      setIsSessionRestoring(false);
      return () => {
        isDisposed = true;
      };
    }

    setIsSessionRestoring(true);
    void refreshSession()
      .then((refreshedSession) => {
        if (!isDisposed) {
          setCurrentSession(refreshedSession);
        }
      })
      .finally(() => {
        if (!isDisposed) {
          setIsSessionRestoring(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [tenantDomainSlug]);

  return (
    <CustomerShell session={session} isSessionRestoring={isSessionRestoring && !session}>
      <Outlet />
    </CustomerShell>
  );
}
