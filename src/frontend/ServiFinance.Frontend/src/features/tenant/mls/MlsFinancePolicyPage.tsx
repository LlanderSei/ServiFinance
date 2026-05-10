import { useQuery } from "@tanstack/react-query";
import type { TenantMlsFinancePolicyControlResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordContentStack, RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import { WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatRate(value: number | null) {
  return value === null ? "No data" : `${value}%`;
}

function formatLateFeePolicyRule(isEnabled: boolean, flatAmount: number, ratePercent: number) {
  if (!isEnabled) {
    return "Disabled";
  }

  return `${formatCurrency(flatAmount)} + ${formatRate(ratePercent)} once`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function getPolicyTone(state: string) {
  return state === "Policy exception" ? "warning" as const : "active" as const;
}

export function MlsFinancePolicyPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const policyQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-finance-policy"],
    queryFn: () => httpGet<TenantMlsFinancePolicyControlResponse>(`/api/tenants/${tenantDomainSlug}/mls/finance-policy`),
    enabled: Boolean(tenantDomainSlug)
  });
  const summary = policyQuery.data?.summary;
  const lateFeePolicy = policyQuery.data?.lateFeePolicy;
  const rows = policyQuery.data?.rows ?? [];

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.finance-policy.view"
      requireModule={MlsModuleCodes.financePolicyControl}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Policy`}
        title="Finance policy control"
        description="Review interest, term, principal, and policy exception signals across the MLS loan portfolio."
        recordCount={summary?.policyExceptionCount ?? 0}
        singularLabel="policy exception"
      >
        <RecordContentStack className="overflow-hidden">
          {policyQuery.isLoading ? <WorkspaceNotice>Loading finance policy controls...</WorkspaceNotice> : null}
          {policyQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(policyQuery.error, "Unable to load finance policy controls right now.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceKpiRailLayout
            contentClassName="overflow-hidden"
            kpis={(
              <>
                <MetricCard label="Loan records" value={summary?.loanCount ?? 0} description="Loan accounts reviewed by the policy control surface." />
                <MetricCard label="Average rate" value={formatRate(summary?.averageInterestRate ?? null)} description="Average annual interest rate across visible loan accounts." />
                <MetricCard label="Rate range" value={`${formatRate(summary?.minimumInterestRate ?? null)} - ${formatRate(summary?.maximumInterestRate ?? null)}`} description="Minimum and maximum annual interest rate in the current portfolio." />
                <MetricCard label="Average term" value={`${summary?.averageTermMonths ?? 0} mo`} description="Average repayment term across visible loan accounts." />
                <MetricCard label="Exceptions" value={summary?.policyExceptionCount ?? 0} description="Loans outside the current hardening guardrails for rate, term, or principal size." />
                <MetricCard label="Grace period" value={lateFeePolicy?.isEnabled ? `${lateFeePolicy.gracePeriodDays} days` : "Disabled"} description="Days allowed after the due date before the one-time late fee is assessed." />
                <MetricCard label="Late fee rule" value={formatLateFeePolicyRule(lateFeePolicy?.isEnabled ?? false, lateFeePolicy?.flatAmount ?? 0, lateFeePolicy?.ratePercent ?? 0)} description="Simple borrower penalty rule applied once per overdue installment." />
                <MetricCard label="Assessed fees" value={formatCurrency(lateFeePolicy?.assessedAmount ?? 0)} description={`${lateFeePolicy?.assessedInstallments ?? 0} installment(s) currently carrying an assessed late fee.`} />
              </>
            )}
          >
            <RecordScrollRegion>
              <div className="grid gap-4">
                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Late-term handling" title="Borrower late-payment safeguards" />

                  <WorkspaceNotice>
                    {lateFeePolicy?.isEnabled
                      ? `Overdue installments receive a one-time fee after the ${lateFeePolicy.gracePeriodDays}-day grace window. The system does not compound late fees daily, which keeps delinquency charges predictable and auditable.`
                      : "Late fees are currently disabled for this tenant, so overdue balances only reflect the remaining scheduled installment amount."}
                  </WorkspaceNotice>
                </WorkspacePanel>

                <WorkspacePanel>
                  <WorkspacePanelHeader eyebrow="Policy bands" title="Term and high-rate exposure bands" />

                  {policyQuery.data?.policyBands.length ? (
                    <WorkspaceSubtableShell>
                      <WorkspaceSubtable>
                        <thead>
                          <tr>
                            <th>Band</th>
                            <th>Loans</th>
                            <th>Principal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {policyQuery.data.policyBands.map((band) => (
                            <tr key={band.label}>
                              <td>{band.label}</td>
                              <td>{band.loanCount}</td>
                              <td>{formatCurrency(band.principalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </WorkspaceSubtable>
                    </WorkspaceSubtableShell>
                  ) : (
                    <WorkspaceEmptyState>No policy bands are available yet.</WorkspaceEmptyState>
                  )}
                </WorkspacePanel>

                <WorkspacePanel className="min-h-[28rem]">
                  <WorkspacePanelHeader eyebrow="Loan policy review" title="Interest, term, and principal guardrails" />

                  <RecordTableShell>
                    <RecordTable>
                      <thead>
                        <tr>
                          <th>Borrower</th>
                          <th>Loan</th>
                          <th>Principal</th>
                          <th>Rate</th>
                          <th>Term</th>
                          <th>Status</th>
                          <th>Policy</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policyQuery.isLoading ? (
                          <RecordTableStateRow colSpan={8}>Loading policy rows...</RecordTableStateRow>
                        ) : rows.length === 0 ? (
                          <RecordTableStateRow colSpan={8}>No loan policy rows are available yet.</RecordTableStateRow>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.microLoanId}>
                              <td>{row.customerName}</td>
                              <td>{row.loanLabel}</td>
                              <td>{formatCurrency(row.principalAmount)}</td>
                              <td>{formatRate(row.annualInterestRate)}</td>
                              <td>{row.termMonths} months</td>
                              <td>{row.loanStatus}</td>
                              <td>
                                <WorkspaceStatusPill tone={getPolicyTone(row.policyState)}>{row.policyState}</WorkspaceStatusPill>
                              </td>
                              <td>{formatDate(row.createdAtUtc)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </RecordTable>
                  </RecordTableShell>
                </WorkspacePanel>
              </div>
            </RecordScrollRegion>
          </WorkspaceKpiRailLayout>
        </RecordContentStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

export default MlsFinancePolicyPage;
