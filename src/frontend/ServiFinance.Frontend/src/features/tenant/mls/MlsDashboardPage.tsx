import { useQuery } from "@tanstack/react-query";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import type { TenantMlsDashboardResponse } from "@/shared/api/contracts";
import { getApiErrorMessage, httpGet } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { MetricCard } from "@/shared/records/MetricCard";
import { WorkspaceActionLink, WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceDistributionRow,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormatter.format(date);
}

function getFinanceTone(label: string) {
  switch (label) {
    case "Ready for loan conversion":
      return "warning" as const;
    case "Loan created":
      return "active" as const;
    default:
      return "neutral" as const;
  }
}

export function MlsDashboardPage() {
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";
  const dashboardQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"],
    queryFn: () => httpGet<TenantMlsDashboardResponse>(`/api/tenants/${tenantDomainSlug}/mls/dashboard`),
    enabled: Boolean(tenantDomainSlug)
  });
  const dashboard = dashboardQuery.data;

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Dashboard`}
        title="Micro-lending workspace"
        description="Track finance-ready invoices, converted loans, and the first lending handoff slice from the tenant desktop terminal."
      >
        <WorkspaceScrollStack>
          {dashboardQuery.isLoading ? (
            <WorkspaceNotice>Loading the tenant MLS dashboard...</WorkspaceNotice>
          ) : null}

          {dashboardQuery.isError ? (
            <WorkspaceNotice tone="error">
              {getApiErrorMessage(dashboardQuery.error, "Unable to load the MLS dashboard right now. Refresh the desktop session and try again.")}
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-4">
            <MetricCard
              label="Ready queue"
              value={dashboard?.summary.financeReadyInvoices ?? "0"}
              description="Finalized invoices that are finance-ready and still waiting for MLS loan conversion."
            />
            <MetricCard
              label="Converted loans"
              value={dashboard?.summary.convertedLoans ?? "0"}
              description="Invoices already converted into micro-loans inside the shared tenant finance model."
            />
            <MetricCard
              label="Ready exposure"
              value={formatCurrency(dashboard?.summary.readyOutstandingAmount ?? 0)}
              description="Outstanding invoice value currently waiting for desktop finance evaluation."
            />
            <MetricCard
              label="Ledger activity"
              value={dashboard?.summary.ledgerEntries ?? "0"}
              description="Recorded ledger entries linked to invoice, loan, and finance posting history."
            />
          </WorkspaceMetricGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Finance queue" title="Invoices ready for MLS handoff" />

              {dashboard?.financeQueue.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Request</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.financeQueue.map((item) => (
                        <tr key={item.invoiceId}>
                          <td>
                            <div className="grid gap-1">
                              <strong>{item.invoiceNumber}</strong>
                              <span className="text-xs text-base-content/60">{formatDate(item.invoiceDateUtc)}</span>
                            </div>
                          </td>
                          <td>{item.customerName}</td>
                          <td>{item.requestNumber}</td>
                          <td>
                            <div className="grid gap-1">
                              <strong>{formatCurrency(item.outstandingAmount)}</strong>
                              <span className="text-xs text-base-content/60">
                                Interestable {formatCurrency(item.interestableAmount)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <WorkspaceStatusPill tone={getFinanceTone(item.financeHandoffStatus)}>
                              {item.financeHandoffStatus}
                            </WorkspaceStatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No finance-ready invoices are waiting in the MLS queue yet. Finalize more service invoices from SMS to feed the desktop finance surface.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Handoff mix" title="Current finance-state distribution" />

              <div className="grid gap-4">
                {dashboard?.handoffDistribution.length ? dashboard.handoffDistribution.map((item) => {
                  const total = dashboard.handoffDistribution.reduce((sum, current) => sum + current.count, 0);
                  return (
                    <WorkspaceDistributionRow
                      key={item.label}
                      label={item.label}
                      value={`${item.count} records`}
                      percentage={total === 0 ? 0 : item.count / total * 100}
                    />
                  );
                }) : (
                  <WorkspaceEmptyState>
                    Finance-state distribution will appear here after tenant invoices begin moving through the MLS handoff cycle.
                  </WorkspaceEmptyState>
                )}
              </div>
            </WorkspacePanel>
          </WorkspacePanelGrid>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Recent finance activity" title="Converted loans" />

              {dashboard?.recentLoans.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Invoice</th>
                        <th>Principal</th>
                        <th>Total repayable</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentLoans.map((loan) => (
                        <tr key={loan.microLoanId}>
                          <td>{loan.customerName}</td>
                          <td>
                            <div className="grid gap-1">
                              <strong>{loan.invoiceNumber}</strong>
                              <span className="text-xs text-base-content/60">{formatDate(loan.createdAtUtc)}</span>
                            </div>
                          </td>
                          <td>{formatCurrency(loan.principalAmount)}</td>
                          <td>{formatCurrency(loan.totalRepayableAmount)}</td>
                          <td>
                            <WorkspaceStatusPill tone={loan.loanStatus === "Active" ? "active" : "neutral"}>
                              {loan.loanStatus}
                            </WorkspaceStatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  Converted loans will appear here once the desktop MLS workflow starts creating micro-loan records from finalized invoices.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Quick actions"
                title="Current implementation slice"
                actions={(
                  <>
                    <WorkspaceActionLink to="/t/mls/loan-conversion">Loan Conversion</WorkspaceActionLink>
                  </>
                )}
              />

              <WorkspaceNoteList
                items={[
                  "Desktop authentication is now tenant-aware and lands directly in the MLS workspace instead of a placeholder public route.",
                  "The MLS desktop workspace now stays isolated from SMS navigation and exposes only finance-side modules.",
                  "The next MLS slice now starts with invoice-to-loan conversion, amortization preview, and loan creation from finalized invoices."
                ]}
              />
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
