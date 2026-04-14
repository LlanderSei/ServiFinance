import { useParams } from "react-router-dom";

type Props = {
  system: "sms" | "mls";
};

export function TenantDashboardPage({ system }: Props) {
  const { tenantDomainSlug } = useParams();

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-2 px-6 py-10">
      <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-base-content/60">
        {tenantDomainSlug} / {system.toUpperCase()}
      </p>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-base-content">
        Tenant authenticated dashboard placeholder.
      </h1>
    </main>
  );
}
