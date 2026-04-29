import { Outlet } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useTenantDomainValidation } from "./useTenantDomainValidation";

export function TenantDomainGuard() {
  const { tenantDomainSlug = "" } = useParams();
  const { isLoading, exists } = useTenantDomainValidation();

  if (isLoading) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl place-content-center gap-3 px-6 text-center">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-slate-500">Checking tenant domain</p>
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">Validating domain...</h1>
      </main>
    );
  }

  if (!exists) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl place-content-center gap-6 px-6 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Domain Unavailable</p>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-900">
            "{tenantDomainSlug}" is not registered
          </h1>
          <p className="mt-3 text-base text-slate-500 max-w-md mx-auto">
            This tenant domain does not exist or is no longer active.
            Check the address and try again, or contact support if you believe this is an error.
          </p>
        </div>
        <a
          href="/"
          className="inline-flex mx-auto items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Return to home page
        </a>
      </main>
    );
  }

  return <Outlet />;
}