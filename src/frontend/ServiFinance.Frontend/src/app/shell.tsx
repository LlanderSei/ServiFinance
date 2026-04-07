import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <Suspense fallback={(
        <main className="shell-loading">
          <p className="eyebrow">ServiFinance</p>
          <h1>Loading workspace...</h1>
        </main>
      )}>
        <Outlet />
      </Suspense>
    </div>
  );
}
