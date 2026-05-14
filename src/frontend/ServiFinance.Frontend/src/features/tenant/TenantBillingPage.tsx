import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type {
  TenantBillingCancelPlanChangeResponse,
  TenantBillingOverviewResponse,
  TenantBillingPlanChangeRequest,
  TenantBillingPlanChangeResponse,
  TenantBillingPortalSessionResponse
} from "@/shared/api/contracts";
import { httpDeleteJson, httpGet, httpPostJson } from "@/shared/api/http";
import { hasPermission } from "@/shared/auth/permissions";
import { getCurrentSession } from "@/shared/auth/session";
import { RecordSurfaceModal } from "@/shared/records/RecordSurfaceModal";
import { WorkspaceTopTabs } from "@/shared/records/WorkspaceTopTabs";
import { RecordScrollRegion, RecordWorkspace } from "@/shared/records/RecordWorkspace";
import {
  WorkspaceModalButton,
  WorkspaceNotice
} from "@/shared/records/WorkspaceControls";
import { WorkspaceScrollStack } from "@/shared/records/WorkspacePanel";
import { useToast } from "@/shared/toast/ToastProvider";
import { BillingEntitlementsTab } from "./billing/BillingEntitlementsTab";
import { BillingOverviewTab } from "./billing/BillingOverviewTab";
import { BillingPaymentsTab } from "./billing/BillingPaymentsTab";
import { BillingPlanSwitchTab } from "./billing/BillingPlanSwitchTab";
import { BillingRecoveryTab } from "./billing/BillingRecoveryTab";
import {
  buildClientPlanImpact,
  buildRenewalWarning,
  formatDateTime,
  ImpactSummary,
  isCurrentTier
} from "./billing/billingUi";

const billingWorkspaceTabs = [
  { key: "overview", label: "Overview" },
  { key: "plan", label: "Plan switch" },
  { key: "entitlements", label: "Entitlements" },
  { key: "recovery", label: "Recovery" },
  { key: "payments", label: "Payments" }
];

export function TenantBillingPage() {
  const { tenantDomainSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedTierId, setSelectedTierId] = useState("");
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);
  const [activeBillingTab, setActiveBillingTab] = useState("overview");
  const currentUser = getCurrentSession()?.user ?? null;
  const billingTenantSlug = tenantDomainSlug || currentUser?.tenantDomainSlug || "";
  const billingScope = currentUser?.surface === "TenantDesktop" ? "mls" : "sms";
  const billingScopeLabel = billingScope === "mls" ? "MLS" : "SMS";
  const canManageBilling = hasPermission(currentUser, billingScope === "mls" ? "mls.billing.manage" : "sms.billing.manage");
  const billingQueryKey = ["tenant", billingTenantSlug, billingScope, "billing-overview"];

  const billingQuery = useQuery({
    queryKey: billingQueryKey,
    queryFn: () => httpGet<TenantBillingOverviewResponse>(`/api/tenants/${billingTenantSlug}/billing/overview?scope=${billingScope}`),
    enabled: Boolean(billingTenantSlug)
  });
  const portalMutation = useMutation({
    mutationFn: () =>
      httpPostJson<TenantBillingPortalSessionResponse, Record<string, never>>(
        `/api/tenants/${billingTenantSlug}/billing/portal-session?scope=${billingScope}`,
        {}
      ),
    onSuccess: (response) => {
      window.location.assign(response.url);
    },
    onError: (error) => {
      toast.error({
        title: "Unable to open billing portal",
        message: error.message
      });
    }
  });
  const planChangeMutation = useMutation({
    mutationFn: (payload: TenantBillingPlanChangeRequest) =>
      httpPostJson<TenantBillingPlanChangeResponse, TenantBillingPlanChangeRequest>(
        `/api/tenants/${billingTenantSlug}/billing/subscription-change-requests?scope=${billingScope}`,
        payload
      ),
    onSuccess: (response) => {
      setSelectedTierId("");
      setIsDowngradeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: billingQueryKey });
      toast.success({
        title: "Plan switch scheduled",
        message: response.message
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to schedule plan switch",
        message: error.message
      });
    }
  });
  const cancelPlanChangeMutation = useMutation({
    mutationFn: () =>
      httpDeleteJson<TenantBillingCancelPlanChangeResponse>(
        `/api/tenants/${billingTenantSlug}/billing/subscription-change-requests?scope=${billingScope}`
      ),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: billingQueryKey });
      toast.warning({
        title: "Plan switch cancelled",
        message: `${response.message} Cooldown ends ${formatDateTime(response.cooldownUntilUtc)}.`
      });
    },
    onError: (error) => {
      toast.error({
        title: "Unable to cancel plan switch",
        message: error.message
      });
    }
  });

  const history = billingQuery.data?.history ?? [];
  const billingProvider = billingQuery.data?.standing.billingProvider ?? "Manual";
  const isStripeManaged = billingProvider === "Stripe";
  const isAutorenewalManaged = billingProvider !== "Manual";
  const canOpenBillingPortal = canManageBilling && (billingQuery.data?.standing.canOpenBillingPortal ?? false);
  const pendingPlanChange = billingQuery.data?.pendingPlanChange ?? null;
  const availableTiers = billingQuery.data?.availableTiers ?? [];
  const selectedTier = availableTiers.find((tier) => tier.id === selectedTierId) ?? null;
  const selectedImpact = useMemo(
    () => selectedTier && billingQuery.data
      ? buildClientPlanImpact(billingQuery.data, selectedTier)
      : null,
    [billingQuery.data, selectedTier]
  );
  const selectableTiers = availableTiers.filter((tier) => !isCurrentTier(tier.displayName, billingQuery.data?.plan.subscriptionPlan));
  const renewalWarningMessage = buildRenewalWarning(
    billingQuery.data?.standing.nextRenewalDateUtc,
    isAutorenewalManaged,
    billingProvider
  );

  function requestPlanSwitch(confirmDowngrade = false) {
    if (!selectedTier) {
      toast.warning({
        title: "Select a target plan",
        message: "Choose the tier and edition that should apply after the next renewal cycle."
      });
      return;
    }

    if (selectedImpact?.isDowngrade && !confirmDowngrade) {
      setIsDowngradeModalOpen(true);
      return;
    }

    planChangeMutation.mutate({
      targetTierId: selectedTier.id,
      confirmDowngrade
    });
  }

  return (
    <RecordWorkspace
      breadcrumbs={`${billingTenantSlug} / ${billingScopeLabel} / Billing`}
      title="Subscription and billing"
      description="Review tenant subscription standing, included delivery surface, auto-renewal timing, and provider-synced billing history from one commercial workspace."
      recordCount={history.length}
      singularLabel="billing record"
      headerBottom={
        <WorkspaceTopTabs
          tabs={billingWorkspaceTabs}
          activeTab={activeBillingTab}
          onChange={setActiveBillingTab}
        />
      }
    >
      <RecordScrollRegion>
        <WorkspaceScrollStack className="p-0">
          {billingQuery.isError ? (
            <WorkspaceNotice tone="error">
              Unable to load the tenant billing workspace right now.
            </WorkspaceNotice>
          ) : null}

          {portalMutation.isError ? (
            <WorkspaceNotice tone="error">
              {portalMutation.error.message}
            </WorkspaceNotice>
          ) : null}

          {renewalWarningMessage ? (
            <WorkspaceNotice tone={isAutorenewalManaged ? "info" : "error"}>
              {renewalWarningMessage}
            </WorkspaceNotice>
          ) : null}

          {activeBillingTab === "overview" ? (
            <BillingOverviewTab
              data={billingQuery.data}
              isLoading={billingQuery.isLoading}
              history={history}
              billingProvider={billingProvider}
              isAutorenewalManaged={isAutorenewalManaged}
            />
          ) : null}

          {activeBillingTab === "plan" ? (
            <BillingPlanSwitchTab
              data={billingQuery.data}
              isLoading={billingQuery.isLoading}
              canManageBilling={canManageBilling}
              pendingPlanChange={pendingPlanChange}
              selectedTierId={selectedTierId}
              selectedTier={selectedTier}
              selectedImpact={selectedImpact}
              selectableTiers={selectableTiers}
              availableTiers={availableTiers}
              isPlanChangePending={planChangeMutation.isPending}
              isCancelPlanChangePending={cancelPlanChangeMutation.isPending}
              onSelectedTierChange={setSelectedTierId}
              onRequestPlanSwitch={() => requestPlanSwitch(false)}
              onCancelPlanChange={() => cancelPlanChangeMutation.mutate()}
            />
          ) : null}

          {activeBillingTab === "payments" ? (
            <BillingPaymentsTab
              data={billingQuery.data}
              isLoading={billingQuery.isLoading}
              history={history}
              billingProvider={billingProvider}
              isStripeManaged={isStripeManaged}
              isAutorenewalManaged={isAutorenewalManaged}
              canOpenBillingPortal={canOpenBillingPortal}
              isPortalPending={portalMutation.isPending}
              onOpenPortal={() => portalMutation.mutate()}
            />
          ) : null}

          {activeBillingTab === "recovery" ? (
            <BillingRecoveryTab
              data={billingQuery.data}
              isLoading={billingQuery.isLoading}
              billingProvider={billingProvider}
              isAutorenewalManaged={isAutorenewalManaged}
              canOpenBillingPortal={canOpenBillingPortal}
              isPortalPending={portalMutation.isPending}
              onOpenPortal={() => portalMutation.mutate()}
            />
          ) : null}

          {activeBillingTab === "entitlements" ? (
            <BillingEntitlementsTab
              data={billingQuery.data}
              isLoading={billingQuery.isLoading}
              pendingPlanChange={pendingPlanChange}
            />
          ) : null}
        </WorkspaceScrollStack>
      </RecordScrollRegion>

      <RecordSurfaceModal
        open={isDowngradeModalOpen}
        eyebrow="Downgrade guard"
        title="Confirm locked-module impact"
        description="This tier or edition switch reduces module access after the next renewal. Review the affected modules and active work before scheduling."
        maxWidthClassName="max-w-[min(44rem,calc(100vw-2rem))]"
        onClose={() => setIsDowngradeModalOpen(false)}
        actions={
          <>
            <WorkspaceModalButton onClick={() => setIsDowngradeModalOpen(false)}>
              Keep current plan
            </WorkspaceModalButton>
            <WorkspaceModalButton
              tone="danger"
              disabled={planChangeMutation.isPending}
              onClick={() => requestPlanSwitch(true)}
            >
              {planChangeMutation.isPending ? "Scheduling..." : "Schedule downgrade"}
            </WorkspaceModalButton>
          </>
        }
      >
        <div className="h-full overflow-y-auto pr-1">
          {selectedImpact ? <ImpactSummary impact={selectedImpact} /> : null}
        </div>
      </RecordSurfaceModal>
    </RecordWorkspace>
  );
}
