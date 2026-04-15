import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TenantMlsCollectionRow,
  TenantMlsCollectionsWorkspaceResponse,
  TenantMlsLoanPaymentPostedResponse
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { useRefreshSession } from "@/shared/auth/useRefreshSession";
import { MetricCard } from "@/shared/records/MetricCard";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspacePanel,
  WorkspacePanelGrid,
  WorkspacePanelHeader,
  WorkspaceScrollStack,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceActionButton,
  WorkspaceActionLink,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getDefaultPaymentDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildCollectionsQueryString(state: string) {
  return state ? `?state=${encodeURIComponent(state)}` : "";
}

function getCollectionTone(state: string) {
  if (state === "Overdue") {
    return "warning" as const;
  }

  if (state === "DueToday") {
    return "progress" as const;
  }

  if (state === "DueThisWeek") {
    return "active" as const;
  }

  return "neutral" as const;
}

export function MlsCollectionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentSession = getCurrentSession();
  const { data } = useRefreshSession(!currentSession);
  const tenantDomainSlug = (currentSession ?? data)?.user.tenantDomainSlug ?? "";

  const [collectionState, setCollectionState] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getDefaultPaymentDate());
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const collectionsQueryString = useMemo(() => buildCollectionsQueryString(collectionState), [collectionState]);
  const collectionsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "mls-collections", collectionState],
    queryFn: () => httpGet<TenantMlsCollectionsWorkspaceResponse>(`/api/tenants/${tenantDomainSlug}/mls/collections${collectionsQueryString}`),
    enabled: Boolean(tenantDomainSlug)
  });

  useEffect(() => {
    const firstEntry = collectionsQuery.data?.entries[0];
    if (!firstEntry) {
      setSelectedLoanId("");
      setSelectedEntryKey("");
      return;
    }

    if (!selectedEntryKey || !collectionsQuery.data?.entries.some((entry) => getEntryKey(entry) === selectedEntryKey)) {
      setSelectedLoanId(firstEntry.microLoanId);
      setSelectedEntryKey(getEntryKey(firstEntry));
      setPaymentAmount(firstEntry.outstandingAmount.toFixed(2));
    }
  }, [collectionsQuery.data, selectedEntryKey]);

  const selectedEntry = collectionsQuery.data?.entries.find((entry) => getEntryKey(entry) === selectedEntryKey) ?? null;

  const paymentMutation = useMutation({
    mutationFn: () => httpPostJson<TenantMlsLoanPaymentPostedResponse, {
      amount: number;
      paymentDate: string;
      referenceNumber: string | null;
      remarks: string | null;
    }>(`/api/tenants/${tenantDomainSlug}/mls/loans/${selectedLoanId}/payments`, {
      amount: Number(paymentAmount),
      paymentDate,
      referenceNumber: referenceNumber.trim() || null,
      remarks: remarks.trim() || null
    }),
    onSuccess: (payload) => {
      toast.success({
        title: "Collection posted",
        message: `Applied ${formatCurrency(payload.amountApplied)}. Remaining loan balance is ${formatCurrency(payload.outstandingBalance)}.`
      });
      setReferenceNumber("");
      setRemarks("");
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-collections"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-loans"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error({
        title: "Unable to post collection",
        message: error.message
      });
    }
  });

  function handleSelectEntry(entry: TenantMlsCollectionRow) {
    setSelectedLoanId(entry.microLoanId);
    setSelectedEntryKey(getEntryKey(entry));
    setPaymentAmount(entry.outstandingAmount.toFixed(2));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    paymentMutation.mutate();
  }

  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <RecordWorkspace
        breadcrumbs={`${tenantDomainSlug} / MLS / Collections`}
        title="Collections queue"
        description="Work through overdue and due-soon installments, then post collections directly from the MLS desktop queue."
      >
        <WorkspaceScrollStack>
          {collectionsQuery.isLoading ? <WorkspaceNotice>Loading MLS collections queue...</WorkspaceNotice> : null}
          {collectionsQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load the MLS collections queue right now.
            </WorkspaceNotice>
          ) : null}

          <WorkspaceMetricGrid className="2xl:grid-cols-5">
            <MetricCard label="Overdue installments" value={String(collectionsQuery.data?.summary.overdueInstallments ?? 0)} description="Installments already past due and awaiting collection." />
            <MetricCard label="Due today" value={String(collectionsQuery.data?.summary.dueTodayInstallments ?? 0)} description="Installments scheduled for collection today." />
            <MetricCard label="Due this week" value={String(collectionsQuery.data?.summary.dueThisWeekInstallments ?? 0)} description="Installments that need follow-up within the next seven days." />
            <MetricCard label="Overdue balance" value={formatCurrency(collectionsQuery.data?.summary.overdueBalance ?? 0)} description="Past-due receivables currently exposed in the MLS queue." />
            <MetricCard label="Due this week balance" value={formatCurrency(collectionsQuery.data?.summary.dueThisWeekBalance ?? 0)} description="Due-today and due-soon installment value requiring attention this week." />
          </WorkspaceMetricGrid>

          <WorkspacePanel>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <WorkspacePanelHeader eyebrow="Filters" title="Collection state" />

              <div className="flex justify-start xl:justify-end">
                <WorkspaceActionButton onClick={() => setCollectionState("")}>
                  Show all
                </WorkspaceActionButton>
              </div>
            </div>

            <div className="grid gap-4">
              <WorkspaceField label="Queue filter">
                <WorkspaceSelect value={collectionState} onChange={(event) => setCollectionState(event.target.value)}>
                  <option value="">All states</option>
                  <option value="Overdue">Overdue</option>
                  <option value="DueToday">Due today</option>
                  <option value="DueThisWeek">Due this week</option>
                  <option value="Upcoming">Upcoming</option>
                </WorkspaceSelect>
              </WorkspaceField>
            </div>
          </WorkspacePanel>

          <WorkspacePanelGrid>
            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Queue" title="Installments requiring collection" />

              {collectionsQuery.data?.entries.length ? (
                <WorkspaceSubtableShell>
                  <WorkspaceSubtable className="min-w-[54rem]">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Loan</th>
                        <th>Installment</th>
                        <th>Due date</th>
                        <th>Outstanding</th>
                        <th>State</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionsQuery.data.entries.map((entry) => (
                        <tr key={getEntryKey(entry)}>
                          <td>{entry.customerName}</td>
                          <td>{entry.loanLabel}</td>
                          <td>#{entry.installmentNumber}</td>
                          <td>{entry.dueDate}</td>
                          <td>{formatCurrency(entry.outstandingAmount)}</td>
                          <td>
                            <WorkspaceStatusPill tone={getCollectionTone(entry.collectionState)}>
                              {entry.collectionState === "Overdue" ? `${entry.collectionState} (${entry.daysPastDue}d)` : entry.collectionState}
                            </WorkspaceStatusPill>
                          </td>
                          <td>
                            <WorkspaceActionButton onClick={() => handleSelectEntry(entry)}>
                              {getEntryKey(entry) === selectedEntryKey ? "Selected" : "Open"}
                            </WorkspaceActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </WorkspaceSubtable>
                </WorkspaceSubtableShell>
              ) : (
                <WorkspaceEmptyState>
                  No collection entries match the current MLS filter.
                </WorkspaceEmptyState>
              )}
            </WorkspacePanel>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Posting" title="Apply collection to selected loan" />

              <WorkspaceForm onSubmit={handleSubmit}>
                <WorkspaceFieldGrid>
                  <WorkspaceField label="Amount">
                    <WorkspaceInput type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Collection date">
                    <WorkspaceInput type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
                  </WorkspaceField>
                  <WorkspaceField label="Reference number">
                    <WorkspaceInput value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
                  </WorkspaceField>
                  <WorkspaceField label="Remarks">
                    <WorkspaceInput value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                  </WorkspaceField>
                </WorkspaceFieldGrid>

                {selectedEntry ? (
                  <div className="grid gap-3 rounded-box border border-base-300/70 bg-base-200/30 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Selected collection</p>
                        <h3 className="mt-1 text-lg font-semibold text-base-content">{selectedEntry.customerName}</h3>
                        <p className="text-sm text-base-content/65">
                          {selectedEntry.loanLabel} / Installment #{selectedEntry.installmentNumber} due {selectedEntry.dueDate}
                        </p>
                      </div>
                      <WorkspaceStatusPill tone={getCollectionTone(selectedEntry.collectionState)}>
                        {selectedEntry.collectionState}
                      </WorkspaceStatusPill>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Installment amount" value={formatCurrency(selectedEntry.installmentAmount)} description="Scheduled installment for the selected due row." />
                      <MetricCard label="Already paid" value={formatCurrency(selectedEntry.paidAmount)} description="Amount previously posted against this installment." />
                      <MetricCard label="Outstanding" value={formatCurrency(selectedEntry.outstandingAmount)} description="Remaining collectible amount on this installment." />
                      <MetricCard label="Loan status" value={selectedEntry.loanStatus} description="Current loan lifecycle status tied to the collection row." />
                    </div>

                    <div className="flex flex-wrap justify-between gap-3">
                      <WorkspaceActionLink to="/t/mls/loans">
                        Open Loan Accounts
                      </WorkspaceActionLink>
                      <WorkspaceActionButton type="submit" disabled={paymentMutation.isPending || !selectedLoanId}>
                        {paymentMutation.isPending ? "Posting collection..." : "Post Collection"}
                      </WorkspaceActionButton>
                    </div>
                  </div>
                ) : (
                  <WorkspaceEmptyState>
                    Select a collection row from the queue to apply a payment against the underlying loan account.
                  </WorkspaceEmptyState>
                )}
              </WorkspaceForm>
            </WorkspacePanel>
          </WorkspacePanelGrid>
        </WorkspaceScrollStack>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}

function getEntryKey(entry: TenantMlsCollectionRow) {
  return `${entry.microLoanId}:${entry.installmentNumber}`;
}
