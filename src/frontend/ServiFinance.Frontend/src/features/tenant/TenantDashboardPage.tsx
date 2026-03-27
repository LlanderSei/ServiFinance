import { useParams } from "react-router-dom";

type Props = {
  system: "sms" | "mls";
};

export function TenantDashboardPage({ system }: Props) {
  const { tenantDomainSlug } = useParams();

  return (
    <main className="page">
      <p className="eyebrow">{tenantDomainSlug} / {system.toUpperCase()}</p>
      <h1>Tenant authenticated dashboard placeholder.</h1>
    </main>
  );
}
