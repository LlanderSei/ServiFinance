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
import { RecordSurfaceModal } from "@/shared/records/RecordSurfaceModal";
import { RecordTable, RecordTableActionButton, RecordTableShell, RecordTableStateRow } from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceEmptyState,
  WorkspacePanel,
  WorkspacePanelHeader,
  WorkspaceSubtable,
  WorkspaceSubtableShell
} from "@/shared/records/WorkspacePanel";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { useToast } from "@/shared/toast/ToastProvider";

type CollectionGroupRow = {
  microLoanId: string;
  customerId: string;
  customerName: string;
  loanLabel: string;
  installmentCount: number;
  earliestDueDate: string;
  totalOutstandingAmount: number;
  highestDaysPastDue: number;
  dominantCollectionState: string;
  loanStatus: string;
  entries: TenantMlsCollectionRow[];
};

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

function getEntryKey(entry: TenantMlsCollectionRow) {
  return `${entry.microLoanId}:${entry.installmentNumber}`;
}

function summarizeCollectionGroups(entries: TenantMlsCollectionRow[]) {
  const grouped = new Map<string, CollectionGroupRow>();

  for (const entry of entries) {
    const existing = grouped.get(entry.microLoanId);
    if (!existing) {
      grouped.set(entry.microLoanId, {
        microLoanId: entry.microLoanId,
        customerId: entry.customerId,
        customerName: entry.customerName,
        loanLabel: entry.loanLabel,
        installmentCount: 1,
        earliestDueDate: entry.dueDate,
        totalOutstandingAmount: entry.outstandingAmount,
        highestDaysPastDue: entry.daysPastDue,
        dominantCollectionState: entry.collectionState,
        loanStatus: entry.loanStatus,
        entries: [entry]
      });
      continue;
    }

    existing.installmentCount += 1;
    existing.totalOutstandingAmount += entry.outstandingAmount;
    existing.highestDaysPastDue = Math.max(existing.highestDaysPastDue, entry.daysPastDue);
    existing.entries.push(entry);

    if (entry.dueDate < existing.earliestDueDate) {
      existing.earliestDueDate = entry.dueDate;
    }

    if (getCollectionPriority(entry.collectionState) > getCollectionPriority(existing.dominantCollectionState)) {
      existing.dominantCollectionState = entry.collectionState;
    }
  }

  return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        totalOutstandingAmount: Math.round(group.totalOutstandingAmount * 100) / 100,
        entries: [...group.entries].sort((left, right) => left.installmentNumber - right.installmentNumber)
      }))
      .sort((left, right) => left.earliestDueDate.localeCompare(right.earliestDueDate));
}

function getCollectionPriority(state: string) {
  switch (state) {
    case "Overdue":
      return 4;
    case "DueToday":
      return 3;
    case "DueThisWeek":
      return 2;
    default:
      return 1;
  }
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const groupedEntries = useMemo(
    () => summarizeCollectionGroups(collectionsQuery.data?.entries ?? []),
    [collectionsQuery.data?.entries]
  );

  const selectedGroup = groupedEntries.find((entry) => entry.microLoanId === selectedLoanId) ?? null;
  const selectedEntry = selectedGroup?.entries.find((entry) => getEntryKey(entry) === selectedEntryKey) ?? null;

  useEffect(() => {
    if (!selectedGroup?.entries.length) {
      return;
    }

    if (!selectedEntryKey || !selectedGroup.entries.some((entry) => getEntryKey(entry) === selectedEntryKey)) {
      const firstEntry = selectedGroup.entries[0];
      setSelectedEntryKey(getEntryKey(firstEntry));
      setPaymentAmount(firstEntry.outstandingAmount.toFixed(2));
    }
  }, [selectedEntryKey, selectedGroup]);

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

  function openCollectionModal(group: CollectionGroupRow) {
    setSelectedLoanId(group.microLoanId);
    const firstEntry = group.entries[0] ?? null;
    setSelectedEntryKey(firstEntry ? getEntryKey(firstEntry) : "");
    setPaymentAmount(firstEntry ? firstEntry.outstandingAmount.toFixed(2) : "");
    setPaymentDate(getDefaultPaymentDate());
    setReferenceNumber("");
    setRemarks("");
    setIsModalOpen(true);
  }

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
        description="Review grouped loan collections, then post installment payments from the MLS desktop workspace."
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="grid auto-rows-max gap-4">
              {collectionsQuery.isLoading ? <WorkspaceNotice>Loading MLS collections queue...</WorkspaceNotice> : null}
              {collectionsQuery.isError ? (
                <WorkspaceNotice tone="error">
                  Unable to load the MLS collections queue right now.
                </WorkspaceNotice>
              ) : null}

              <MetricCard label="Overdue installments" value={String(collectionsQuery.data?.summary.overdueInstallments ?? 0)} description="Installments already past due and awaiting collection." />
              <MetricCard label="Due today" value={String(collectionsQuery.data?.summary.dueTodayInstallments ?? 0)} description="Installments scheduled for collection today." />
              <MetricCard label="Due this week" value={String(collectionsQuery.data?.summary.dueThisWeekInstallments ?? 0)} description="Installments that need follow-up within the next seven days." />
              <MetricCard label="Overdue balance" value={formatCurrency(collectionsQuery.data?.summary.overdueBalance ?? 0)} description="Past-due receivables currently exposed in the MLS queue." />
              <MetricCard label="Due this week balance" value={formatCurrency(collectionsQuery.data?.summary.dueThisWeekBalance ?? 0)} description="Due-today and due-soon installment value requiring attention this week." />
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden">
            <WorkspacePanel className="h-full gap-3">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <WorkspacePanelHeader eyebrow="Filters" title="Grouped collections queue" />

                <div className="flex justify-start xl:justify-end">
                  <RecordTableActionButton onClick={() => setCollectionState("")}>
                    Show all
                  </RecordTableActionButton>
                </div>
              </div>

              <WorkspaceField label="Queue filter">
                <WorkspaceSelect value={collectionState} onChange={(event) => setCollectionState(event.target.value)}>
                  <option value="">All states</option>
                  <option value="Overdue">Overdue</option>
                  <option value="DueToday">Due today</option>
                  <option value="DueThisWeek">Due this week</option>
                  <option value="Upcoming">Upcoming</option>
                </WorkspaceSelect>
              </WorkspaceField>

              <RecordTableShell className="min-h-0 flex-1">
                <RecordTable className="min-w-[72rem]">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Loan</th>
                      <th>Installments</th>
                      <th>Next due</th>
                      <th>Outstanding</th>
                      <th>State</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionsQuery.isLoading ? (
                      <RecordTableStateRow colSpan={7}>Loading collections queue...</RecordTableStateRow>
                    ) : collectionsQuery.isError ? (
                      <RecordTableStateRow colSpan={7} tone="error">
                        Unable to load the collections queue.
                      </RecordTableStateRow>
                    ) : groupedEntries.length ? (
                      groupedEntries.map((group) => (
                        <tr key={group.microLoanId}>
                          <td>{group.customerName}</td>
                          <td>{group.loanLabel}</td>
                          <td>{group.installmentCount}</td>
                          <td>{group.earliestDueDate}</td>
                          <td>{formatCurrency(group.totalOutstandingAmount)}</td>
                          <td>
                            <WorkspaceStatusPill tone={getCollectionTone(group.dominantCollectionState)}>
                              {group.dominantCollectionState === "Overdue"
                                ? `${group.dominantCollectionState} (${group.highestDaysPastDue}d)`
                                : group.dominantCollectionState}
                            </WorkspaceStatusPill>
                          </td>
                          <td>
                            <RecordTableActionButton onClick={() => openCollectionModal(group)}>
                              Post Collection
                            </RecordTableActionButton>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <RecordTableStateRow colSpan={7}>
                        No collection entries match the current MLS filter.
                      </RecordTableStateRow>
                    )}
                  </tbody>
                </RecordTable>
              </RecordTableShell>
            </WorkspacePanel>
          </section>
        </div>

        <RecordSurfaceModal
          open={isModalOpen}
          title={selectedGroup?.loanLabel ?? "Collection posting"}
          eyebrow={`${tenantDomainSlug} / MLS / Collections`}
          description={selectedGroup ? `${selectedGroup.customerName} • ${selectedGroup.installmentCount} installment(s) awaiting collection.` : "Select a grouped collection record to post against its due installments."}
          maxWidthClassName="max-w-[min(84rem,calc(100vw-3rem))]"
          actions={(
            <WorkspaceModalButton
              type="submit"
              form="mls-collection-post-form"
              tone="primary"
              disabled={paymentMutation.isPending || !selectedLoanId || !selectedEntry}
            >
              {paymentMutation.isPending ? "Posting Collection..." : "Post Collection"}
            </WorkspaceModalButton>
          )}
          onClose={() => setIsModalOpen(false)}
        >
          {!selectedGroup ? (
            <WorkspaceEmptyState>
              Select a grouped collection record from the queue to post a collection.
            </WorkspaceEmptyState>
          ) : (
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
              <WorkspacePanel className="min-h-0 overflow-hidden">
                <WorkspacePanelHeader eyebrow="Queue collections" title="Installments for this record" />

                {selectedGroup.entries.length ? (
                  <WorkspaceSubtableShell className="min-h-0 flex-1">
                    <WorkspaceSubtable className="min-w-[54rem]">
                      <thead>
                        <tr>
                          <th>Installment</th>
                          <th>Due date</th>
                          <th>Installment amount</th>
                          <th>Paid</th>
                          <th>Outstanding</th>
                          <th>State</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.entries.map((entry) => (
                          <tr key={getEntryKey(entry)}>
                            <td>#{entry.installmentNumber}</td>
                            <td>{entry.dueDate}</td>
                            <td>{formatCurrency(entry.installmentAmount)}</td>
                            <td>{formatCurrency(entry.paidAmount)}</td>
                            <td>{formatCurrency(entry.outstandingAmount)}</td>
                            <td>
                              <WorkspaceStatusPill tone={getCollectionTone(entry.collectionState)}>
                                {entry.collectionState === "Overdue"
                                  ? `${entry.collectionState} (${entry.daysPastDue}d)`
                                  : entry.collectionState}
                              </WorkspaceStatusPill>
                            </td>
                            <td>
                              <RecordTableActionButton onClick={() => handleSelectEntry(entry)}>
                                {getEntryKey(entry) === selectedEntryKey ? "Selected" : "Select"}
                              </RecordTableActionButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </WorkspaceSubtable>
                  </WorkspaceSubtableShell>
                ) : (
                  <WorkspaceEmptyState>
                    No installment rows are available for this collection record.
                  </WorkspaceEmptyState>
                )}
              </WorkspacePanel>

              <WorkspacePanel>
                <WorkspacePanelHeader eyebrow="Posting" title="Apply collection" />

                <WorkspaceForm id="mls-collection-post-form" onSubmit={handleSubmit}>
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
                          <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Selected installment</p>
                          <h3 className="mt-1 text-lg font-semibold text-base-content">
                            #{selectedEntry.installmentNumber} due {selectedEntry.dueDate}
                          </h3>
                          <p className="text-sm text-base-content/65">{selectedGroup.customerName}</p>
                        </div>
                        <WorkspaceStatusPill tone={getCollectionTone(selectedEntry.collectionState)}>
                          {selectedEntry.collectionState}
                        </WorkspaceStatusPill>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricCard label="Installment amount" value={formatCurrency(selectedEntry.installmentAmount)} description="Scheduled installment for this due row." />
                        <MetricCard label="Already paid" value={formatCurrency(selectedEntry.paidAmount)} description="Amount already posted against this installment." />
                        <MetricCard label="Outstanding" value={formatCurrency(selectedEntry.outstandingAmount)} description="Remaining collectible amount on the selected installment." />
                        <MetricCard label="Loan status" value={selectedEntry.loanStatus} description="Current loan lifecycle status for this collection record." />
                      </div>
                    </div>
                  ) : (
                    <WorkspaceEmptyState>
                      Select an installment from the queue table to prepare collection posting.
                    </WorkspaceEmptyState>
                  )}
                </WorkspaceForm>
              </WorkspacePanel>
            </div>
          )}
        </RecordSurfaceModal>
      </RecordWorkspace>
    </ProtectedRoute>
  );
}
