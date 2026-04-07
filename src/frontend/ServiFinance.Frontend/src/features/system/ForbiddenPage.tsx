import { Link } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";

export function ForbiddenPage() {
  return (
    <div className="marketing-page">
      <PublicHeader />

      <main className="page">
        <div className="section-heading">
          <p className="eyebrow">Access</p>
          <h1>Access denied</h1>
          <p className="lede">
            Your account is authenticated, but this route is outside the scope of its current role or tenant assignment.
          </p>
        </div>

        <article className="surface-card">
          <p className="eyebrow">Why this happens</p>
          <strong>Role or tenant mismatch</strong>
          <p>
            Root users cannot enter tenant-only routes, and tenant users cannot cross into another tenant slug or protected platform areas.
          </p>
        </article>

        <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
          <Link className="button button--primary" to="/">Return home</Link>
          <Link className="button button--ghost" to="/dashboard">Go to dashboard</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
