import { PublicFooter } from "@/shared/public/PublicFooter";
import { PublicHeader } from "@/shared/public/PublicHeader";
import {
  PublicActionRow,
  PublicButton,
  PublicButtonLink,
  PublicCard,
  PublicContainer,
  PublicSectionHeading,
  PublicShell
} from "@/shared/public/PublicPrimitives";

export function ErrorPage() {
  return (
    <PublicShell>
      <PublicHeader />

      <main className="py-10">
        <PublicContainer>
          <PublicSectionHeading
            eyebrow="System"
            title="Something went wrong"
            description="The request reached the platform, but the current operation could not be completed safely."
          />

          <PublicCard className="mt-7">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">Next step</p>
            <strong className="mt-2 block text-lg text-slate-950">Retry the operation</strong>
            <p className="mt-2 text-slate-600">
              Refresh the page or return to the last stable route. If the issue persists, inspect the API logs or retry after the current backend task finishes.
            </p>
          </PublicCard>

          <PublicActionRow>
            <PublicButton tone="primary" onClick={() => window.location.reload()}>Reload</PublicButton>
            <PublicButtonLink to="/" tone="ghost">Return home</PublicButtonLink>
          </PublicActionRow>
        </PublicContainer>
      </main>

      <PublicFooter />
    </PublicShell>
  );
}
