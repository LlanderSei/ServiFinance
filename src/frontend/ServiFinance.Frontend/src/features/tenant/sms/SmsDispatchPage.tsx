import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CreateTenantAssignmentRequest,
  TenantDispatchAssignmentRow,
  TenantDispatchMetaResponse,
  TenantServiceRequestDetailResponse,
  UpdateTenantAssignmentStatusRequest
} from "@/shared/api/contracts";
import { httpGet, httpPostJson } from "@/shared/api/http";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import { RecordFormModal } from "@/shared/records/RecordFormModal";
import { MetricCard } from "@/shared/records/MetricCard";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceField,
  WorkspaceFieldGrid,
  WorkspaceForm,
  WorkspaceInlineNote,
  WorkspaceInput,
  WorkspaceModalButton,
  WorkspaceNotice,
  WorkspaceSelect,
  WorkspaceStatusPill,
  WorkspaceToggleGroup,
  WorkspaceToggleButton
} from "@/shared/records/WorkspaceControls";
import {
  WorkspaceMetricGrid,
  WorkspaceNoteList,
  WorkspacePanel,
  WorkspaceToolbar,
  WorkspacePanelHeader
} from "@/shared/records/WorkspacePanel";
import { WorkspaceFabDock } from "@/shared/records/WorkspaceFabDock";

type DispatchViewMode = "workspace" | "mine";
type ScheduleFormState = {
  serviceRequestId: string;
  assignedUserId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  assignmentStatus: string;
};

const assignmentStatuses = ["Scheduled", "In Progress", "On Hold", "Completed"] as const;

export function SmsDispatchPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const currentUser = getCurrentSession()?.user ?? null;
  const isAdmin = currentUser?.roles.includes("Administrator") ?? false;
  const [selectedAssignment, setSelectedAssignment] = useState<TenantDispatchAssignmentRow | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<DispatchViewMode>(isAdmin ? "workspace" : "mine");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    serviceRequestId: "",
    assignedUserId: "",
    scheduledStartUtc: "",
    scheduledEndUtc: "",
    assignmentStatus: "Scheduled"
  });

  const dispatchQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"],
    queryFn: () => httpGet<TenantDispatchAssignmentRow[]>(`/api/tenants/${tenantDomainSlug}/sms/dispatch`)
  });

  const dispatchMetaQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-dispatch-meta"],
    queryFn: () => httpGet<TenantDispatchMetaResponse>(`/api/tenants/${tenantDomainSlug}/sms/dispatch/meta`),
    enabled: isAdmin
  });

  const assignmentDetailQuery = useQuery({
    queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", selectedAssignment?.serviceRequestId],
    queryFn: () =>
      httpGet<TenantServiceRequestDetailResponse>(
        `/api/tenants/${tenantDomainSlug}/sms/service-requests/${selectedAssignment?.serviceRequestId}/details`
      ),
    enabled: selectedAssignment !== null
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (payload: CreateTenantAssignmentRequest) =>
      httpPostJson<TenantDispatchAssignmentRow, CreateTenantAssignmentRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      setSelectedAssignment(assignment);
      setIsScheduleModalOpen(false);
      setScheduleForm({
        serviceRequestId: "",
        assignedUserId: "",
        scheduledStartUtc: "",
        scheduledEndUtc: "",
        assignmentStatus: "Scheduled"
      });
      setMessage("Dispatch assignment created.");
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  const updateAssignmentStatusMutation = useMutation({
    mutationFn: ({
      assignmentId,
      payload
    }: {
      assignmentId: string;
      payload: UpdateTenantAssignmentStatusRequest;
    }) =>
      httpPostJson<TenantDispatchAssignmentRow, UpdateTenantAssignmentStatusRequest>(
        `/api/tenants/${tenantDomainSlug}/sms/dispatch/${assignmentId}/status`,
        payload
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-dispatch"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", tenantDomainSlug, "sms-service-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant", tenantDomainSlug, "sms-service-request-detail", assignment.serviceRequestId]
      });
      setSelectedAssignment(assignment);
      setMessage(`Assignment updated to ${assignment.assignmentStatus}.`);
      setError(null);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setMessage(null);
    }
  });

  const visibleAssignments = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    if (viewMode === "mine" && currentUser?.userId) {
      return assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId);
    }

    return assignments;
  }, [currentUser?.userId, dispatchQuery.data, viewMode]);

  const activeAssignment = useMemo(() => {
    if (!selectedAssignment) {
      return null;
    }

    return dispatchQuery.data?.find((assignment) => assignment.id === selectedAssignment.id) ?? selectedAssignment;
  }, [dispatchQuery.data, selectedAssignment]);

  const assignmentDetails = useMemo(() => {
    if (!activeAssignment) {
      return [];
    }

    return [
      {
        title: "Assignment summary",
        items: [
          { label: "Request number", value: activeAssignment.requestNumber },
          { label: "Customer", value: activeAssignment.customerName },
          { label: "Item type", value: activeAssignment.itemType },
          { label: "Priority", value: activeAssignment.priority }
        ]
      },
      {
        title: "Dispatch timing",
        items: [
          { label: "Assigned staff", value: activeAssignment.assignedUserName },
          { label: "Scheduled start", value: formatDateTime(activeAssignment.scheduledStartUtc) },
          { label: "Scheduled end", value: formatDateTime(activeAssignment.scheduledEndUtc) },
          { label: "Assignment status", value: activeAssignment.assignmentStatus }
        ]
      },
      {
        title: "Finance handoff",
        items: [
          { label: "Service status", value: activeAssignment.serviceStatus },
          {
            label: "Handoff state",
            value: (
              <WorkspaceStatusPill tone={getFinanceTone(activeAssignment.financeHandoffStatus)}>
                {activeAssignment.financeHandoffStatus}
              </WorkspaceStatusPill>
            )
          },
          {
            label: "Invoice",
            value: activeAssignment.invoiceNumber
              ? `${activeAssignment.invoiceNumber} (${activeAssignment.invoiceStatus ?? "Unknown"})`
              : "No finalized invoice yet"
          },
          {
            label: "Loan conversion",
            value: activeAssignment.hasMicroLoan
              ? "Converted to micro-loan in MLS."
              : activeAssignment.canConvertToLoan
                ? "Ready for desktop loan conversion."
                : "Not yet eligible for loan conversion."
          }
        ]
      },
      {
        title: "Execution context",
        items: [
          { label: "Assigned by", value: activeAssignment.assignedByUserName },
          { label: "Created", value: formatDateTime(activeAssignment.createdAtUtc) },
          { label: "Job photo uploads", value: "Placeholder only in this phase." }
        ]
      },
      {
        title: "Audit trail",
        items: [
          {
            label: "History",
            value: assignmentDetailQuery.data?.auditTrail.length ? (
              <ul className="grid list-none gap-3 p-0 m-0">
                {assignmentDetailQuery.data.auditTrail.map((entry) => (
                  <li key={entry.id} className="grid gap-1 rounded-2xl border border-base-300/70 bg-base-200/40 px-4 py-3">
                    <strong className="text-base-content">{entry.status}</strong>
                    <span className="text-base-content/70">{entry.remarks}</span>
                    <small className="text-base-content/60">{entry.changedByUserName} - {formatDateTime(entry.changedAtUtc)}</small>
                  </li>
                ))}
              </ul>
            ) : assignmentDetailQuery.isLoading ? "Loading history..." : "No audit entries yet."
          }
        ]
      }
    ];
  }, [activeAssignment, assignmentDetailQuery.data?.auditTrail, assignmentDetailQuery.isLoading]);

  const summary = useMemo(() => {
    const assignments = dispatchQuery.data ?? [];
    return {
      scheduled: assignments.filter((assignment) => assignment.assignmentStatus === "Scheduled").length,
      inProgress: assignments.filter((assignment) => assignment.assignmentStatus === "In Progress").length,
      mine: currentUser?.userId
        ? assignments.filter((assignment) => assignment.assignedUserId === currentUser.userId).length
        : 0
    };
  }, [currentUser?.userId, dispatchQuery.data]);

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createAssignmentMutation.mutate({
      serviceRequestId: scheduleForm.serviceRequestId,
      assignedUserId: scheduleForm.assignedUserId,
      scheduledStartUtc: toIsoString(scheduleForm.scheduledStartUtc),
      scheduledEndUtc: toIsoString(scheduleForm.scheduledEndUtc),
      assignmentStatus: scheduleForm.assignmentStatus
    });
  }

  function handleStatusUpdate(assignment: TenantDispatchAssignmentRow, assignmentStatus: string, serviceStatus?: string) {
    updateAssignmentStatusMutation.mutate({
      assignmentId: assignment.id,
      payload: {
        assignmentStatus,
        serviceStatus,
        remarks: `Dispatch status moved to ${assignmentStatus}.`
      }
    });
  }

  return (
    <ProtectedRoute tenantSlug={tenantDomainSlug}>
      <>
        <RecordWorkspace
          breadcrumbs={`${tenantDomainSlug} / SMS / Dispatch`}
          title="Dispatch and assignments"
          description="Coordinate scheduled work, technician ownership, finance handoff state, and service execution from one tenant dispatch register."
          recordCount={visibleAssignments.length}
          singularLabel="assignment"
        >
          <div className="record-content-stack record-content-stack--with-fab">
            {message ? <WorkspaceNotice>{message}</WorkspaceNotice> : null}
            {error ? <WorkspaceNotice tone="error">{error}</WorkspaceNotice> : null}

            <WorkspaceMetricGrid className="2xl:grid-cols-3">
              <MetricCard
                label="Scheduled"
                value={summary.scheduled}
                description="Assignments queued with a planned technician or staff owner."
              />
              <MetricCard
                label="In progress"
                value={summary.inProgress}
                description="Jobs currently being worked from the tenant dispatch workflow."
              />
              <MetricCard
                label="My tasks"
                value={summary.mine}
                description="Assignments currently owned by the signed-in operator."
              />
            </WorkspaceMetricGrid>

            <WorkspacePanel>
              <WorkspacePanelHeader
                eyebrow="Dispatch view"
                title="Assignment register"
                actions={(
                  <WorkspaceToolbar>
                    {isAdmin ? (
                      <WorkspaceToggleGroup>
                        <WorkspaceToggleButton active={viewMode === "workspace"} onClick={() => setViewMode("workspace")}>
                          Workspace
                        </WorkspaceToggleButton>
                        <WorkspaceToggleButton active={viewMode === "mine"} onClick={() => setViewMode("mine")}>
                          My tasks
                        </WorkspaceToggleButton>
                      </WorkspaceToggleGroup>
                    ) : (
                      <WorkspaceInlineNote>Showing assignments currently owned by your account.</WorkspaceInlineNote>
                    )}
                  </WorkspaceToolbar>
                )}
              />
            </WorkspacePanel>

            <RecordTableShell>
              <RecordTable>
                <thead>
                  <tr>
                    <th>Request No.</th>
                    <th>Customer</th>
                    <th>Assigned Staff</th>
                    <th>Scheduled Start</th>
                    <th>Scheduled End</th>
                    <th>Assignment Status</th>
                    <th>Service Status</th>
                    <th>Finance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchQuery.isLoading ? (
                    <RecordTableStateRow colSpan={9}>Loading dispatch assignments...</RecordTableStateRow>
                  ) : null}

                  {dispatchQuery.isError ? (
                    <RecordTableStateRow colSpan={9} tone="error">
                      Unable to load dispatch assignments.
                    </RecordTableStateRow>
                  ) : null}

                  {!dispatchQuery.isLoading && !dispatchQuery.isError && !visibleAssignments.length ? (
                    <RecordTableStateRow colSpan={9}>
                      {isAdmin ? "No dispatch assignments yet." : "No assignments are currently assigned to your account."}
                    </RecordTableStateRow>
                  ) : null}

                  {visibleAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.requestNumber}</td>
                      <td>{assignment.customerName}</td>
                      <td>{assignment.assignedUserName}</td>
                      <td>{formatDateTime(assignment.scheduledStartUtc)}</td>
                      <td>{formatDateTime(assignment.scheduledEndUtc)}</td>
                      <td>
                        <WorkspaceStatusPill tone="active">{assignment.assignmentStatus}</WorkspaceStatusPill>
                      </td>
                      <td>{assignment.serviceStatus}</td>
                      <td>
                        <WorkspaceStatusPill tone={getFinanceTone(assignment.financeHandoffStatus)}>
                          {assignment.financeHandoffStatus}
                        </WorkspaceStatusPill>
                      </td>
                      <td>
                        <RecordTableActionButton onClick={() => setSelectedAssignment(assignment)}>
                          View
                        </RecordTableActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </RecordTable>
            </RecordTableShell>

            <WorkspacePanel>
              <WorkspacePanelHeader eyebrow="Execution notes" title="Phase 5 alignment" />
              <WorkspaceNoteList
                items={[
                  "Dispatch now surfaces finance handoff readiness so completed work is visible before MLS conversion.",
                  "Assignment details reuse the shared request audit trail, keeping status and dispatch history on one thread.",
                  "Job photo uploads remain a placeholder and are intentionally deferred to a deeper operational slice."
                ]}
              />
            </WorkspacePanel>

            <WorkspaceFabDock
              actions={[
                {
                  key: "refresh-dispatch",
                  label: "Refresh dispatch workspace",
                  icon: "refresh",
                  onClick: () => {
                    void dispatchQuery.refetch();
                    if (isAdmin) {
                      void dispatchMetaQuery.refetch();
                    }
                  }
                },
                ...(isAdmin ? [{
                  key: "schedule-dispatch",
                  label: "Schedule assignment",
                  icon: "calendar" as const,
                  onClick: () => setIsScheduleModalOpen(true),
                  disabled: dispatchMetaQuery.isLoading ||
                    !dispatchMetaQuery.data?.assignableUsers.length ||
                    !dispatchMetaQuery.data?.serviceRequests.length
                }] : [])
              ]}
            />
          </div>
        </RecordWorkspace>

        <RecordFormModal
          open={isScheduleModalOpen}
          eyebrow="Dispatch planning"
          title="Schedule assignment"
          description="Assign a staff member to a live service request and set the expected service window."
          actions={(
            <>
              <WorkspaceModalButton onClick={() => setIsScheduleModalOpen(false)}>
                Cancel
              </WorkspaceModalButton>
              <WorkspaceModalButton
                type="submit"
                form="tenant-dispatch-form"
                tone="primary"
                disabled={
                  createAssignmentMutation.isPending ||
                  dispatchMetaQuery.isLoading ||
                  !dispatchMetaQuery.data?.assignableUsers.length ||
                  !dispatchMetaQuery.data?.serviceRequests.length
                }
              >
                {createAssignmentMutation.isPending ? "Scheduling..." : "Schedule assignment"}
              </WorkspaceModalButton>
            </>
          )}
          onClose={() => setIsScheduleModalOpen(false)}
        >
          <WorkspaceForm id="tenant-dispatch-form" onSubmit={handleScheduleSubmit}>
            <WorkspaceFieldGrid>
              <WorkspaceField label="Service request" wide>
                <WorkspaceSelect
                  value={scheduleForm.serviceRequestId}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, serviceRequestId: event.target.value }))}
                  required
                >
                  <option value="">Select service request</option>
                  {dispatchMetaQuery.data?.serviceRequests.map((serviceRequest) => (
                    <option key={serviceRequest.id} value={serviceRequest.id}>
                      {serviceRequest.requestNumber} - {serviceRequest.customerName} - {serviceRequest.itemType}
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Assigned staff">
                <WorkspaceSelect
                  value={scheduleForm.assignedUserId}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, assignedUserId: event.target.value }))}
                  required
                >
                  <option value="">Select staff member</option>
                  {dispatchMetaQuery.data?.assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.roles.join(", ")})
                    </option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Assignment status">
                <WorkspaceSelect
                  value={scheduleForm.assignmentStatus}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, assignmentStatus: event.target.value }))}
                >
                  {assignmentStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </WorkspaceSelect>
              </WorkspaceField>

              <WorkspaceField label="Scheduled start">
                <WorkspaceInput
                  type="datetime-local"
                  value={scheduleForm.scheduledStartUtc}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledStartUtc: event.target.value }))}
                />
              </WorkspaceField>

              <WorkspaceField label="Scheduled end">
                <WorkspaceInput
                  type="datetime-local"
                  value={scheduleForm.scheduledEndUtc}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledEndUtc: event.target.value }))}
                />
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceForm>
        </RecordFormModal>

        <RecordDetailsModal
          open={selectedAssignment !== null}
          eyebrow="Dispatch assignment"
          title={activeAssignment?.requestNumber ?? ""}
          sections={assignmentDetails}
          actions={activeAssignment ? (
            <>
              <WorkspaceModalButton onClick={() => setSelectedAssignment(null)}>
                Close
              </WorkspaceModalButton>
              {activeAssignment.assignmentStatus !== "In Progress" ? (
                <WorkspaceModalButton
                  tone="primary"
                  onClick={() => handleStatusUpdate(activeAssignment, "In Progress", "In Service")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Start work
                </WorkspaceModalButton>
              ) : null}
              {activeAssignment.assignmentStatus !== "On Hold" ? (
                <WorkspaceModalButton
                  onClick={() => handleStatusUpdate(activeAssignment, "On Hold")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Put on hold
                </WorkspaceModalButton>
              ) : null}
              {activeAssignment.assignmentStatus !== "Completed" ? (
                <WorkspaceModalButton
                  tone="primary"
                  onClick={() => handleStatusUpdate(activeAssignment, "Completed")}
                  disabled={updateAssignmentStatusMutation.isPending}
                >
                  Mark completed
                </WorkspaceModalButton>
              ) : null}
            </>
          ) : null}
          onClose={() => setSelectedAssignment(null)}
        />
      </>
    </ProtectedRoute>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toIsoString(value: string) {
  return value ? new Date(value).toISOString() : null;
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
