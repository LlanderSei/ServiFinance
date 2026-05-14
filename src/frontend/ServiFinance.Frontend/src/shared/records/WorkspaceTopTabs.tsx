import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  History,
  KeyRound,
  Layers,
  ListChecks,
  PackageCheck,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import { BottomCenterToast } from "@/shared/toast/BottomCenterToast";

type WorkspaceTopTab = {
  key: string;
  label: string;
};

type WorkspaceTopTabsProps = {
  tabs: WorkspaceTopTab[];
  activeTab: string;
  onChange: (tab: string) => void;
  mobilePlacement?: "fixed" | "inline";
};

export function WorkspaceTopTabs({ tabs, activeTab, onChange, mobilePlacement = "fixed" }: WorkspaceTopTabsProps) {
  const [mobileToast, setMobileToast] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    if (!mobileToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMobileToast(null);
    }, 1350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mobileToast]);

  function handleMobileTabClick(tab: WorkspaceTopTab) {
    onChange(tab.key);
    setMobileToast((currentToast) => ({
      id: (currentToast?.id ?? 0) + 1,
      label: tab.label
    }));
  }

  if (mobilePlacement === "inline") {
    return (
      <nav className="authed-workspace__inline-tabs min-w-0 overflow-x-auto" aria-label="Workspace tabs">
        <div className="flex w-max min-w-full gap-1 rounded-xl p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                className={`whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-transparent text-base-content/65 hover:border-base-300 hover:bg-base-200/70 hover:text-base-content"
                }`}
                onClick={() => onChange(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  const mobileNavClass = mobilePlacement === "fixed"
    ? "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
    : "sticky bottom-0 z-10 shadow-sm";

  return (
    <>
      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <div className="flex w-max min-w-full gap-1 rounded-xl p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/60 hover:border-base-300 hover:text-base-content"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: "var(--tenant-header-fg, var(--color-primary))",
                        color: "var(--tenant-header-fg, var(--color-primary))"
                      }
                    : {
                        color: "var(--tenant-header-muted, color-mix(in srgb, var(--color-base-content) 60%, transparent))"
                      }
                }
                onClick={() => onChange(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <nav className={`authed-workspace__bottom-tabs ${mobileNavClass} rounded-[1.35rem] border border-base-300/75 bg-base-100/96 p-1.5 backdrop-blur-xl lg:hidden`} aria-label="Workspace tabs">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = resolveTabIcon(tab.key, tab.label);

            return (
              <button
                key={tab.key}
                type="button"
                aria-label={tab.label}
                title={tab.label}
                className={`grid min-h-[3rem] place-items-center gap-0.5 rounded-[1rem] px-2 py-2 text-[0.66rem] font-extrabold uppercase tracking-[0.04em] transition-colors duration-200 ${
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-base-content/58 hover:bg-base-200/70 hover:text-base-content"
                }`}
                onClick={() => handleMobileTabClick(tab)}
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
                <span className="hidden sm:block sm:line-clamp-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <BottomCenterToast open={Boolean(mobileToast)}>
        {mobileToast?.label}
      </BottomCenterToast>
    </>
  );
}

function resolveTabIcon(key: string, label: string): LucideIcon {
  const normalized = `${key} ${label}`.toLowerCase();

  if (normalized.includes("overview") || normalized.includes("dashboard")) {
    return Activity;
  }

  if (normalized.includes("role") || normalized.includes("user")) {
    return UsersRound;
  }

  if (normalized.includes("permission") || normalized.includes("access")) {
    return KeyRound;
  }

  if (normalized.includes("matrix") || normalized.includes("security")) {
    return ShieldCheck;
  }

  if (normalized.includes("history") || normalized.includes("audit") || normalized.includes("archive")) {
    return normalized.includes("archive") ? Archive : History;
  }

  if (normalized.includes("schedule") || normalized.includes("timeline")) {
    return CalendarDays;
  }

  if (normalized.includes("worklist")) {
    return ClipboardList;
  }

  if (normalized.includes("categor")) {
    return Layers;
  }

  if (normalized.includes("preset") || normalized.includes("coverage")) {
    return PackageCheck;
  }

  if (normalized.includes("payment") || normalized.includes("billing") || normalized.includes("finance")) {
    return CreditCard;
  }

  if (normalized.includes("evidence") || normalized.includes("attachment")) {
    return PackageCheck;
  }

  if (normalized.includes("pending") || normalized.includes("queue")) {
    return Clock;
  }

  if (normalized.includes("register") || normalized.includes("ledger") || normalized.includes("catalog")) {
    return ClipboardList;
  }

  if (normalized.includes("entitlement") || normalized.includes("recovery")) {
    return Layers;
  }

  if (normalized.includes("profile")) {
    return UserRound;
  }

  if (normalized.includes("report") || normalized.includes("system")) {
    return FileText;
  }

  return ListChecks;
}
