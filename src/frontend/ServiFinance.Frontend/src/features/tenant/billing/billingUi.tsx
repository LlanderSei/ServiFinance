import type {
  TenantBillingDowngradeImpact,
  TenantBillingOverviewResponse
} from "@/shared/api/contracts";
import { WorkspaceInlineNote } from "@/shared/records/WorkspaceControls";

export type BillingStatusTone = "active" | "inactive" | "warning" | "progress" | "neutral";

export function ImpactSummary({ impact }: { impact: TenantBillingDowngradeImpact }) {
  return (
    <div className="grid gap-3">
      <WorkspaceInlineNote
        className={
          impact.isDowngrade
            ? "rounded-box border border-warning/30 bg-warning/12 px-4 py-3 text-warning"
            : "rounded-box border border-success/25 bg-success/10 px-4 py-3 text-success"
        }
      >
        {impact.summary}
      </WorkspaceInlineNote>

      {impact.lockedModules.length ? (
        <div className="grid gap-2">
          <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-base-content/60">
            Modules affected after renewal
          </p>
          <div className="grid gap-2">
            {impact.lockedModules.map((module) => (
              <div key={module.moduleCode} className="rounded-box border border-base-300/70 bg-base-100/80 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{module.moduleName}</strong>
                  <span className="text-xs text-base-content/55">{module.channel}</span>
                </div>
                <p className="mt-1 text-xs text-base-content/65">
                  {formatAccess(module.currentAccessLevel)} to {formatAccess(module.targetAccessLevel)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {impact.workloadWarnings.length ? (
        <div className="grid gap-2">
          <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-base-content/60">
            Work to clean up before renewal
          </p>
          {impact.workloadWarnings.map((warning) => (
            <div
              key={`${warning.moduleCode}-${warning.detail}`}
              className="rounded-box border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-base-content"
            >
              <strong>{warning.activeWorkCount} active</strong>
              <p className="mt-1 text-base-content/68">{warning.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function buildClientPlanImpact(
  overview: TenantBillingOverviewResponse,
  targetTier: TenantBillingOverviewResponse["availableTiers"][number]
): TenantBillingDowngradeImpact {
  const targetModules = new Map(targetTier.modules.map((module) => [module.moduleCode, module]));
  const lockedModules = overview.plan.modules
    .map((module) => {
      const targetModule = targetModules.get(module.moduleCode);
      return {
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        channel: module.channel,
        currentAccessLevel: module.accessLevel,
        targetAccessLevel: targetModule?.accessLevel ?? null
      };
    })
    .filter((module) => getAccessRank(module.targetAccessLevel) < getAccessRank(module.currentAccessLevel));
  const isDowngrade = targetTier.monthlyPriceAmount < (overview.plan.monthlyPriceAmount ?? 0) ||
    lockedModules.length > 0;

  return {
    isDowngrade,
    lockedModules,
    workloadWarnings: [],
    summary: isDowngrade
      ? `This switch may reduce access to ${lockedModules.length} module(s). The server will also validate active task impact before scheduling.`
      : "This switch does not reduce module access based on the current catalog."
  };
}

export function isCurrentTier(tierName: string, currentTierName?: string | null) {
  return tierName === currentTierName;
}

export function buildRenewalWarning(value?: string | null, isAutorenewalManaged = false, billingProvider = "Manual") {
  if (!value) {
    return null;
  }

  const renewalDate = new Date(value);
  if (Number.isNaN(renewalDate.valueOf())) {
    return null;
  }

  const millisecondsUntilRenewal = renewalDate.getTime() - Date.now();
  const daysUntilRenewal = Math.ceil(millisecondsUntilRenewal / 86_400_000);

  if (daysUntilRenewal < 0) {
    return isAutorenewalManaged
      ? `${billingProvider} renewal checkpoint passed on ${formatDate(value)}. Check provider billing history if access did not update.`
      : `Renewal checkpoint passed on ${formatDate(value)}. Connect online billing because manual renewal proof is no longer accepted here.`;
  }

  if (daysUntilRenewal <= 7) {
    return isAutorenewalManaged
      ? `${billingProvider} will auto-renew this tenant on ${formatDate(value)}. Review the payment method before the cycle closes.`
      : `Renewal is due on ${formatDate(value)}. Connect an online billing provider before this cycle because manual proof submission is no longer available.`;
  }

  return null;
}

export function getStandingTone(accountStanding: string): BillingStatusTone {
  if (accountStanding === "Suspended") {
    return "inactive";
  }

  if (accountStanding === "Renewal overdue" || accountStanding === "Renewal due soon" || accountStanding === "Payment failed") {
    return "warning";
  }

  if (accountStanding === "Awaiting billing review") {
    return "progress";
  }

  return "active";
}

export function getRiskTone(risk: string): BillingStatusTone {
  if (risk === "High") {
    return "inactive";
  }

  if (risk === "Medium") {
    return "warning";
  }

  return "active";
}

export function getBillingStatusTone(status: string): BillingStatusTone {
  if (status === "Confirmed") {
    return "active";
  }

  if (status === "Rejected") {
    return "inactive";
  }

  if (status === "Pending Review") {
    return "progress";
  }

  return "neutral";
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getAccessRank(accessLevel?: string | null) {
  if (!accessLevel || ["Excluded", "None", "Not Included"].includes(accessLevel)) {
    return 0;
  }

  return accessLevel === "Included" ? 2 : 1;
}

function formatAccess(accessLevel?: string | null) {
  return accessLevel ?? "Locked";
}
