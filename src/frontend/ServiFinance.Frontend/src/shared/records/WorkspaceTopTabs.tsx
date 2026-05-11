type WorkspaceTopTab = {
  key: string;
  label: string;
};

type WorkspaceTopTabsProps = {
  tabs: WorkspaceTopTab[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export function WorkspaceTopTabs({ tabs, activeTab, onChange }: WorkspaceTopTabsProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
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
  );
}
