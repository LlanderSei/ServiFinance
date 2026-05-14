import { useState } from "react";
import type { TenantServiceRequestRow } from "@/shared/api/contracts";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { MobileRecordField, MobileRecordFieldGrid } from "@/shared/records/MobileRecordDetails";
import {
  WorkspaceActionButton,
  WorkspaceFilter,
  WorkspaceInput,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import {
  formatFeedbackCell,
  getFinanceTone,
  type ServiceRequestFilterState
} from "./serviceRequestTabs";

export type ServiceRequestTabProps = {
  filters: ServiceRequestFilterState;
  statusOptions: string[];
  priorityOptions: string[];
  financeStatusOptions: string[];
  serviceModeOptions: string[];
  tabRequests: TenantServiceRequestRow[];
  visibleRequests: TenantServiceRequestRow[];
  isLoading: boolean;
  isError: boolean;
  onChangeFilters: (filters: ServiceRequestFilterState) => void;
  onClearFilters: () => void;
  onViewRequest: (serviceRequest: TenantServiceRequestRow) => void;
};

type ServiceRequestTabPanelProps = ServiceRequestTabProps & {
  emptyLabel: string;
};

export function ServiceRequestTabPanel({
  filters,
  statusOptions,
  priorityOptions,
  financeStatusOptions,
  serviceModeOptions,
  tabRequests,
  visibleRequests,
  isLoading,
  isError,
  emptyLabel,
  onChangeFilters,
  onClearFilters,
  onViewRequest
}: ServiceRequestTabPanelProps) {
  return (
    <>
      <ServiceRequestFilterBar
        filters={filters}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        financeStatusOptions={financeStatusOptions}
        serviceModeOptions={serviceModeOptions}
        onChange={onChangeFilters}
        onClear={onClearFilters}
      />

      <RecordTableShell>
        <RecordTable>
          <thead>
            <tr>
              <th>Request No.</th>
              <th>Customer</th>
              <th>Item Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Finance</th>
              <th>Feedback</th>
              <th>Requested Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <RecordTableStateRow colSpan={9}>Loading service requests...</RecordTableStateRow>
            ) : null}

            {isError ? (
              <RecordTableStateRow colSpan={9} tone="error">
                Unable to load service requests.
              </RecordTableStateRow>
            ) : null}

            {!isLoading && !isError && !tabRequests.length ? (
              <RecordTableStateRow colSpan={9}>No {emptyLabel} service requests yet.</RecordTableStateRow>
            ) : null}

            {!isLoading && !isError && tabRequests.length > 0 && !visibleRequests.length ? (
              <RecordTableStateRow colSpan={9}>No service requests match the current filters.</RecordTableStateRow>
            ) : null}

            {visibleRequests.map((serviceRequest) => (
              <tr key={serviceRequest.id}>
                <td>
                  <div className="grid gap-3 lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <MobileRecordFieldGrid className="min-w-0">
                        <strong className="block text-sm text-base-content">{serviceRequest.requestNumber}</strong>
                        <MobileRecordField label="Customer" value={serviceRequest.customerName} />
                        <MobileRecordField label="Item Type" value={serviceRequest.itemType} />
                        <MobileRecordField
                          label="Requested Date"
                          value={serviceRequest.requestedServiceDate ? new Date(serviceRequest.requestedServiceDate).toLocaleDateString("en-PH") : "-"}
                        />
                      </MobileRecordFieldGrid>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <WorkspaceStatusPill tone="active">{serviceRequest.currentStatus}</WorkspaceStatusPill>
                        <WorkspaceStatusPill tone={getFinanceTone(serviceRequest.financeHandoffStatus)}>
                          {serviceRequest.financeHandoffStatus}
                        </WorkspaceStatusPill>
                        <WorkspaceStatusPill tone="neutral">{serviceRequest.priority}</WorkspaceStatusPill>
                      </div>
                    </div>
                    <MobileRecordField label="Feedback" value={formatFeedbackCell(serviceRequest)} />
                  </div>
                  <span className="hidden lg:inline">{serviceRequest.requestNumber}</span>
                </td>
                <td className="max-lg:hidden">{serviceRequest.customerName}</td>
                <td className="max-lg:hidden">{serviceRequest.itemType}</td>
                <td className="max-lg:hidden">{serviceRequest.priority}</td>
                <td className="max-lg:hidden">
                  <WorkspaceStatusPill tone="active">{serviceRequest.currentStatus}</WorkspaceStatusPill>
                </td>
                <td className="max-lg:hidden">
                  <WorkspaceStatusPill tone={getFinanceTone(serviceRequest.financeHandoffStatus)}>
                    {serviceRequest.financeHandoffStatus}
                  </WorkspaceStatusPill>
                </td>
                <td className="max-lg:hidden">{formatFeedbackCell(serviceRequest)}</td>
                <td className="max-lg:hidden">
                  {serviceRequest.requestedServiceDate
                    ? new Date(serviceRequest.requestedServiceDate).toLocaleDateString("en-PH")
                    : "-"}
                </td>
                <td>
                  <div className="grid w-full grid-cols-1 gap-2 lg:block">
                    <RecordTableActionButton onClick={() => onViewRequest(serviceRequest)}>
                      View
                    </RecordTableActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      </RecordTableShell>
    </>
  );
}

function ServiceRequestFilterBar({
  filters,
  statusOptions,
  priorityOptions,
  financeStatusOptions,
  serviceModeOptions,
  onChange,
  onClear
}: {
  filters: ServiceRequestFilterState;
  statusOptions: string[];
  priorityOptions: string[];
  financeStatusOptions: string[];
  serviceModeOptions: string[];
  onChange: (filters: ServiceRequestFilterState) => void;
  onClear: () => void;
}) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  return (
    <>
      <section className="rounded-box border border-base-300/65 bg-base-100 px-3 py-3 shadow-sm lg:px-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 lg:flex lg:items-end lg:overflow-hidden">
          <label className="col-span-2 grid min-w-0 gap-1.5 lg:col-span-1 lg:w-72 lg:shrink-0">
            <span className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-base-content/60">Search</span>
            <input
              type="search"
              className="input input-bordered w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
              placeholder="Request, customer, item..."
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
            />
          </label>

          <WorkspaceActionButton className="shrink-0 self-end lg:hidden" onClick={() => setIsMobileFiltersOpen(true)}>
            Options
          </WorkspaceActionButton>

          <WorkspaceActionButton className="shrink-0 self-end" onClick={onClear}>
            Clear
          </WorkspaceActionButton>

          <div className="hidden min-w-0 overflow-x-auto overflow-y-hidden pb-1 lg:block lg:flex-1">
            <div className="flex w-max items-end gap-3 pr-10">
              <ServiceRequestFilterFields
                filters={filters}
                statusOptions={statusOptions}
                priorityOptions={priorityOptions}
                financeStatusOptions={financeStatusOptions}
                serviceModeOptions={serviceModeOptions}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
      </section>

      {isMobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-[165] grid place-items-end bg-black/45 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Service request filter options"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <section
            className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-base-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-base-300/70 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-base-content/55">Filters</p>
                <h2 className="mt-1 text-lg font-bold text-base-content">Request options</h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-sm border-base-300/70 bg-base-100 shadow-none"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close request filters"
              >
                x
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="grid gap-4">
                <ServiceRequestFilterFields
                  filters={filters}
                  statusOptions={statusOptions}
                  priorityOptions={priorityOptions}
                  financeStatusOptions={financeStatusOptions}
                  serviceModeOptions={serviceModeOptions}
                  onChange={onChange}
                />
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-base-300/70 bg-base-200/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <WorkspaceActionButton onClick={onClear}>
                Clear filters
              </WorkspaceActionButton>
              <WorkspaceActionButton onClick={() => setIsMobileFiltersOpen(false)}>
                Apply
              </WorkspaceActionButton>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ServiceRequestFilterFields({
  filters,
  statusOptions,
  priorityOptions,
  financeStatusOptions,
  serviceModeOptions,
  onChange
}: {
  filters: ServiceRequestFilterState;
  statusOptions: string[];
  priorityOptions: string[];
  financeStatusOptions: string[];
  serviceModeOptions: string[];
  onChange: (filters: ServiceRequestFilterState) => void;
}) {
  return (
    <>
      <WorkspaceFilter label="Status">
        <WorkspaceSelect
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Priority">
        <WorkspaceSelect
          value={filters.priority}
          onChange={(event) => onChange({ ...filters, priority: event.target.value })}
        >
          <option value="">All priorities</option>
          {priorityOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Finance">
        <WorkspaceSelect
          value={filters.financeStatus}
          onChange={(event) => onChange({ ...filters, financeStatus: event.target.value })}
        >
          <option value="">All finance states</option>
          {financeStatusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Feedback">
        <WorkspaceSelect
          value={filters.feedbackState}
          onChange={(event) => onChange({ ...filters, feedbackState: event.target.value })}
        >
          <option value="">All feedback</option>
          <option value="rated">Rated</option>
          <option value="pending">Feedback open</option>
          <option value="expired">Feedback expired</option>
          <option value="none">No feedback</option>
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Service mode">
        <WorkspaceSelect
          value={filters.serviceMode}
          onChange={(event) => onChange({ ...filters, serviceMode: event.target.value })}
        >
          <option value="">All modes</option>
          {serviceModeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </WorkspaceSelect>
      </WorkspaceFilter>

      <WorkspaceFilter label="Date from">
        <WorkspaceInput
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
        />
      </WorkspaceFilter>

      <WorkspaceFilter label="Date to">
        <WorkspaceInput
          type="date"
          value={filters.dateTo}
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
        />
      </WorkspaceFilter>
    </>
  );
}
