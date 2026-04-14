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

export function ForbiddenPage() {
  return (
    <PublicShell>
      <PublicHeader />

      <main className="py-10">
        <PublicContainer>
          <PublicSectionHeading
            eyebrow="Access"
            title="Access denied"
            description="Your account is authenticated, but this route is outside the scope of its current role or tenant assignment."
          />

          <PublicCard className="mt-7">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Why this happens</p>
            <strong className="mt-2 block text-lg text-slate-950">Role or tenant mismatch</strong>
            <p className="mt-2 text-slate-600">
              Root users cannot enter tenant-only routes, and tenant users cannot cross into another tenant slug or protected platform areas.
            </p>
          </PublicCard>

          <PublicActionRow>
            <PublicButtonLink to="/" tone="primary">Return home</PublicButtonLink>
            <PublicButtonLink to="/dashboard" tone="ghost">Go to dashboard</PublicButtonLink>
          </PublicActionRow>
        </PublicContainer>
      </main>

      <PublicFooter />
    </PublicShell>
  );
}
