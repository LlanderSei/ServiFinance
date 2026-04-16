import { useState } from "react";

export type WorkspaceFabAction = {
  key: string;
  label: string;
  icon: "plus" | "refresh" | "users" | "request" | "calendar" | "download" | "print";
  onClick: () => void;
  disabled?: boolean;
};

type WorkspaceFabDockProps = {
  actions: WorkspaceFabAction[];
};

export function WorkspaceFabDock({ actions }: WorkspaceFabDockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!actions.length) {
    return null;
  }

  return (
    <div
      className={`authed-workspace__fab pointer-events-none static inline-flex items-center self-stretch justify-end gap-[0.55rem] md:absolute md:right-4 md:bottom-4 md:z-[3] md:self-auto md:justify-start ${isExpanded ? "" : "is-collapsed"}`}
    >
      <button
        type="button"
        className="btn btn-circle btn-sm pointer-events-auto border-base-300/70 bg-base-100 text-base-content shadow-lg transition-colors duration-200 hover:bg-base-200"
        aria-label={isExpanded ? "Collapse workspace actions" : "Expand workspace actions"}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className={`inline-flex transition-transform duration-200 ${isExpanded ? "" : "rotate-180"}`}>
          <WorkspaceFabIcon name="toggle" />
        </span>
      </button>

      <div
        className={`pointer-events-auto inline-flex max-w-full items-center gap-[0.55rem] rounded-full border border-base-300/70 bg-base-100 p-2 shadow-xl transition-[width,opacity,padding] duration-200 md:max-w-none ${isExpanded ? "" : "w-0 overflow-hidden border-transparent p-0 opacity-0 shadow-none pointer-events-none"}`}
        aria-label="Workspace actions"
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className="btn btn-circle btn-sm pointer-events-auto h-12 w-12 border-base-300/70 bg-base-100 text-base-content shadow-sm transition-colors duration-200 hover:bg-base-200"
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
            disabled={action.disabled}
            tabIndex={isExpanded ? 0 : -1}
          >
            <WorkspaceFabIcon name={action.icon} />
          </button>
        ))}
      </div>
    </div>
  );
}

type WorkspaceFabIconProps = {
  name: "plus" | "refresh" | "users" | "request" | "calendar" | "download" | "print" | "toggle";
};

function WorkspaceFabIcon({ name }: WorkspaceFabIconProps) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-3" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.9 3" />
          <path d="M20 20v-4h-4" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M20 8.5a3 3 0 0 1-2 2.82" />
        </svg>
      );
    case "request":
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M8.5 8h7" />
          <path d="M8.5 12h7" />
          <path d="M8.5 16h4.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      );
    case "print":
      return (
        <svg {...common}>
          <path d="M7 8V4h10v4" />
          <rect x="6" y="14" width="12" height="6" rx="1" />
          <path d="M6 11H5a2 2 0 0 0-2 2v2" />
          <path d="M18 11h1a2 2 0 0 1 2 2v2" />
          <path d="M8 17h8" />
        </svg>
      );
    case "toggle":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
  }
}
