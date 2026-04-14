import { useLocation } from "react-router-dom";
import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicActionRow,
  PublicButtonLink,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell
} from "@/shared/public/PublicPrimitives";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <PublicShell>
      <PublicHeader />

      <main className="py-10">
        <PublicContainer>
          <PublicSectionHeading
            eyebrow="Not found"
            title="That route does not exist"
            description="The requested path is not part of the current ServiFinance web surface."
          />

          <PublicCard className="mt-7">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Requested path</p>
            <strong className="mt-2 block text-lg text-slate-950">{location.pathname || "/"}</strong>
            <p className="mt-2 text-slate-600">
              Tenant routes now live under `/t/{'{'}tenantSlug{'}'}/...`, while root platform pages stay under the root domain.
            </p>
          </PublicCard>

          <PublicActionRow>
            <PublicButtonLink to="/" tone="primary">Return home</PublicButtonLink>
            <PublicButtonLink to="/tenants" tone="ghost">Open tenants</PublicButtonLink>
          </PublicActionRow>
        </PublicContainer>
      </main>

      <PublicFooter />
    </PublicShell>
  );
}
