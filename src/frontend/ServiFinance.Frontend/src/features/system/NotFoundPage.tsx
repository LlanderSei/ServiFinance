import { Link, useLocation } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="marketing-page">
      <PublicHeader />

      <main className="page">
        <div className="section-heading">
          <p className="eyebrow">Not found</p>
          <h1>That route does not exist</h1>
          <p className="lede">
            The requested path is not part of the current ServiFinance web surface.
          </p>
        </div>

        <article className="surface-card">
          <p className="eyebrow">Requested path</p>
          <strong>{location.pathname || "/"}</strong>
          <p>
            Tenant routes now live under `/t/{'{'}tenantSlug{'}'}/...`, while root platform pages stay under the root domain.
          </p>
        </article>

        <div className="hero__actions" style={{ marginTop: "1.5rem" }}>
          <Link className="button button--primary" to="/">Return home</Link>
          <Link className="button button--ghost" to="/tenants">Open tenants</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
