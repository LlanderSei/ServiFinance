import { PublicContainer } from "@/shared/public/PublicPrimitives";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-900/8 py-8 text-[rgba(20,24,39,0.72)]">
      <PublicContainer className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">ServiFinance</p>
          <strong className="text-slate-950">Service management and micro-lending under one tenant identity.</strong>
        </div>
        <div className="grid gap-1 text-left md:text-right">
          <span>Root SaaS control plane</span>
          <span>Tenant SMS + MLS delivery</span>
        </div>
      </PublicContainer>
    </footer>
  );
}
