interface SmsDispatchTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
}

export function SmsDispatchTabs({
  activeTab,
  setActiveTab,
  isAdmin,
}: SmsDispatchTabsProps) {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "pending", label: "Pending Tasks" },
    ...(isAdmin ? [{ key: "assignments", label: "Assignments" }] : []),
    { key: "mytasks", label: "My Tasks" },
    { key: "timeline", label: "Timeline" },
    ...(isAdmin ? [{ key: "history", label: "History" }] : []),
  ];

  return (
    <div className="flex gap-1 rounded-xl p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
            activeTab === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content hover:border-base-300"
          }`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
