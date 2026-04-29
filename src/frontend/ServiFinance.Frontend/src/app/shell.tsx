import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { TenantBrandingProvider } from "@/shared/tenant/TenantBrandingProvider";

export function AppShell() {
  return (
    <TenantBrandingProvider>
    <div className="app-shell">
      <Suspense fallback={(
        <main className="grid min-h-screen place-content-center gap-2 px-6 text-center">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-base-content/60">ServiFinance</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-base-content">Loading workspace...</h1>
        </main>
      )}>
        <Outlet />
      </Suspense>
    </div>
    </TenantBrandingProvider>
  );
}