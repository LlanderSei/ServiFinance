import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { CreateTenantCustomerRequest, TenantCustomerRow } from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInput,
  WorkspaceModalButton
} from "@/shared/records/WorkspaceControls";
import { RecordContentStack, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";
import { useToast } from "@/shared/toast/ToastProvider";

export function SmsCustomersPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<TenantCustomerRow | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<CreateTenantCustomerRequest>({
    fullName: "",
    mobileNumber: "",
    email: "",
    address: ""
  });

  const customersQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-customers"],
    queryFn: () => httpGet<TenantCustomerRow[]>(`/api/tenants/${tenantDomainSlug}/sms/customers`)
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CreateTenantCustomerRequest) =>
      httpPostJson<TenantCustomerRow, CreateTenantCustomerRequest>(`/api/tenants/${tenantDomainSlug}/sms/customers`, payload),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-customers"] });
      setSelectedCustomer(customer);
      setIsCreateModalOpen(false);
      setForm({
        fullName: "",
        mobileNumber: "",
        email: "",
        address: ""
      });
      toast.success({
        title: "Customer record created",
        message: "The customer profile is now available for intake, dispatch, and billing workflows."
      });
    },
    onError: (mutationError: Error) => {
      toast.error({
        title: "Unable to create customer record",
        message: mutationError.message
      });
    }
  });

  const customerDetails = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return [
      {
        title: "Customer identity",
        items: [
          { label: "Customer code", value: selectedCustomer.customerCode },
          { label: "Full name", value: selectedCustomer.fullName },
          { label: "Mobile", value: selectedCustomer.mobileNumber || "Not provided" },
          { label: "Email", value: selectedCustomer.email || "Not provided" }
        ]
      },
      {
        title: "Operational context",
        items: [
          { label: "Address", value: selectedCustomer.address || "Not provided" },
          { label: "Service requests", value: selectedCustomer.serviceRequestCount },
          { label: "Created", value: new Date(selectedCustomer.createdAtUtc).toLocaleString("en-PH") }
        ]
      }
    ];
  }, [selectedCustomer]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCustomerMutation.mutate(form);
  }

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Customers`}
          title="Customer records"
          description="Review and manage tenant-scoped customer profiles before they enter service intake, dispatch, and billing workflows."
          recordCount={customersQuery.data?.length ?? 0}
          singularLabel="customer"
        >
          <RecordContentStack>
            <RecordTableShell>
              <RecordTable>
                <thead>
                  <tr>
                    <th>Customer Code</th>
                    <th>Full Name</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Requests</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customersQuery.isLoading ? (
                    <RecordTableStateRow colSpan={7}>Loading customer records...</RecordTableStateRow>
                  ) : null}

                  {customersQuery.isError ? (
                    <RecordTableStateRow colSpan={7} tone="error">
                        Unable to load customer records.
                    </RecordTableStateRow>
                  ) : null}

                  {!customersQuery.isLoading && !customersQuery.isError && !customersQuery.data?.length ? (
                    <RecordTableStateRow colSpan={7}>No customer records yet.</RecordTableStateRow>
                  ) : null}

                  {customersQuery.data?.map((customer) => (
                    <tr key={customer.id}>
                      <td>{customer.customerCode}</td>
                      <td>{customer.fullName}</td>
                      <td>{customer.mobileNumber || "-"}</td>
                      <td>{customer.email || "-"}</td>
                      <td>{customer.address || "-"}</td>
                      <td>{customer.serviceRequestCount}</td>
                      <td>
                        <RecordTableActionButton onClick={() => setSelectedCustomer(customer)}>
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
                  key: "refresh-customers",
                  label: "Refresh customer records",
                  icon: "refresh",
                  onClick: () => {
                    void customersQuery.refetch();
                  }
                },
                {
                  key: "add-customer",
                  label: "Create customer record",
                  icon: "plus",
                  onClick: () => setIsCreateModalOpen(true)
                }
              ]}
            />
          </RecordContentStack>
        </RecordWorkspace>

        <RecordFormModal
          open={isCreateModalOpen}
          eyebrow="Customer intake"
          title="Create customer record"
          description="Capture the basic contact profile before the customer enters service intake and billing workflows."
          actions={
            <>
              <WorkspaceModalButton onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-customer-form"
                tone="primary"
                disabled={createCustomerMutation.isPending}
              >
                {createCustomerMutation.isPending ? "Creating..." : "Create customer"}
              </WorkspaceModalButton>
            </>
          }
          onClose={() => setIsCreateModalOpen(false)}
        >
          <WorkspaceForm id="tenant-customer-form" onSubmit={handleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Full name">
                <WorkspaceInput
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  required
                />
              </WorkspaceField>

              <WorkspaceField label="Mobile number">
                <WorkspaceInput
                  value={form.mobileNumber}
                  onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Email">
                <WorkspaceInput
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Address">
                <WorkspaceInput
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordDetailsModal
          open={selectedCustomer !== null}
          eyebrow="Customer details"
          title={selectedCustomer?.fullName ?? ""}
          sections={customerDetails}
          onClose={() => setSelectedCustomer(null)}
        />
      </>
    </ProtectedRoute>
  );
}
