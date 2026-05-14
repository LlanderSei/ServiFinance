import type { ElementType } from "react";
import { useEffect, useState } from "react";
import { BottomCenterToast } from "@/shared/toast/BottomCenterToast";

export type CustomerBottomTab<TTab extends string> = {
  key: TTab;
  label: string;
  count?: number;
  icon?: ElementType<{ className?: string }>;
};

type CustomerBottomTabsProps<TTab extends string> = {
  tabs: Array<CustomerBottomTab<TTab>>;
  activeTab: TTab;
  onChange: (tab: TTab) => void;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CustomerBottomTabs<TTab extends string>({
  tabs,
  activeTab,
  onChange,
  className
}: CustomerBottomTabsProps<TTab>) {
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

  function handleTabClick(tab: CustomerBottomTab<TTab>) {
    onChange(tab.key);
    setMobileToast({ id: Date.now(), label: tab.label });
  }

  return (
    <>
      <div
        className={joinClasses(
          "pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#eef3fb] via-[#eef3fb]/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:px-0",
          className
        )}
      >
        <div className="mx-auto w-full max-w-[1480px] lg:px-5">
          <div className="lg:ml-[310px]">
            <nav
              className="pointer-events-auto mx-auto grid w-full max-w-[1120px] items-stretch rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-1 shadow-[0_18px_36px_rgba(35,46,76,0.14)] backdrop-blur-xl"
              style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
              aria-label="Customer workspace sections"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={joinClasses(
                      "flex min-w-0 items-center justify-center gap-1.5 rounded-xl border-b-2 px-2 py-3 text-center text-[0.68rem] font-bold uppercase leading-tight tracking-[0.08em] transition-colors duration-200 sm:flex-row sm:gap-2 sm:text-sm sm:normal-case sm:tracking-normal",
                      isActive
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    )}
                    onClick={() => handleTabClick(tab)}
                    aria-label={tab.label}
                    title={tab.label}
                  >
                    {Icon ? <Icon className="h-5 w-5 shrink-0 sm:hidden" /> : null}
                    <span className={joinClasses("min-w-0 whitespace-normal break-words", Icon && "hidden sm:inline")}>
                      {tab.label}
                    </span>
                    {tab.count != null ? (
                      <span
                        className={joinClasses(
                          "shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
                          isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <BottomCenterToast open={Boolean(mobileToast)}>
        {mobileToast?.label}
      </BottomCenterToast>
    </>
  );
}
