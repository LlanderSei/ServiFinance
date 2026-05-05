import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AddressLookupField } from "@/shared/location/AddressLookupField";
import { useCustomerProfile } from "./useCustomerProfile";
import { useCreateCustomerRequest, useCustomerRequests, useUploadCustomerRequestAttachments } from "./useCustomerRequests";
import type { CustomerRequest } from "./useCustomerRequests";

type RequestTab = "ongoing" | "history";

const historyStatuses = new Set(["Completed", "Closed", "Cancelled"]);

function isHistoryRequest(status: string) {
  return historyStatuses.has(status);
}

function isFeedbackExpired(feedbackExpiresAtUtc?: string | null) {
  return Boolean(feedbackExpiresAtUtc && new Date(feedbackExpiresAtUtc).getTime() < Date.now());
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(value?: string | null, fallback = "Unknown time") {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("completed") || normalized.includes("closed")) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800";
  }

  if (normalized.includes("progress") || normalized.includes("service") || normalized.includes("scheduled")) {
    return "bg-blue-100 text-blue-800";
  }

  if (normalized.includes("pending") || normalized.includes("hold")) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

function buildRequestMeta(request: CustomerRequest) {
  if (request.currentStatus === "Cancelled") {
    return `Cancelled ${formatDateTime(request.cancelledAtUtc, formatDateTime(request.createdAtUtc))}`;
  }

  if (request.currentStatus === "Cancellation Requested") {
    return `Cancellation requested ${formatDateTime(request.cancellationRequestedAtUtc, formatDateTime(request.createdAtUtc))}`;
  }

  if ((request.currentStatus === "Completed" || request.currentStatus === "Closed") && request.completedAtUtc) {
    return `Completed ${formatDateTime(request.completedAtUtc)}`;
  }

  return `Opened ${formatDateTime(request.createdAtUtc)}`;
}

function RequestBadge({ request }: { request: CustomerRequest }) {
  const isCompleted = request.currentStatus === "Completed" || request.currentStatus === "Closed";
  if (request.rating != null) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">
        Rated {request.rating}/5
      </span>
    );
  }

  if (isCompleted && !isFeedbackExpired(request.feedbackExpiresAtUtc)) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-700">
        Feedback open
      </span>
    );
  }

  return null;
}

function RequestRow({ request, tenantDomainSlug }: { request: CustomerRequest; tenantDomainSlug: string }) {
  const isOngoing = !isHistoryRequest(request.currentStatus);
  const actionLabel = isOngoing ? "Track request" : "View";

  return (
    <article className="rounded-[1.6rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(35,46,76,0.06)] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">{request.requestNumber}</p>
          <h2 className="mt-2 truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
            {request.itemType}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {buildRequestMeta(request)}
          </p>
        </div>

        <span className={joinClasses(
          "rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
          statusTone(request.currentStatus)
        )}>
          {request.currentStatus}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
        <RequestBadge request={request} />

        <Link
          className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100 no-underline"
          to={`/t/${tenantDomainSlug}/c/requests/${request.id}`}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

function RequestTabs({
  activeTab,
  ongoingCount,
  historyCount,
  onChange
}: {
  activeTab: RequestTab;
  ongoingCount: number;
  historyCount: number;
  onChange: (tab: RequestTab) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-20 w-[calc(100%-2rem)] max-w-[24rem] -translate-x-1/2 lg:left-[calc(50%+155px)]">
      <nav className="pointer-events-auto flex w-full items-center gap-2 rounded-full border border-slate-200/80 bg-white/96 p-2 shadow-[0_18px_36px_rgba(35,46,76,0.14)] backdrop-blur-xl">
        <button
          type="button"
          className={joinClasses(
            "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors duration-200",
            activeTab === "ongoing"
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100"
          )}
          onClick={() => onChange("ongoing")}
        >
          <span>Ongoing</span>
          <span className={joinClasses(
            "rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
            activeTab === "ongoing"
              ? "bg-white/14 text-white"
              : "bg-slate-100 text-slate-500"
          )}>
            {ongoingCount}
          </span>
        </button>

        <button
          type="button"
          className={joinClasses(
            "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors duration-200",
            activeTab === "history"
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100"
          )}
          onClick={() => onChange("history")}
        >
          <span>History</span>
          <span className={joinClasses(
            "rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
            activeTab === "history"
              ? "bg-white/14 text-white"
              : "bg-slate-100 text-slate-500"
          )}>
            {historyCount}
          </span>
        </button>
      </nav>
    </div>
  );
}

function toUtcIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function CustomerRequestsPage() {
  const { tenantDomainSlug = "" } = useParams();
  const { data: requests, isLoading } = useCustomerRequests();
  const profileQuery = useCustomerProfile();
  const createRequest = useCreateCustomerRequest();
  const uploadAttachments = useUploadCustomerRequestAttachments();

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<RequestTab>("ongoing");
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [serviceMode, setServiceMode] = useState("Drop-off");
  const [selectedContactOptionId, setSelectedContactOptionId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [serviceAddressDetails, setServiceAddressDetails] = useState("");
  const [preferredScheduleStartUtc, setPreferredScheduleStartUtc] = useState("");
  const [preferredScheduleEndUtc, setPreferredScheduleEndUtc] = useState("");
  const [neededByUtc, setNeededByUtc] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const ongoingRequests = useMemo(
    () => (requests ?? []).filter((request) => !isHistoryRequest(request.currentStatus)),
    [requests]
  );
  const historyRequests = useMemo(
    () => (requests ?? []).filter((request) => isHistoryRequest(request.currentStatus)),
    [requests]
  );
  const visibleRequests = activeTab === "ongoing" ? ongoingRequests : historyRequests;
  const headerTitle = activeTab === "ongoing" ? "My service requests" : "Request history";
  const headerDescription = activeTab === "ongoing"
    ? "Monitor active request movement and submit new requests from this tenant domain."
    : "Review completed, closed, and cancelled requests without mixing them into the live queue.";

  useEffect(() => {
    if (!showForm || !profileQuery.data || contactName || contactPhone || serviceAddress || serviceAddressDetails) {
      return;
    }

    const defaultOption = profileQuery.data.contactOptions.find((option) => option.isDefault);
    if (defaultOption) {
      setSelectedContactOptionId(defaultOption.id);
      setContactName(defaultOption.contactName);
      setContactPhone(defaultOption.phoneNumber);
      setServiceAddress(defaultOption.address);
      setServiceAddressDetails(defaultOption.addressDetails ?? "");
      return;
    }

    setContactName(profileQuery.data.fullName);
    setContactPhone(profileQuery.data.mobileNumber);
    setServiceAddress(profileQuery.data.address);
    setServiceAddressDetails(profileQuery.data.addressDetails ?? "");
  }, [showForm, profileQuery.data, contactName, contactPhone, serviceAddress, serviceAddressDetails]);

  function applyContactOption(optionId: string) {
    setSelectedContactOptionId(optionId);
    const option = profileQuery.data?.contactOptions.find((candidate) => candidate.id === optionId);
    if (!option) {
      setContactName(profileQuery.data?.fullName ?? "");
      setContactPhone(profileQuery.data?.mobileNumber ?? "");
      setServiceAddress(profileQuery.data?.address ?? "");
      setServiceAddressDetails(profileQuery.data?.addressDetails ?? "");
      return;
    }

    setContactName(option.contactName);
    setContactPhone(option.phoneNumber);
    setServiceAddress(option.address);
    setServiceAddressDetails(option.addressDetails ?? "");
  }

  function resetForm() {
    setShowForm(false);
    setItemType("");
    setItemDescription("");
    setIssueDescription("");
    setServiceMode("Drop-off");
    setSelectedContactOptionId("");
    setContactName("");
    setContactPhone("");
    setServiceAddress("");
    setServiceAddressDetails("");
    setPreferredScheduleStartUtc("");
    setPreferredScheduleEndUtc("");
    setNeededByUtc("");
    setAttachments([]);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    try {
      const createdRequest = await createRequest.mutateAsync({
        itemType,
        itemDescription,
        issueDescription,
        serviceMode,
        serviceAddress,
        serviceAddressDetails,
        contactName,
        contactPhone,
        preferredScheduleStartUtc: toUtcIso(preferredScheduleStartUtc),
        preferredScheduleEndUtc: toUtcIso(preferredScheduleEndUtc),
        neededByUtc: toUtcIso(neededByUtc)
      });

      if (attachments.length) {
        const payload = new FormData();
        attachments.forEach((file) => payload.append("files", file));
        await uploadAttachments.mutateAsync({ id: createdRequest.id, payload });
      }

      setActiveTab("ongoing");
      resetForm();
    } catch {
      // Mutation state already exposes the error message context in the form.
    }
  }

  return (
    <div className="grid gap-5 pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-32">
      <section className="flex flex-col items-stretch justify-between gap-4 rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)] sm:flex-row sm:items-start">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer requests</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{headerTitle}</h1>
          <p className="mt-3 max-w-[38rem] text-sm leading-6 text-slate-600">
            {headerDescription}
          </p>
        </div>

        <button
          className="btn w-full rounded-full border-none bg-blue-600 px-6 text-white hover:bg-blue-700 sm:w-auto"
          onClick={() => {
            if (showForm) {
              resetForm();
              return;
            }

            setShowForm(true);
          }}
        >
          {showForm ? "Cancel" : "New Request"}
        </button>
      </section>

      {showForm && (
        <section className="rounded-[2rem] border border-slate-200/80 bg-slate-50 px-5 py-6 shadow-inner">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Create New Service Request</h2>
          <form onSubmit={handleCreate} className="grid w-full gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Item Type</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" placeholder="e.g. Laptop, Commercial Oven" value={itemType} onChange={(event) => setItemType(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Item Description</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" placeholder="e.g. 15-inch gaming laptop" value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Issue Description</span>
              <textarea required className="textarea textarea-bordered min-h-32 w-full rounded-xl bg-white" placeholder="Describe the problem..." value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Service Mode</span>
              <select className="select select-bordered w-full rounded-xl bg-white" value={serviceMode} onChange={(event) => setServiceMode(event.target.value)}>
                <option value="Drop-off">Drop-off / customer brings item</option>
                <option value="On-site">On-site visit</option>
                <option value="Pickup">Pickup request</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Saved contact/address</span>
              <select className="select select-bordered w-full rounded-xl bg-white" value={selectedContactOptionId} onChange={(event) => applyContactOption(event.target.value)}>
                <option value="">Use primary profile</option>
                {profileQuery.data?.contactOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Contact Name</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Contact Phone</span>
              <input required type="text" className="input input-bordered w-full rounded-xl bg-white" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
            </label>
            <AddressLookupField
              className="md:col-span-2"
              label="Service Address"
              value={serviceAddress}
              onChange={setServiceAddress}
              placeholder="Required for on-site or pickup work. Optional for drop-off."
              required={serviceMode === "On-site" || serviceMode === "Pickup"}
              description="Use a manual lookup if you want a normalized address before the tenant sees the request."
            />
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Address details</span>
              <textarea
                className="textarea textarea-bordered min-h-24 w-full rounded-xl bg-white"
                placeholder="Lot, unit, building, floor, landmark, or access notes"
                value={serviceAddressDetails}
                onChange={(event) => setServiceAddressDetails(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Preferred Start</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={preferredScheduleStartUtc} onChange={(event) => setPreferredScheduleStartUtc(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-slate-700">Preferred End</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={preferredScheduleEndUtc} onChange={(event) => setPreferredScheduleEndUtc(event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Needed By / Due Date</span>
              <input type="datetime-local" className="input input-bordered w-full rounded-xl bg-white" value={neededByUtc} onChange={(event) => setNeededByUtc(event.target.value)} />
              <span className="text-xs leading-5 text-slate-500">
                Use this for pre-order style requests or work that should notify tenant staff before a target date.
              </span>
            </label>
            <label className="grid min-w-0 gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Pictures (optional)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="file-input file-input-bordered w-full rounded-xl bg-white"
                onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
              />
              <span className="text-xs leading-5 text-slate-500">
                Upload issue photos now so tenant staff can inspect them from SMS. Each file must be 5 MB or smaller.
              </span>
            </label>
            {(createRequest.isError || uploadAttachments.isError) && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                {createRequest.error?.message ?? uploadAttachments.error?.message ?? "Unable to create the service request."}
              </p>
            )}
            <button disabled={createRequest.isPending || uploadAttachments.isPending} type="submit" className="btn w-full rounded-full bg-slate-900 px-8 text-white hover:bg-slate-800 sm:w-max md:col-span-2">
              {createRequest.isPending || uploadAttachments.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </section>
      )}

      {!showForm && (
        isLoading ? (
          <div className="rounded-[1.8rem] border border-slate-200/80 bg-white px-5 py-10 text-center text-slate-500 shadow-[0_12px_28px_rgba(35,46,76,0.06)]">
            Loading requests...
          </div>
        ) : (
          <section className="grid gap-3">
            {visibleRequests.length === 0 ? (
              <div className="rounded-[1.8rem] border border-slate-200 border-dashed bg-white px-5 py-10 text-center text-slate-500">
                {activeTab === "ongoing"
                  ? "You have no ongoing service requests right now."
                  : "No completed or cancelled requests are in your history yet."}
              </div>
            ) : (
              visibleRequests.map((request) => (
                <RequestRow key={request.id} request={request} tenantDomainSlug={tenantDomainSlug} />
              ))
            )}
          </section>
        )
      )}

      {!showForm && (
        <RequestTabs
          activeTab={activeTab}
          ongoingCount={ongoingRequests.length}
          historyCount={historyRequests.length}
          onChange={setActiveTab}
        />
      )}
    </div>
  );
}
