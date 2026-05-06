import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { PublicButton } from "@/shared/public/PublicPrimitives";

export function RouteErrorPage() {
  const error = useRouteError();
  const message = getRouteErrorMessage(error);
  const isChunkLoadError = isRouteChunkLoadError(message);
  const title = isChunkLoadError
    ? "Refresh to load the latest workspace"
    : "This workspace could not load";
  const description = isChunkLoadError
    ? "The app was likely updated while this browser tab was still open. Reload the page to fetch the newest workspace files."
    : "The route hit an unexpected client-side error. Reload the page or return to the previous screen.";

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(99,146,255,0.2),transparent_28%),linear-gradient(135deg,#f8fbff_0%,#eef3fb_48%,#f7f8fc_100%)] px-5 py-10 text-slate-950">
      <section className="w-full max-w-[34rem] overflow-hidden rounded-[2rem] border border-slate-300/60 bg-white/92 p-6 shadow-[0_24px_70px_rgba(35,46,76,0.16)] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-300 to-blue-700 text-sm font-black text-white shadow-sm">
            SF
          </span>
          <div>
            <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.18em] text-slate-500">ServiFinance</p>
            <p className="m-0 text-sm text-slate-500">Workspace recovery</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.16em] text-blue-700">
            {isChunkLoadError ? "Updated app files" : "Application error"}
          </p>
          <h1 className="mt-2 text-[clamp(2.1rem,5vw,3.4rem)] leading-[0.96] tracking-[-0.06em] text-slate-950">
            {title}
          </h1>
          <p className="mt-4 max-w-[29rem] text-[0.98rem] leading-7 text-slate-600">
            {description}
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <PublicButton tone="primary" className="justify-center" onClick={() => window.location.reload()}>
            Reload page
          </PublicButton>
          <PublicButton className="justify-center" onClick={() => window.history.back()}>
            Go back
          </PublicButton>
        </div>

        <details className="mt-6 rounded-2xl border border-slate-300/60 bg-slate-50/85 px-4 py-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">Technical details</summary>
          <p className="mt-3 break-words font-mono text-xs leading-5 text-slate-500">{message}</p>
        </details>
      </section>
    </main>
  );
}

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "The current page could not be loaded safely.";
}

function isRouteChunkLoadError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("failed to fetch dynamically imported module") ||
    normalizedMessage.includes("loading chunk") ||
    normalizedMessage.includes("importing a module script failed")
  );
}
