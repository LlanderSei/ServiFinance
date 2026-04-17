import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  PackagePlus,
  PanelTop,
  ReceiptText,
  Settings2,
  SquareUserRound,
  Sun,
  Truck,
  UserRoundPlus,
  Users,
  Wrench,
  ChartColumn,
  Globe
} from "lucide-react";
import type { NavItem } from "./navigation";

type SidebarIconName = NavItem["icon"] | "collapse" | "expand" | "logout" | "chevron" | "sun" | "moon";

type Props = {
  name: SidebarIconName;
};

const iconMap: Record<SidebarIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  tenants: Users,
  subscriptions: PackagePlus,
  modules: Settings2,
  health: Activity,
  users: SquareUserRound,
  service: Wrench,
  desktop: Monitor,
  web: Globe,
  customers: UserRoundPlus,
  requests: ReceiptText,
  dispatch: Truck,
  reports: ChartColumn,
  collapse: ChevronLeft,
  expand: ChevronRight,
  chevron: ChevronDown,
  logout: LogOut,
  sun: Sun,
  moon: Moon
};

export function SidebarIcon({ name }: Props) {
  const Icon = iconMap[name] ?? PanelTop;
  return <Icon size={18} strokeWidth={1.9} aria-hidden />;
}
