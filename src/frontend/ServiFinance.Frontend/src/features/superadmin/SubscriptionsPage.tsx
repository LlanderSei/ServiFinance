import { useMemo, useState } from "react";
import { SubscriptionTierCard } from "@/shared/api/contracts";
import { useSubscriptionTiers } from "@/shared/api/useSubscriptionTiers";
import { RecordDetailsModal } from "@/shared/records/RecordDetailsModal";
import {
  RecordTable,
  RecordTableActionButton,
  RecordTableShell,
  RecordTableStateRow
} from "@/shared/records/RecordTable";
import { RecordWorkspace } from "@/shared/records/RecordWorkspace";

const segmentOrder = ["Micro", "Small", "Medium"];
const editionOrder = ["Standard", "Premium"];

function getModulesByChannel(tier: SubscriptionTierCard, channel: "Web" | "Desktop") {
  return tier.modules.filter((module) => module.channel === channel);
}

export function SubscriptionsPage() {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTierCard | null>(null);
  const { data } = useSubscriptionTiers();
  const tiers = useMemo(() => {
    return [...(data ?? [])].sort((left, right) => {
      const segmentDelta = segmentOrder.indexOf(left.businessSizeSegment) - segmentOrder.indexOf(right.businessSizeSegment);
      if (segmentDelta !== 0) {
        return segmentDelta;
      }

      const editionDelta = editionOrder.indexOf(left.subscriptionEdition) - editionOrder.indexOf(right.subscriptionEdition);
      if (editionDelta !== 0) {
        return editionDelta;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  }, [data]);
  const tierDetails = useMemo(() => {
    if (!selectedTier) {
      return [];
    }

    const webModules = getModulesByChannel(selectedTier, "Web");
    const desktopModules = getModulesByChannel(selectedTier, "Desktop");

    return [
      {
        title: "Tier profile",
        items: [
          { label: "Display name", value: selectedTier.displayName },
          { label: "Code", value: selectedTier.code },
          { label: "Segment", value: selectedTier.businessSizeSegment },
          { label: "Edition", value: selectedTier.subscriptionEdition }
        ]
      },
      {
        title: "Commercial terms",
        items: [
          { label: "Price", value: selectedTier.priceDisplay },
          { label: "Billing", value: selectedTier.billingLabel },
          { label: "Audience", value: selectedTier.audienceSummary },
          { label: "Plan summary", value: selectedTier.planSummary }
        ]
      },
      {
        title: "Unlocked delivery",
        items: [
          {
            label: "Web modules",
            value: webModules.length ? webModules.map((module) => module.moduleName).join(", ") : "None"
          },
          {
            label: "Desktop modules",
            value: desktopModules.length ? desktopModules.map((module) => module.moduleName).join(", ") : "None"
          },
          { label: "Description", value: selectedTier.description },
          { label: "Highlight label", value: selectedTier.highlightLabel || "None" }
        ]
      }
    ];
  }, [selectedTier]);

  return (
    <>
      <RecordWorkspace
        breadcrumbs="SaaS / Subscription Tiers"
        title="Subscription tiers"
        description="Track the MSME catalog by segment, edition, delivery surface, and unlocked module count from one normalized record table."
        recordCount={tiers.length}
        singularLabel="tier"
        pluralLabel="tiers"
      >
        <RecordTableShell>
          <RecordTable>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Segment</th>
                <th>Edition</th>
                <th>Delivery</th>
                <th>Price</th>
                <th>Web modules</th>
                <th>Desktop modules</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!tiers.length ? (
                <RecordTableStateRow colSpan={8}>No subscription tiers found.</RecordTableStateRow>
              ) : null}

              {tiers.map((tier) => {
                const webModules = getModulesByChannel(tier, "Web");
                const desktopModules = getModulesByChannel(tier, "Desktop");
                const delivery = [tier.includesServiceManagementWeb ? "Web" : null, tier.includesMicroLendingDesktop ? "Desktop" : null]
                  .filter(Boolean)
                  .join(" + ");

                return (
                  <tr key={tier.id}>
                    <td>{tier.displayName}</td>
                    <td>{tier.businessSizeSegment}</td>
                    <td>{tier.subscriptionEdition}</td>
                    <td>{delivery || "None"}</td>
                    <td>{tier.priceDisplay}</td>
                    <td>{webModules.length}</td>
                    <td>{desktopModules.length}</td>
                    <td>
                      <RecordTableActionButton onClick={() => setSelectedTier(tier)}>
                        View
                      </RecordTableActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </RecordTable>
        </RecordTableShell>
      </RecordWorkspace>

      <RecordDetailsModal
        open={selectedTier !== null}
        eyebrow="Subscription tier"
        title={selectedTier?.displayName ?? ""}
        sections={tierDetails}
        onClose={() => setSelectedTier(null)}
      />
    </>
  );
}
