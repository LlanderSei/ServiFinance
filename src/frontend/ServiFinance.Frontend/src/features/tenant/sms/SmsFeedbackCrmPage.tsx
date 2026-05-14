import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import type { TenantSmsFeedbackCrmResponse } from "@/shared/api/contracts";
import { httpGet } from "@/shared/api/http";
import { MetricCard } from "@/shared/records/MetricCard";
import { MobileRecordField, MobileRecordFieldGrid } from "@/shared/records/MobileRecordDetails";
import { RecordTable, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { WorkspaceNotice, WorkspaceStatusPill } from "@/shared/records/WorkspaceControls";
import {
  WorkspaceDistributionRow,
  WorkspaceEmptyState,
  WorkspaceKpiRailLayout,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceTenantCell
} from "@/shared/records/WorkspacePanel";

const feedbackCrmTabs = [
  { key: "queue", label: "Feedback Queue" },
  { key: "themes", label: "Suggestion Themes" }
];

export function SmsFeedbackCrmPage() {
  const { tenantDomainSlug = "" } = useParams();
  const [activeTab, setActiveTab] = useState(feedbackCrmTabs[0].key);
  const crmQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-feedback-crm"],
    queryFn: () => httpGet<TenantSmsFeedbackCrmResponse>(`/api/tenants/${tenantDomainSlug}/sms/customer-feedback-crm`)
  });

  const summary = crmQuery.data?.summary;
  const rows = crmQuery.data?.rows ?? [];
  const themes = crmQuery.data?.suggestionThemes ?? [];
  const themeTotal = themes.reduce((sum, row) => sum + row.count, 0);

  return (
    <RecordWorkspace
      breadcrumbs={`${tenantDomainSlug} / SMS / Feedback CRM`}
      title="Customer feedback CRM"
      description="Review service ratings, customer suggestions, expired feedback windows, and low-rating follow-up from one medium-tier workspace."
      recordCount={summary?.ratedRequests ?? 0}
      singularLabel="rated service"
      headerBottom={<WorkspaceTopTabs tabs={feedbackCrmTabs} activeTab={activeTab} onChange={setActiveTab} />}
    >
      <RecordContentStack>
        {crmQuery.isError ? (
          <WorkspaceNotice tone="error">Unable to load customer feedback CRM right now.</WorkspaceNotice>
        ) : null}

        <WorkspaceKpiRailLayout
          kpis={
            <>
              <MetricCard label="Average rating" value={formatRating(summary?.averageRating)} description="Average score submitted by customers." />
              <MetricCard label="Rated services" value={summary?.ratedRequests ?? 0} description="Completed service requests with submitted feedback." />
              <MetricCard label="Pending feedback" value={summary?.pendingFeedback ?? 0} description="Completed requests still inside the feedback window." />
              <MetricCard label="Low ratings" value={summary?.lowRatingCount ?? 0} description="Ratings at two stars or below requiring follow-up." />
              <MetricCard label="Suggestions" value={summary?.suggestionsCount ?? 0} description="Feedback records with a categorized customer suggestion." />
            </>
          }
        >
          <div className="grid min-h-0 flex-1 gap-4">
            {activeTab === "queue" ? (
              <WorkspacePanel className="min-h-0">
                <WorkspacePanelHeader eyebrow="Feedback queue" title="Customer records needing review" />

                <RecordTableShell>
                  <RecordTable>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Rating</th>
                        <th>Suggestion</th>
                        <th>Feedback state</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmQuery.isLoading ? (
                        <RecordTableStateRow colSpan={4}>Loading customer feedback...</RecordTableStateRow>
                      ) : rows.length === 0 ? (
                        <RecordTableStateRow colSpan={4}>No feedback records are available yet.</RecordTableStateRow>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="grid gap-3 lg:hidden">
                                <div className="flex items-start justify-between gap-3">
                                  <MobileRecordFieldGrid className="min-w-0">
                                    <strong className="block text-sm text-base-content">{row.requestNumber}</strong>
                                    <MobileRecordField label="Customer" value={row.customerName} />
                                    <MobileRecordField label="Item Type" value={row.itemType} />
                                  </MobileRecordFieldGrid>
                                  <div className="flex shrink-0 flex-col items-end gap-1">
                                    <WorkspaceStatusPill tone={resolveFeedbackTone(row.feedbackState, row.rating)}>{row.feedbackState}</WorkspaceStatusPill>
                                    <WorkspaceStatusPill tone={row.rating != null && row.rating <= 2 ? "warning" : "neutral"}>
                                      {row.rating == null ? "No rating" : `${row.rating}/5`}
                                    </WorkspaceStatusPill>
                                  </div>
                                </div>
                                <MobileRecordField label="Suggestion" value={row.suggestionCategory ?? "-"} />
                                <MobileRecordField label="Feedback Comments" value={row.feedbackComments ?? "-"} />
                              </div>
                              <div className="hidden lg:block">
                                <WorkspaceTenantCell
                                  title={row.requestNumber}
                                  subtitle={`${row.customerName} / ${row.itemType}`}
                                />
                                {row.feedbackComments ? (
                                  <p className="mt-2 max-w-xl text-xs leading-5 text-base-content/65">{row.feedbackComments}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="max-lg:hidden">{formatRating(row.rating)}</td>
                            <td className="max-lg:hidden">{row.suggestionCategory ?? "-"}</td>
                            <td className="max-lg:hidden">
                              <WorkspaceStatusPill tone={resolveFeedbackTone(row.feedbackState, row.rating)}>{row.feedbackState}</WorkspaceStatusPill>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </RecordTable>
                </RecordTableShell>
              </WorkspacePanel>
            ) : null}

            {activeTab === "themes" ? (
              <WorkspacePanel className="min-h-0">
                <WorkspacePanelHeader eyebrow="Suggestion themes" title="What customers keep mentioning" />

                {themes.length === 0 ? (
                  <WorkspaceEmptyState>No suggestion themes have been submitted yet.</WorkspaceEmptyState>
                ) : (
                  <div className="grid gap-3">
                    {themes.map((theme) => (
                      <WorkspaceDistributionRow
                        key={theme.category}
                        label={`${theme.category} (${formatRating(theme.averageRating)})`}
                        value={theme.count}
                        percentage={themeTotal === 0 ? 0 : (theme.count / themeTotal) * 100}
                      />
                    ))}
                  </div>
                )}
              </WorkspacePanel>
            ) : null}
          </div>
        </WorkspaceKpiRailLayout>
      </RecordContentStack>
    </RecordWorkspace>
  );
}

function formatRating(value: number | null | undefined) {
  return value == null ? "No data" : `${value.toFixed(1)}/5`;
}

function resolveFeedbackTone(state: string, rating: number | null) {
  if (rating != null && rating <= 2) {
    return "inactive";
  }

  if (state === "Pending" || state === "Expired") {
    return "warning";
  }

  return "active";
}

export default SmsFeedbackCrmPage;
