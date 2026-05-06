import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateTenantServiceRequestRequest,
  FinalizeTenantServiceInvoiceRequest,
  RecordTenantServiceInvoicePaymentRequest,
  SaveTenantServiceCostSheetRequest,
  ServiceCostPreset,
  ServiceCostSheet,
  TenantCustomerRow,
  TenantCostingPolicy,
  TenantServiceRequestDetailResponse,
  TenantServiceRequestRow
} from "@/shared/api/contracts";
import { httpGet, httpPostJson, httpPutJson } from "@/shared/api/http";
import { getCurrentSession } from "@/shared/auth/session";
import { AddressLookupField } from "@/shared/location/AddressLookupField";
import { formatFullAddress } from "@/shared/location/formatAddress";
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
  WorkspaceActionButton,
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceSelect,
  WorkspaceStatusPill
} from "@/shared/records/WorkspaceControls";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

type InvoiceFormState = {
  subtotalAmount: string;
  interestableAmount: string;
  discountAmount: string;
  remarks: string;
};

type PaymentFormState = {
  amountReceived: string;
  paymentMethod: string;
  referenceNumber: string;
  note: string;
};

type CostLineFormState = {
  id: string | null;
  serviceCostPresetId: string | null;
  category: string;
  name: string;
  specification: string;
  quantity: string;
  unitPrice: string;
  sortOrder: number;
  clientId: string;
};

type CostSheetFormState = {
  isTaxEnabled: boolean;
  taxLabel: string;
  taxRate: string;
  notes: string;
  lines: CostLineFormState[];
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
});

export function SmsServiceRequestsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = getCurrentSession()?.user ?? null;
  const isAdmin = (currentUser?.roles.includes("Administrator") ?? false) || (currentUser?.roles.includes("Owner") ?? false);
  const [selectedRequest, setSelectedRequest] = useState<TenantServiceRequestRow | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [form, setForm] = useState<CreateTenantServiceRequestRequest>({
    customerId: "",
    itemType: "",
    itemDescription: "",
    issueDescription: "",
    requestedServiceDate: "",
    serviceMode: "Drop-off",
    serviceAddress: "",
    serviceAddressDetails: "",
    contactName: "",
    contactPhone: "",
    preferredScheduleStartUtc: "",
    preferredScheduleEndUtc: "",
    neededByUtc: "",
    priority: "Normal"
  });
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>({
    subtotalAmount: "",
    interestableAmount: "",
    discountAmount: "0",
    remarks: ""
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    amountReceived: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    note: ""
  });
  const [costSheetForm, setCostSheetForm] = useState<CostSheetFormState>({
    isTaxEnabled: true,
    taxLabel: "VAT",
    taxRate: "12",
    notes: "",
    lines: []
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
        serviceMode: "Drop-off",
        serviceAddress: "",
        serviceAddressDetails: "",
        contactName: "",
        contactPhone: "",
        preferredScheduleStartUtc: "",
        preferredScheduleEndUtc: "",
        neededByUtc: "",
        priority: "Normal"
      });
      toast.success({
        title: "Service request created",
        message: `Request ${serviceRequest.requestNumber} is now in the tenant intake register.`
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create service request",
        message: mutationError.message
      });
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
      toast.success({
        title: "Invoice finalized",
        message: `Invoice ${response.serviceRequest.invoiceNumber ?? ""} is now ready for finance handoff.`
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to finalize invoice",
        message: mutationError.message
      });
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ serviceRequestId, payload }: { serviceRequestId: string; payload: RecordTenantServiceInvoicePaymentRequest }) =>
      httpPostJson<TenantServiceRequestDetailResponse, RecordTenantServiceInvoicePaymentRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests/${serviceRequestId}/record-payment`,
        payload
      ),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", response.serviceRequest.id]
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "mls-customer-finance"] });
      setSelectedRequest(response.serviceRequest);
      setIsRecordPaymentModalOpen(false);
      setPaymentForm({
        amountReceived: "",
        paymentMethod: "Cash",
        referenceNumber: "",
        note: ""
      });
      toast.success({
        title: "Payment recorded",
        message: `Direct payment is now reflected on invoice ${response.serviceRequest.invoiceNumber ?? ""}.`
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to record payment",
        message: mutationError.message
      });
    }
  });

  const saveCostSheetMutation = useMutation({
    mutationFn: ({ serviceRequestId, payload }: { serviceRequestId: string; payload: SaveTenantServiceCostSheetRequest }) =>
      httpPutJson<TenantServiceRequestDetailResponse, SaveTenantServiceCostSheetRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests/${serviceRequestId}/cost-sheet`,
        payload
      ),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", response.serviceRequest.id]
      });
      setSelectedRequest(response.serviceRequest);
      setIsCostingModalOpen(false);
      toast.success({
        title: "Cost sheet updated",
        message: "Draft service costing is now visible in the tenant and customer request details."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to save cost sheet",
        message: mutationError.message
      });
    }
  });

  const activeRequest = requestDetailQuery.data?.serviceRequest ?? selectedRequest;
  const activeCostSheet = requestDetailQuery.data?.costSheet ?? null;
  const costingPolicy = requestDetailQuery.data?.costingPolicy ?? null;
  const costPresets = requestDetailQuery.data?.costPresets ?? [];
  const canRecordDirectPayment = Boolean(
    isAdmin &&
    activeRequest?.invoiceId &&
    !activeRequest.hasMicroLoan &&
    (activeRequest.invoiceOutstandingAmount ?? 0) > 0 &&
    activeRequest.invoiceStatus !== "Payment Submitted" &&
    activeRequest.invoiceStatus !== "Checkout Pending"
  );
  const costLineCategories = useMemo(
    () => [...new Set(["Base Charge", "Part Replacement", "Service", "Fee", "Other", ...costPresets.map((preset) => preset.category)])],
    [costPresets]
  );

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
        title: "Visit and availability",
        items: [
          { label: "Service mode", value: activeRequest.serviceMode || "Drop-off" },
          { label: "Service address", value: formatFullAddress(activeRequest.serviceAddress, activeRequest.serviceAddressDetails) },
          {
            label: "Customer contact",
            value: activeRequest.contactName || activeRequest.contactPhone
              ? `${activeRequest.contactName || "No contact name"}${activeRequest.contactPhone ? ` - ${activeRequest.contactPhone}` : ""}`
              : "Not provided"
          },
          {
            label: "Preferred schedule",
            value: formatScheduleRange(activeRequest.preferredScheduleStartUtc, activeRequest.preferredScheduleEndUtc)
          },
          {
            label: "Needed by",
            value: activeRequest.neededByUtc ? formatDateTime(activeRequest.neededByUtc) : "No due preference"
          }
        ]
      },
      {
        title: "Cancellation state",
        items: [
          {
            label: "Cancellation requested",
            value: activeRequest.cancellationRequestedAtUtc ? formatDateTime(activeRequest.cancellationRequestedAtUtc) : "No cancellation request"
          },
          {
            label: "Cancelled",
            value: activeRequest.cancelledAtUtc ? formatDateTime(activeRequest.cancelledAtUtc) : "Not cancelled"
          },
          { label: "Reason", value: activeRequest.cancellationReason ?? "No reason recorded" }
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
        title: "Service costing",
        items: [
          {
            label: "Draft state",
            value: activeCostSheet
              ? `${activeCostSheet.status} / ${activeCostSheet.lines.length} line${activeCostSheet.lines.length === 1 ? "" : "s"}`
              : "No draft cost sheet yet"
          },
          {
            label: "Commercial summary",
            value: activeCostSheet ? (
              <div className="grid gap-2 text-sm">
                <span>Subtotal: {formatMoney(activeCostSheet.subtotalAmount)}</span>
                <span>
                  {activeCostSheet.taxLabel}: {activeCostSheet.isTaxEnabled ? formatMoney(activeCostSheet.taxAmount) : "Disabled"}
                </span>
                <span>Total: {formatMoney(activeCostSheet.totalAmount)}</span>
              </div>
            ) : "Draft totals will appear here after the costing sheet is saved."
          },
          {
            label: "Notes",
            value: activeCostSheet?.notes ?? "No costing notes recorded."
          },
          {
            label: "Lines",
            value: activeCostSheet?.lines.length ? (
              <div className="grid gap-2">
                {activeCostSheet.lines.map((line) => (
                  <div key={line.id} className="rounded-2xl border border-base-300/70 bg-base-100/80 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <strong className="text-base-content">{line.name}</strong>
                        <div className="text-xs uppercase tracking-[0.08em] text-base-content/55">{line.category}</div>
                      </div>
                      <span className="font-semibold text-base-content">{formatMoney(line.lineTotal)}</span>
                    </div>
                    {line.specification ? (
                      <p className="mt-2 text-base-content/68">{line.specification}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-base-content/60">
                      Qty {line.quantity} / Unit {formatMoney(line.unitPrice)}
                    </p>
                  </div>
                ))}
              </div>
            ) : "No cost lines yet."
          }
        ]
      },
      {
        title: "Customer feedback",
        items: [
          {
            label: "Rating",
            value: activeRequest.rating !== null ? `${activeRequest.rating}/5` : "No rating submitted"
          },
          {
            label: "Suggestion",
            value: activeRequest.feedbackSuggestionCategory ?? "No suggestion category"
          },
          {
            label: "Comments",
            value: activeRequest.feedbackComments ?? "No feedback comments"
          },
          {
            label: "Feedback window",
            value: activeRequest.feedbackSubmittedAtUtc
              ? `Submitted ${formatDateTime(activeRequest.feedbackSubmittedAtUtc)}`
              : activeRequest.feedbackExpiresAtUtc
                ? `Open until ${formatDateTime(activeRequest.feedbackExpiresAtUtc)}`
                : "Opens after completion"
          }
        ]
      },
      {
        title: "Customer pictures",
        items: [
          {
            label: "Attachments",
            value: requestDetailQuery.data?.attachments.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {requestDetailQuery.data.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.relativeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-2xl border border-base-300/70 bg-base-200/40 no-underline"
                  >
                    <img
                      src={attachment.relativeUrl}
                      alt={attachment.originalFileName}
                      className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="grid gap-1 px-3 py-3">
                      <strong className="truncate text-sm text-base-content">{attachment.originalFileName}</strong>
                      <span className="text-xs text-base-content/60">
                        {attachment.submittedByCustomerName} - {formatDateTime(attachment.createdAtUtc)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : requestDetailQuery.isLoading ? "Loading customer pictures..." : "No customer pictures uploaded."
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
  }, [activeCostSheet, activeRequest, requestDetailQuery.data?.attachments, requestDetailQuery.data?.auditTrail, requestDetailQuery.isLoading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRequestMutation.mutate({
      ...form,
      requestedServiceDate: form.requestedServiceDate || null,
      serviceMode: form.serviceMode || "Drop-off",
      serviceAddress: form.serviceAddress || null,
      serviceAddressDetails: form.serviceAddressDetails || null,
      contactName: form.contactName || null,
      contactPhone: form.contactPhone || null,
      preferredScheduleStartUtc: form.preferredScheduleStartUtc ? new Date(form.preferredScheduleStartUtc).toISOString() : null,
      preferredScheduleEndUtc: form.preferredScheduleEndUtc ? new Date(form.preferredScheduleEndUtc).toISOString() : null,
      neededByUtc: form.neededByUtc ? new Date(form.neededByUtc).toISOString() : null
    });
  }

  function handleFinalizeInvoiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest) {
      return;
    }

    const subtotalAmount = activeCostSheet?.lines.length
      ? activeCostSheet.subtotalAmount
      : Number(invoiceForm.subtotalAmount);

    finalizeInvoiceMutation.mutate({
      serviceRequestId: activeRequest.id,
      payload: {
        subtotalAmount,
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
      subtotalAmount: activeCostSheet?.lines.length ? String(activeCostSheet.subtotalAmount) : "",
      interestableAmount: "",
      discountAmount: "0",
      remarks: `Service work for ${activeRequest.requestNumber}`
    });
    setIsFinalizeModalOpen(true);
  }

  function openRecordPaymentModal() {
    if (!activeRequest || activeRequest.invoiceOutstandingAmount === null) {
      return;
    }

    setPaymentForm({
      amountReceived: String(activeRequest.invoiceOutstandingAmount),
      paymentMethod: "Cash",
      referenceNumber: "",
      note: ""
    });
    setIsRecordPaymentModalOpen(true);
  }

  function openCostingModal() {
    const detailResponse = requestDetailQuery.data;
    if (!activeRequest || !detailResponse) {
      return;
    }

    const initialPolicy = detailResponse.costingPolicy;
    const initialCostSheet = detailResponse.costSheet;
    setCostSheetForm({
      isTaxEnabled: initialCostSheet?.isTaxEnabled ?? initialPolicy.taxEnabledByDefault,
      taxLabel: initialCostSheet?.taxLabel ?? initialPolicy.taxLabel,
      taxRate: String(initialCostSheet?.taxRate ?? initialPolicy.defaultTaxRate),
      notes: initialCostSheet?.notes ?? "",
      lines: initialCostSheet?.lines.map((line, index) => createCostLineFormState({
        id: line.id,
        serviceCostPresetId: line.serviceCostPresetId,
        category: line.category,
        name: line.name,
        specification: line.specification ?? "",
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        sortOrder: index
      })) ?? []
    });
    setSelectedPresetId(detailResponse.costPresets[0]?.id ?? "");
    setIsCostingModalOpen(true);
  }

  function handleCostSheetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest) {
      return;
    }

    saveCostSheetMutation.mutate({
      serviceRequestId: activeRequest.id,
      payload: {
        isTaxEnabled: costSheetForm.isTaxEnabled,
        taxLabel: costSheetForm.taxLabel,
        taxRate: Number(costSheetForm.taxRate),
        notes: costSheetForm.notes || null,
        lines: costSheetForm.lines.map((line, index) => ({
          id: line.id,
          serviceCostPresetId: line.serviceCostPresetId,
          category: line.category,
          name: line.name,
          specification: line.specification || null,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          sortOrder: index
        }))
      }
    });
  }

  function handleRecordPaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest) {
      return;
    }

    recordPaymentMutation.mutate({
      serviceRequestId: activeRequest.id,
      payload: {
        amountReceived: Number(paymentForm.amountReceived),
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber.trim() || null,
        note: paymentForm.note.trim() || null
      }
    });
  }

  function addCustomCostLine() {
    const defaultCategory = costLineCategories[0] ?? "Base Charge";
    setCostSheetForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        createCostLineFormState({
          category: defaultCategory,
          quantity: "1",
          unitPrice: "0",
          sortOrder: current.lines.length
        })
      ]
    }));
  }

  function addPresetCostLine() {
    const preset = costPresets.find((entity) => entity.id === selectedPresetId);
    if (!preset) {
      return;
    }

    setCostSheetForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        createCostLineFormState({
          serviceCostPresetId: preset.id,
          category: preset.category,
          name: preset.name,
          specification: preset.defaultSpecification ?? "",
          quantity: String(preset.defaultQuantity),
          unitPrice: String(preset.defaultUnitPrice),
          sortOrder: current.lines.length
        })
      ]
    }));
  }

  function updateCostLine(clientId: string, field: keyof Omit<CostLineFormState, "clientId">, value: string | number | null) {
    setCostSheetForm((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              [field]: value
            }
          : line)
    }));
  }

  function removeCostLine(clientId: string) {
    setCostSheetForm((current) => ({
      ...current,
      lines: current.lines
        .filter((line) => line.clientId !== clientId)
        .map((line, index) => ({
          ...line,
          sortOrder: index
        }))
    }));
  }

  const costingPreview = useMemo(() => {
    const subtotalAmount = costSheetForm.lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0
    );
    const roundedSubtotalAmount = roundCurrency(subtotalAmount);
    const taxAmount = costSheetForm.isTaxEnabled
      ? roundCurrency(roundedSubtotalAmount * ((Number(costSheetForm.taxRate) || 0) / 100))
      : 0;
    return {
      subtotalAmount: roundedSubtotalAmount,
      taxAmount,
      totalAmount: roundCurrency(roundedSubtotalAmount + taxAmount)
    };
  }, [costSheetForm]);

  return (
    <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Service Requests`}
          title="Service requests"
          description="Track intake, priority, status progression, invoice handoff readiness, and customer-linked service work from one tenant-scoped request register."
          recordCount={requestsQuery.data?.length ?? 0}
          singularLabel="request"
        >
          <RecordContentStack>
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
                  {requestsQuery.isLoading ? (
                    <RecordTableStateRow colSpan={9}>Loading service requests...</RecordTableStateRow>
                  ) : null}

                  {requestsQuery.isError ? (
                    <RecordTableStateRow colSpan={9} tone="error">
                      Unable to load service requests.
                    </RecordTableStateRow>
                  ) : null}

                  {!requestsQuery.isLoading && !requestsQuery.isError && !requestsQuery.data?.length ? (
                    <RecordTableStateRow colSpan={9}>No service requests yet.</RecordTableStateRow>
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
                      <td>{formatFeedbackCell(serviceRequest)}</td>
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

              <WorkspaceField label="Service mode">
                <WorkspaceSelect
                  value={form.serviceMode ?? "Drop-off"}
                  onChange={(event) => setForm((current) => ({ ...current, serviceMode: event.target.value }))}
                >
                  <option value="Drop-off">Drop-off / customer brings item</option>
                  <option value="On-site">On-site visit</option>
                  <option value="Pickup">Pickup request</option>
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Contact name">
                <WorkspaceInput
                  value={form.contactName ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Contact phone">
                <WorkspaceInput
                  value={form.contactPhone ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Preferred start">
                <WorkspaceInput
                  type="datetime-local"
                  value={form.preferredScheduleStartUtc ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, preferredScheduleStartUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Preferred end">
                <WorkspaceInput
                  type="datetime-local"
                  value={form.preferredScheduleEndUtc ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, preferredScheduleEndUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Needed by">
                <WorkspaceInput
                  type="datetime-local"
                  value={form.neededByUtc ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, neededByUtc: event.target.value }))}
                />
              </WorkspaceField>

              <AddressLookupField
                className="md:col-span-2"
                label="Service address"
                value={form.serviceAddress ?? ""}
                onChange={(value) => setForm((current) => ({ ...current, serviceAddress: value }))}
                placeholder="Required for on-site or pickup work"
                description="Search once if you want a normalized address before dispatch planning."
                required={form.serviceMode === "On-site" || form.serviceMode === "Pickup"}
                variant="workspace"
              />

              <WorkspaceField label="Address details / landmark" wide>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                  value={form.serviceAddressDetails ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, serviceAddressDetails: event.target.value }))}
                  placeholder="Unit, lot, building, floor, landmark, or technician directions"
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
                {activeCostSheet?.lines.length ? (
                  <div className="rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                    <strong>{formatMoney(activeCostSheet.subtotalAmount)}</strong>
                    <p className="mt-1 text-base-content/65">
                      Derived from the draft service cost sheet.
                    </p>
                  </div>
                ) : (
                  <WorkspaceInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceForm.subtotalAmount}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, subtotalAmount: event.target.value }))}
                    required
                  />
                )}
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

              <WorkspaceField label="Tax total">
                <div className="rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                  <strong>{formatMoney(activeCostSheet?.taxAmount ?? 0)}</strong>
                  <p className="mt-1 text-base-content/65">
                    {activeCostSheet?.isTaxEnabled
                      ? `${activeCostSheet.taxLabel} at ${activeCostSheet.taxRate}%`
                      : "No tax applied on this invoice."}
                  </p>
                </div>
              </WorkspaceField>

              <WorkspaceField label="Invoice remarks" wide>
                <WorkspaceInput
                  value={invoiceForm.remarks}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, remarks: event.target.value }))}
                />
              </WorkspaceField>

              {activeCostSheet?.lines.length ? (
                <WorkspaceField label="Projected total" wide>
                  <div className="rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                    <strong>
                      {formatMoney(
                        Math.max(activeCostSheet.totalAmount - Number(invoiceForm.discountAmount || 0), 0)
                      )}
                    </strong>
                    <p className="mt-1 text-base-content/65">
                      Cost sheet total minus any final discount entered above.
                    </p>
                  </div>
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isRecordPaymentModalOpen}
          eyebrow="Direct settlement"
          title="Record confirmed payment"
          description="Confirm cash or e-payment received on the tenant side so the customer and finance trail stay in sync without pushing the invoice into MLS."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsRecordPaymentModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-record-payment-form"
                tone="primary"
                disabled={recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Record payment"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsRecordPaymentModalOpen(false)}
        >
          <WorkspaceForm id="tenant-record-payment-form" onSubmit={handleRecordPaymentSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Amount received">
                <WorkspaceInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amountReceived}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amountReceived: event.target.value }))}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Payment method">
                <WorkspaceSelect
                  value={paymentForm.paymentMethod}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                >
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="Bank transfer">Bank transfer</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Reference number">
                <WorkspaceInput
                  value={paymentForm.referenceNumber}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, referenceNumber: event.target.value }))}
                  placeholder="Optional for cash, required if you want to keep an external reference"
                />
              </WorkspaceField>

              <WorkspaceField label="Invoice balance">
                <div className="rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                  <strong>{formatMoney(activeRequest?.invoiceOutstandingAmount ?? 0)}</strong>
                  <p className="mt-1 text-base-content/65">
                    Remaining amount before this direct payment is applied.
                  </p>
                </div>
              </WorkspaceField>

              <WorkspaceField label="Tenant note" wide>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Optional cashier or settlement note shown in the commercial trail"
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordFormModal
          open={isCostingModalOpen}
          eyebrow="Service costing"
          title={activeRequest ? `${activeRequest.requestNumber} costing` : "Service costing"}
          description="Draft the transparent commercial breakdown that technicians and customers can both track before invoice finalization."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsCostingModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-service-cost-sheet-form"
                tone="primary"
                disabled={saveCostSheetMutation.isPending}
              >
                {saveCostSheetMutation.isPending ? "Saving..." : "Save cost sheet"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsCostingModalOpen(false)}
        >
          <WorkspaceForm id="tenant-service-cost-sheet-form" onSubmit={handleCostSheetSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Tax label">
                <WorkspaceInput
                  value={costSheetForm.taxLabel}
                  onChange={(event) => setCostSheetForm((current) => ({ ...current, taxLabel: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Tax rate (%)">
                <WorkspaceInput
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={costSheetForm.taxRate}
                  onChange={(event) => setCostSheetForm((current) => ({ ...current, taxRate: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Tax toggle" wide>
                <label className="flex items-center gap-3 rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm border-base-300"
                    checked={costSheetForm.isTaxEnabled}
                    onChange={(event) => setCostSheetForm((current) => ({ ...current, isTaxEnabled: event.target.checked }))}
                  />
                  Include {costSheetForm.taxLabel || "tax"} in the draft customer-facing total.
                </label>
              </WorkspaceField>

              <WorkspaceField label="Costing notes" wide>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full border-base-300/70 bg-base-100/95 text-base-content shadow-none"
                  value={costSheetForm.notes}
                  onChange={(event) => setCostSheetForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional technician or admin costing context shown to the customer as part of commercial transparency."
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>

            <div className="grid gap-3 rounded-box border border-base-300/65 bg-base-200/35 px-4 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid flex-1 gap-1.5">
                  <span className="text-[0.8rem] font-bold uppercase tracking-[0.04em] text-base-content/60">Apply preset</span>
                  <WorkspaceSelect
                    value={selectedPresetId}
                    onChange={(event) => setSelectedPresetId(event.target.value)}
                    disabled={!costPresets.length}
                  >
                    <option value="">Select preset</option>
                    {costPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.category} / {preset.name}
                      </option>
                    ))}
                  </WorkspaceSelect>
                </label>

                <WorkspaceActionButton onClick={addPresetCostLine} disabled={!selectedPresetId}>
                  Add preset line
                </WorkspaceActionButton>
                <WorkspaceActionButton onClick={addCustomCostLine}>
                  Add custom line
                </WorkspaceActionButton>
              </div>

              <p className="text-sm text-base-content/65">
                Keep reusable defaults in the Pricing workspace, then copy them into each live service request where technicians can still adjust specification, quantity, and price.
              </p>
            </div>

            <div className="grid gap-3">
              {costSheetForm.lines.length ? (
                costSheetForm.lines.map((line, index) => (
                  <article key={line.clientId} className="grid gap-4 rounded-box border border-base-300/65 bg-base-100 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">
                          Line {index + 1}
                        </p>
                        <h3 className="mt-1 text-lg text-base-content">{line.name || "Untitled line"}</h3>
                      </div>
                      <WorkspaceActionButton onClick={() => removeCostLine(line.clientId)}>
                        Remove
                      </WorkspaceActionButton>
                    </div>

                    <WorkspaceFieldGrid>
                      <WorkspaceField label="Category">
                        <WorkspaceSelect
                          value={line.category}
                          onChange={(event) => updateCostLine(line.clientId, "category", event.target.value)}
                        >
                          {costLineCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </WorkspaceSelect>
                      </WorkspaceField>

                      <WorkspaceField label="Name">
                        <WorkspaceInput
                          value={line.name}
                          onChange={(event) => updateCostLine(line.clientId, "name", event.target.value)}
                          required
                        />
                      </WorkspaceField>

                      <WorkspaceField label="Specification">
                        <WorkspaceInput
                          value={line.specification}
                          onChange={(event) => updateCostLine(line.clientId, "specification", event.target.value)}
                          placeholder="Battery pack model, screen size, service scope"
                        />
                      </WorkspaceField>

                      <WorkspaceField label="Quantity">
                        <WorkspaceInput
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) => updateCostLine(line.clientId, "quantity", event.target.value)}
                          required
                        />
                      </WorkspaceField>

                      <WorkspaceField label="Unit price">
                        <WorkspaceInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) => updateCostLine(line.clientId, "unitPrice", event.target.value)}
                          required
                        />
                      </WorkspaceField>

                      <WorkspaceField label="Line subtotal">
                        <div className="rounded-box border border-base-300/65 bg-base-200/45 px-4 py-3 text-sm text-base-content">
                          <strong>{formatMoney(roundCurrency((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)))}</strong>
                        </div>
                      </WorkspaceField>
                    </WorkspaceFieldGrid>
                  </article>
                ))
              ) : (
                <div className="rounded-box border border-dashed border-base-300/70 bg-base-200/25 px-4 py-6 text-sm text-base-content/65">
                  No commercial lines yet. Add a preset or create a custom line to start the transparent customer-facing breakdown.
                </div>
              )}
            </div>

            <div className="grid gap-3 rounded-box border border-base-300/65 bg-base-200/35 px-4 py-4 md:grid-cols-3">
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Subtotal</p>
                <strong className="mt-2 block text-xl text-base-content">{formatMoney(costingPreview.subtotalAmount)}</strong>
              </div>
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">
                  {costSheetForm.taxLabel || "Tax"}
                </p>
                <strong className="mt-2 block text-xl text-base-content">{formatMoney(costingPreview.taxAmount)}</strong>
              </div>
              <div>
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">Draft total</p>
                <strong className="mt-2 block text-xl text-base-content">{formatMoney(costingPreview.totalAmount)}</strong>
              </div>
            </div>
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
              {!activeRequest.invoiceId && !["Cancelled", "Cancellation Requested", "Closed"].includes(activeRequest.currentStatus) ? (
                <WorkspaceModalButton
                  onClick={openCostingModal}
                  disabled={requestDetailQuery.isLoading || !requestDetailQuery.data}
                >
                  Edit costing
                </WorkspaceModalButton>
              ) : null}
              {isAdmin && activeRequest.canFinalizeInvoice ? (
                <WorkspaceModalButton tone="primary" onClick={openFinalizeInvoiceModal}>
                  Finalize invoice
                </WorkspaceModalButton>
              ) : null}
              {canRecordDirectPayment ? (
                <WorkspaceModalButton tone="primary" onClick={openRecordPaymentModal}>
                  Record payment
                </WorkspaceModalButton>
              ) : null}
            </>
          ) : null}
          onClose={() => setSelectedRequest(null)}
        />
    </>
  );
}

function formatMoney(amount: number) {
  return currencyFormatter.format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatScheduleRange(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "No preferred schedule";
  }

  if (start && end) {
    return `${formatDateTime(start)} to ${formatDateTime(end)}`;
  }

  return formatDateTime(start ?? end ?? "");
}

function formatFeedbackCell(serviceRequest: TenantServiceRequestRow) {
  if (serviceRequest.rating !== null) {
    return `${serviceRequest.rating}/5`;
  }

  if (serviceRequest.feedbackExpiresAtUtc) {
    return new Date(serviceRequest.feedbackExpiresAtUtc).getTime() < Date.now() ? "Expired" : "Pending";
  }

  return "-";
}

function getFinanceTone(status: string) {
  switch (status) {
    case "Loan created":
    case "Direct settlement completed":
      return "active";
    case "Ready for loan conversion":
    case "Ready for invoicing":
      return "warning";
    case "Customer checkout in progress":
    case "Invoice finalized":
    case "Direct settlement under review":
    case "Direct settlement in progress":
      return "progress";
    default:
      return "neutral";
  }
}

function createCostLineFormState(seed?: Partial<Omit<CostLineFormState, "clientId">>): CostLineFormState {
  return {
    id: seed?.id ?? null,
    serviceCostPresetId: seed?.serviceCostPresetId ?? null,
    category: seed?.category ?? "Base Charge",
    name: seed?.name ?? "",
    specification: seed?.specification ?? "",
    quantity: seed?.quantity ?? "1",
    unitPrice: seed?.unitPrice ?? "0",
    sortOrder: seed?.sortOrder ?? 0,
    clientId: crypto.randomUUID()
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
