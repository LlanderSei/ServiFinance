import { Link } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";

export function ErrorPage() {
  return (
    <div className="marketing-page">
      <PublicHeader />

      <main className="page">
        <div className="section-heading">
          <p className="eyebrow">System</p>
          <h1>Something went wrong</h1>
          <p className="lede">
            The request reached the platform, but the current operation could not be completed safely.
          </p>
        </div>

        <article className="surface-card">
          <p className="eyebrow">Next step</p>
          <strong>Retry the operation</strong>
          <p>
            Refresh the page or return to the last stable route. If the issue persists, inspect the API logs or retry after the current backend task finishes.
          </p>
        </article>

        <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
          <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link className="button button--ghost" to="/">Return home</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
