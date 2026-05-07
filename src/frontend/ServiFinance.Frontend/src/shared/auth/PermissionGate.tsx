import type { ReactNode } from "react";
import { getCurrentSession } from "./session";
import { useRefreshSession } from "./useRefreshSession";
import { hasPermission } from "./permissions";

type PermissionGateProps = {
  children: ReactNode;
  permissionKey: string;
  title?: string;
};

export function PermissionGate({
  children,
  permissionKey,
  title = "This workspace view is not available for this role."
}: PermissionGateProps) {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const user = (currentSession ?? data)?.user;

  if (!user || hasPermission(user, permissionKey)) {
    return <>{children}</>;
  }

  return (
    <main className="grid h-full min-h-0 place-items-center p-6">
      <section className="max-w-xl rounded-[2rem] border border-base-300/70 bg-base-100 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
          Permission required
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-base-content">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-base-content/68">
          Your account can sign in to this workspace, but the assigned role does not include <span className="font-semibold text-base-content">{permissionKey}</span>. Ask an owner or administrator to update the role before using this screen.
        </p>
      </section>
    </main>
  );
}
