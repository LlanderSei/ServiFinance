import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateTenantServiceRequestRequest,
  FinalizeTenantServiceInvoiceRequest,
  TenantCustomerRow,
  TenantServiceRequestDetailResponse,
  TenantServiceRequestRow
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
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
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";

type InvoiceFormState = {
  subtotalAmount: string;
  interestableAmount: string;
  discountAmount: string;
  remarks: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
});

export function SmsServiceRequestsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const currentUser = getCurrentSession()?.user ?? null;
  const isAdmin = currentUser?.roles.includes("Administrator") ?? false;
  const [selectedRequest, setSelectedRequest] = useState<TenantServiceRequestRow | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTenantServiceRequestRequest>({
    customerId: "",
    itemType: "",
    itemDescription: "",
    issueDescription: "",
    requestedServiceDate: "",
    priority: "Normal"
  });
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>({
    subtotalAmount: "",
    interestableAmount: "",
    discountAmount: "0",
    remarks: ""
  });

  const requestsQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"],
    queryFn: () => httpGet<TenantServiceRequestRow[]>(`/api/tenants/${tenantDomainSlug}/sms/service-requests`)
  });
  const customersQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-customers"],
    queryFn: () => httpGet<TenantCustomerRow[]>(`/api/tenants/${tenantDomainSlug}/sms/customers`)
  });
  const requestDetailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", selectedRequest?.id],
    queryFn: () =>
      httpGet<TenantServiceRequestDetailResponse>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests/${selectedRequest?.id}/details`
      ),
    enabled: selectedRequest !== null
  });

  const createRequestMutation = useMutation({
    mutationFn: (payload: CreateTenantServiceRequestRequest) =>
      httpPostJson<TenantServiceRequestRow, CreateTenantServiceRequestRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests`,
        payload
      ),
    onSuccess: (serviceRequest) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-customers"] });
      setSelectedRequest(serviceRequest);
      setIsCreateModalOpen(false);
      setForm({
        customerId: "",
        itemType: "",
        itemDescription: "",
        issueDescription: "",
        requestedServiceDate: "",
        priority: "Normal"
      });
      setMessage("Service request created.");
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  const finalizeInvoiceMutation = useMutation({
    mutationFn: ({ serviceRequestId, payload }: { serviceRequestId: string; payload: FinalizeTenantServiceInvoiceRequest }) =>
      httpPostJson<TenantServiceRequestDetailResponse, FinalizeTenantServiceInvoiceRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests/${serviceRequestId}/finalize-invoice`,
        payload
      ),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", response.serviceRequest.id]
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      setSelectedRequest(response.serviceRequest);
      setIsFinalizeModalOpen(false);
      setInvoiceForm({
        subtotalAmount: "",
        interestableAmount: "",
        discountAmount: "0",
        remarks: ""
      });
      setMessage(`Invoice ${response.serviceRequest.invoiceNumber ?? ""} finalized for finance handoff.`);
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  const activeRequest = requestDetailQuery.data?.serviceRequest ?? selectedRequest;

  const requestDetails = useMemo(() => {
    if (!activeRequest) {
      return [];
    }

    return [
      {
        title: "Request summary",
        items: [
          { label: "Request number", value: activeRequest.requestNumber },
          { label: "Customer", value: `${activeRequest.customerName} (${activeRequest.customerCode})` },
          { label: "Item type", value: activeRequest.itemType },
          { label: "Priority", value: activeRequest.priority }
        ]
      },
      {
        title: "Work details",
        items: [
          { label: "Item description", value: activeRequest.itemDescription || "Not provided" },
          { label: "Issue description", value: activeRequest.issueDescription },
          {
            label: "Requested service date",
            value: activeRequest.requestedServiceDate
              ? new Date(activeRequest.requestedServiceDate).toLocaleDateString("en-PH")
              : "Not scheduled"
          },
          { label: "Current status", value: activeRequest.currentStatus }
        ]
      },
      {
        title: "Finance handoff",
        items: [
          {
            label: "Handoff state",
            value: (
              <WorkspaceStatusPill tone={getFinanceTone(activeRequest.financeHandoffStatus)}>
                {activeRequest.financeHandoffStatus}
              </WorkspaceStatusPill>
            )
          },
          {
            label: "Invoice",
            value: activeRequest.invoiceNumber
              ? `${activeRequest.invoiceNumber} (${activeRequest.invoiceStatus ?? "Unknown"})`
              : "No finalized invoice yet"
          },
          {
            label: "Invoice total",
            value: activeRequest.invoiceTotalAmount !== null ? formatMoney(activeRequest.invoiceTotalAmount) : "Not available"
          },
          {
            label: "Loan conversion",
            value: activeRequest.hasMicroLoan
              ? "Converted to micro-loan in MLS."
              : activeRequest.canConvertToLoan
                ? "Ready for desktop loan conversion."
                : "Not yet eligible for loan conversion."
          }
        ]
      },
      {
        title: "Audit trail",
        items: [
          {
            label: "History",
            value: requestDetailQuery.data?.auditTrail.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {requestDetailQuery.data.auditTrail.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.status}</strong>
                    <span className="text-base-content/70">{entry.remarks}</span>
                    <small className="text-base-content/60">{entry.changedByUserName} - {new Date(entry.changedAtUtc).toLocaleString("en-PH")}</small>
                  </li>
                ))}
              </ul>
            ) : requestDetailQuery.isLoading ? "Loading history..." : "No audit entries yet."
          }
        ]
      },
      {
        title: "Provenance",
        items: [
          { label: "Created by", value: activeRequest.createdByUserName },
          { label: "Created", value: new Date(activeRequest.createdAtUtc).toLocaleString("en-PH") }
        ]
      }
    ];
  }, [activeRequest, requestDetailQuery.data?.auditTrail, requestDetailQuery.isLoading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRequestMutation.mutate({
      ...form,
      requestedServiceDate: form.requestedServiceDate || null
    });
  }

  function handleFinalizeInvoiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest) {
      return;
    }

    finalizeInvoiceMutation.mutate({
      serviceRequestId: activeRequest.id,
      payload: {
        subtotalAmount: Number(invoiceForm.subtotalAmount),
        interestableAmount: Number(invoiceForm.interestableAmount),
        discountAmount: Number(invoiceForm.discountAmount || 0),
        remarks: invoiceForm.remarks || null
      }
    });
  }

  function openFinalizeInvoiceModal() {
    if (!activeRequest) {
      return;
    }

    setInvoiceForm({
      subtotalAmount: "",
      interestableAmount: "",
      discountAmount: "0",
      remarks: `Service work for ${activeRequest.requestNumber}`
    });
    setIsFinalizeModalOpen(true);
  }

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Service Requests`}
          title="Service requests"
          description="Track intake, priority, status progression, invoice handoff readiness, and customer-linked service work from one tenant-scoped request register."
          recordCount={requestsQuery.data?.length ?? 0}
          singularLabel="request"
        >
          <RecordContentStack>
            {message ? <WorkspaceNotice>{message}</WorkspaceNotice> : null}
            {error ? <WorkspaceNotice tone="error">{error}</WorkspaceNotice> : null}

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
                    <th>Requested Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requestsQuery.isLoading ? (
                    <RecordTableStateRow colSpan={8}>Loading service requests...</RecordTableStateRow>
                  ) : null}

                  {requestsQuery.isError ? (
                    <RecordTableStateRow colSpan={8} tone="error">
                      Unable to load service requests.
                    </RecordTableStateRow>
                  ) : null}

                  {!requestsQuery.isLoading && !requestsQuery.isError && !requestsQuery.data?.length ? (
                    <RecordTableStateRow colSpan={8}>No service requests yet.</RecordTableStateRow>
                  ) : null}

                  {requestsQuery.data?.map((serviceRequest) => (
                    <tr key={serviceRequest.id}>
                      <td>{serviceRequest.requestNumber}</td>
                      <td>{serviceRequest.customerName}</td>
                      <td>{serviceRequest.itemType}</td>
                      <td>{serviceRequest.priority}</td>
                      <td>
                        <WorkspaceStatusPill tone="active">{serviceRequest.currentStatus}</WorkspaceStatusPill>
                      </td>
                      <td>
                        <WorkspaceStatusPill tone={getFinanceTone(serviceRequest.financeHandoffStatus)}>
                          {serviceRequest.financeHandoffStatus}
                        </WorkspaceStatusPill>
                      </td>
                      <td>
                        {serviceRequest.requestedServiceDate
                          ? new Date(serviceRequest.requestedServiceDate).toLocaleDateString("en-PH")
                          : "-"}
                      </td>
                      <td>
                        <RecordTableActionButton onClick={() => setSelectedRequest(serviceRequest)}>
                          View
                        </RecordTableActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </RecordTable>
            </RecordTableShell>

            <WorkspaceFabDock
              actions={[
                {
                  key: "refresh-service-requests",
                  label: "Refresh service requests",
                  icon: "refresh",
                  onClick: () => {
                    void requestsQuery.refetch();
                    void customersQuery.refetch();
                  }
                },
                {
                  key: "add-service-request",
                  label: "Create service request",
                  icon: "request",
                  onClick: () => setIsCreateModalOpen(true),
                  disabled: customersQuery.isLoading || !customersQuery.data?.length
                }
              ]}
            />
          </RecordContentStack>
        </RecordWorkspace>

        <RecordFormModal
          open={isCreateModalOpen}
          eyebrow="Service intake"
          title="Create service request"
          description="Register the customer issue, requested date, and operating priority without leaving the request workspace."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-service-request-form"
                tone="primary"
                disabled={createRequestMutation.isPending || !customersQuery.data?.length}
              >
                {createRequestMutation.isPending ? "Creating..." : "Create service request"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsCreateModalOpen(false)}
        >
          <WorkspaceForm id="tenant-service-request-form" onSubmit={handleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Customer">
                <WorkspaceSelect
                  value={form.customerId}
                  onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                  required
                >
                  <option value="">Select customer</option>
                  {customersQuery.data?.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName} ({customer.customerCode})
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Item type">
                <WorkspaceInput
                  value={form.itemType}
                  onChange={(event) => setForm((current) => ({ ...current, itemType: event.target.value }))}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Item description">
                <WorkspaceInput
                  value={form.itemDescription}
                  onChange={(event) => setForm((current) => ({ ...current, itemDescription: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Priority">
                <WorkspaceSelect
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Requested service date">
                <WorkspaceInput
                  type="date"
                  value={form.requestedServiceDate ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, requestedServiceDate: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Issue description" wide>
                <WorkspaceInput
                  value={form.issueDescription}
                  onChange={(event) => setForm((current) => ({ ...current, issueDescription: event.target.value }))}
                  required
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isFinalizeModalOpen}
          eyebrow="Finance handoff"
          title="Finalize service invoice"
          description="Convert the completed service work into a finance-ready invoice so MLS can evaluate desktop loan conversion."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsFinalizeModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-finalize-invoice-form"
                tone="primary"
                disabled={finalizeInvoiceMutation.isPending}
              >
                {finalizeInvoiceMutation.isPending ? "Finalizing..." : "Finalize invoice"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsFinalizeModalOpen(false)}
        >
          <WorkspaceForm id="tenant-finalize-invoice-form" onSubmit={handleFinalizeInvoiceSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Subtotal amount">
                <WorkspaceInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.subtotalAmount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, subtotalAmount: event.target.value }))}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Interestable amount">
                <WorkspaceInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.interestableAmount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, interestableAmount: event.target.value }))}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Discount amount">
                <WorkspaceInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.discountAmount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, discountAmount: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Invoice remarks" wide>
                <WorkspaceInput
                  value={invoiceForm.remarks}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, remarks: event.target.value }))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordDetailsModal
          open={selectedRequest !== null}
          eyebrow="Service request details"
          title={activeRequest?.requestNumber ?? ""}
          sections={requestDetails}
          actions={activeRequest ? (
            <>
              <WorkspaceModalButton onClick={() => setSelectedRequest(null)}>
                Close
              </WorkspaceModalButton>
              {isAdmin && activeRequest.canFinalizeInvoice ? (
                <WorkspaceModalButton tone="primary" onClick={openFinalizeInvoiceModal}>
                  Finalize invoice
                </WorkspaceModalButton>
              ) : null}
            </>
          ) : null}
          onClose={() => setSelectedRequest(null)}
        />
      </>
    </ProtectedRoute>
  );
}

function formatMoney(amount: number) {
  return currencyFormatter.format(amount);
}

function getFinanceTone(status: string) {
  switch (status) {
    case "Loan created":
      return "active";
    case "Ready for loan conversion":
    case "Ready for invoicing":
      return "warning";
    case "Invoice finalized":
      return "progress";
    default:
      return "neutral";
  }
}
