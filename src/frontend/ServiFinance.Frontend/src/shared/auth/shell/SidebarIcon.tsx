import type { NavItem } from "./navigation";

type SidebarIconName = NavItem["icon"] | "collapse" | "expand" | "logout" | "chevron" | "sun" | "moon";

type Props = {
  name: SidebarIconName;
};

export function SidebarIcon({ name }: Props) {
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
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "tenants":
      return (
        <svg {...common}>
          <path d="M4 20v-1.2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4V20" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      );
    case "subscriptions":
      return (
        <svg {...common}>
          <path d="M12 3l7 4v10l-7 4-7-4V7l7-4Z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      );
    case "modules":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <path d="M13 16.5h7" />
          <path d="M16.5 13v7" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path d="M3 12h4l2.2-4 4.1 8 2.2-4H21" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M20 8.5a3 3 0 0 1-2 2.82" />
          <path d="M21 21v-1a3.8 3.8 0 0 0-2.8-3.67" />
        </svg>
      );
    case "customers":
      return (
        <svg {...common}>
          <path d="M4 19.5v-1a3.5 3.5 0 0 1 3.5-3.5h4a3.5 3.5 0 0 1 3.5 3.5v1" />
          <circle cx="9.5" cy="8" r="3.5" />
          <path d="M18 8h3" />
          <path d="M19.5 6.5v3" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M8.5 8h7" />
          <path d="M8.5 12h7" />
          <path d="M8.5 16h4.5" />
        </svg>
      );
    case "dispatch":
      return (
        <svg {...common}>
          <path d="M5 17h4" />
          <path d="M15 17h4" />
          <circle cx="8" cy="17" r="2" />
          <circle cx="16" cy="17" r="2" />
          <path d="M5 17V9h7l3 3h4v5" />
          <path d="M12 9V5H7" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
          <path d="M3 19h18" />
        </svg>
      );
    case "service":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 1 0 3 3l2.7-2.7-1.6-1.6-2.7 2.7a4 4 0 0 0-1.4-1.4Z" />
          <path d="m2 22 6.3-6.3" />
        </svg>
      );
    case "desktop":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2" />
          <path d="M12 19.8V22" />
          <path d="m4.93 4.93 1.56 1.56" />
          <path d="m17.51 17.51 1.56 1.56" />
          <path d="M2 12h2.2" />
          <path d="M19.8 12H22" />
          <path d="m4.93 19.07 1.56-1.56" />
          <path d="m17.51 6.49 1.56-1.56" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M20 15.2A8 8 0 1 1 8.8 4a6.4 6.4 0 0 0 11.2 11.2Z" />
        </svg>
      );
  }
}
