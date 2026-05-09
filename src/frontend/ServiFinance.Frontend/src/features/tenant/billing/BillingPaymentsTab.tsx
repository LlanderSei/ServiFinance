import type { TenantBillingOverviewResponse } from "@/shared/api/contracts";
import { RecordTableStateRow } from "@/shared/records/RecordTable";
import {
  WorkspaceActionButton,
  WorkspaceInlineNote,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getBillingStatusTone
} from "./billingUi";

type BillingPaymentsTabProps = {
  data?: TenantBillingOverviewResponse;
  isLoading: boolean;
  history: TenantBillingOverviewResponse["history"];
  billingProvider: string;
  isStripeManaged: boolean;
  isAutorenewalManaged: boolean;
  canOpenBillingPortal: boolean;
  isPortalPending: boolean;
  onOpenPortal: () => void;
};

export function BillingPaymentsTab({
  data,
  isLoading,
  history,
  billingProvider,
  isStripeManaged,
  isAutorenewalManaged,
  canOpenBillingPortal,
  isPortalPending,
  onOpenPortal
}: BillingPaymentsTabProps) {
  return (
    <WorkspacePanelGrid className="xl:[grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">
      <WorkspacePanel>
        <WorkspacePanelHeader eyebrow="Billing ledger" title="Subscription payment history" />

        <WorkspaceSubtableShell>
          <WorkspaceSubtable>
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Coverage</th>
                <th>Submitted</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RecordTableStateRow colSpan={6}>Loading tenant billing history...</RecordTableStateRow>
              ) : null}

              {!isLoading && !history.length ? (
                <RecordTableStateRow colSpan={6}>No billing events have been recorded yet.</RecordTableStateRow>
              ) : null}

              {history.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="grid gap-1">
                      <strong className="text-base-content">{row.billingPeriodLabel}</strong>
                      <span className="text-xs text-base-content/60">{row.referenceNumber}</span>
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      <span>{formatDate(row.coverageStartUtc)} to {formatDate(row.coverageEndUtc)}</span>
                      <span className="text-xs text-base-content/60">Due {formatDate(row.dueDateUtc)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      <strong>{formatCurrency(row.amountSubmitted)}</strong>
                      <span className="text-xs text-base-content/60">Expected {formatCurrency(row.amountDue)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      <span>{row.paymentMethod}</span>
                      <span className="text-xs text-base-content/60">By {row.submittedByUserName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      <WorkspaceStatusPill tone={getBillingStatusTone(row.status)}>
                        {row.status}
                      </WorkspaceStatusPill>
                      <span className="text-xs text-base-content/60">{formatDateTime(row.submittedAtUtc)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      {row.proofRelativeUrl ? (
                        <a
                          href={row.proofRelativeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          {row.proofOriginalFileName ?? "Open receipt"}
                        </a>
                      ) : (
                        <span className="text-sm text-base-content/60">Provider event</span>
                      )}
                      {row.reviewRemarks ? (
                        <span className="text-xs text-base-content/60">{row.reviewRemarks}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </WorkspaceSubtable>
        </WorkspaceSubtableShell>
      </WorkspacePanel>

      <WorkspacePanel>
        <WorkspacePanelHeader
          eyebrow="Autorenewal"
          title={isAutorenewalManaged ? `Managed by ${billingProvider}` : "Online renewal required"}
          actions={
            data ? (
              <WorkspaceStatusPill tone={isAutorenewalManaged ? "progress" : "warning"}>
                {isAutorenewalManaged ? "Auto-renewal" : "Setup needed"}
              </WorkspaceStatusPill>
            ) : null
          }
        />

        <div className="grid gap-4">
          <WorkspaceInlineNote>
            {isAutorenewalManaged
              ? `Renewals are handled automatically through ${billingProvider} using the payment method attached during registration or the hosted billing portal.`
              : "Manual renewal proof upload has been removed. Attach this tenant to an online billing provider so renewal can happen automatically."}
          </WorkspaceInlineNote>

          {isStripeManaged || canOpenBillingPortal ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <WorkspaceActionButton
                type="button"
                className="w-full justify-center bg-primary text-primary-content hover:bg-primary/90"
                disabled={!canOpenBillingPortal || isPortalPending}
                onClick={onOpenPortal}
              >
                {isPortalPending ? "Opening..." : "Set up renewal payment now"}
              </WorkspaceActionButton>
              <WorkspaceActionButton
                type="button"
                className="w-full justify-center"
                disabled={!canOpenBillingPortal || isPortalPending}
                onClick={onOpenPortal}
              >
                Manage/remove payment method
              </WorkspaceActionButton>
            </div>
          ) : (
            <WorkspaceInlineNote className="rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
              No hosted billing portal is available for this tenant yet.
            </WorkspaceInlineNote>
          )}
        </div>
      </WorkspacePanel>
    </WorkspacePanelGrid>
  );
}
