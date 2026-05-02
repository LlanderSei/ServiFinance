import { useState } from "react";
import { useParams } from "react-router-dom";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { SecurityAudits } from "./SecurityAudits";
import { SystemAudits } from "./SystemAudits";

type AuditScope = "superadmin" | "tenant-sms" | "tenant-mls";

type AuditsPageProps = {
  scope: AuditScope;
};

const auditTabs = [
  { key: "system", label: "System" },
  { key: "security", label: "Security" }
];

export function PlatformAuditsPage() {
  return <AuditsPage scope="superadmin" />;
}

export function TenantSmsAuditsPage() {
  return <AuditsPage scope="tenant-sms" />;
}

export function TenantMlsAuditsPage() {
  return <AuditsPage scope="tenant-mls" />;
}

function AuditsPage({ scope }: AuditsPageProps) {
  const { tenantDomainSlug = "" } = useParams();
  const session = getCurrentSession();
  const [activeTab, setActiveTab] = useState("system");
  const resolvedTenantSlug = scope === "tenant-mls"
    ? session?.user.tenantDomainSlug ?? ""
    : tenantDomainSlug;
  const endpoints = resolveAuditEndpoints(scope, resolvedTenantSlug);
  const scopeLabel = resolveScopeLabel(scope, resolvedTenantSlug);

  return (
    <RecordWorkspace
      breadcrumbs={resolveBreadcrumbs(scope, resolvedTenantSlug)}
      title="Audits"
      description="Review scoped system activity and security events without mixing platform, SMS, and MLS audit streams."
      headerBottom={(
        <WorkspaceTopTabs tabs={auditTabs} activeTab={activeTab} onChange={setActiveTab} />
      )}
    >
      <RecordContentStack>
        {activeTab === "security" ? (
          <SecurityAudits endpoint={endpoints.security} scopeLabel={scopeLabel} />
        ) : (
          <SystemAudits endpoint={endpoints.system} scopeLabel={scopeLabel} />
        )}
      </RecordContentStack>
    </RecordWorkspace>
  );
}

function resolveAuditEndpoints(scope: AuditScope, tenantDomainSlug: string) {
  if (scope === "superadmin") {
    return {
      system: "/api/platform/audits/system",
      security: "/api/platform/audits/security"
    };
  }

  const moduleScope = scope === "tenant-mls" ? "mls" : "sms";
  return {
    system: `/api/tenants/${tenantDomainSlug}/audits/system?scope=${moduleScope}`,
    security: `/api/tenants/${tenantDomainSlug}/audits/security?scope=${moduleScope}`
  };
}

function resolveScopeLabel(scope: AuditScope, tenantDomainSlug: string) {
  if (scope === "superadmin") {
    return "Superadmin";
  }

  if (scope === "tenant-mls") {
    return `${tenantDomainSlug} MLS`;
  }

  return `${tenantDomainSlug} SMS`;
}

function resolveBreadcrumbs(scope: AuditScope, tenantDomainSlug: string) {
  if (scope === "superadmin") {
    return "ServiFinance / Administration / Audits";
  }

  if (scope === "tenant-mls") {
    return `${tenantDomainSlug} / MLS / Administration / Audits`;
  }

  return `${tenantDomainSlug} / SMS / Administration / Audits`;
}
