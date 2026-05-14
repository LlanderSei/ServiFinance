import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

type WorkspaceScrollStackProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceMetricGridProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceKpiRailLayoutProps = {
  kpis: ReactNode;
  children: ReactNode;
  className?: string;
  railClassName?: string;
  contentClassName?: string;
};

type WorkspacePanelGridProps = {
  children: ReactNode;
  className?: string;
  singleColumn?: boolean;
};

type WorkspacePanelProps = {
  children: ReactNode;
  className?: string;
};

type WorkspacePanelHeaderProps = {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
};

type WorkspaceToolbarProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceSubtableShellProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceSubtableProps = TableHTMLAttributes<HTMLTableElement>;

type WorkspaceDetailGridProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceDetailItemProps = {
  label: string;
  value: ReactNode;
};

type WorkspaceEmptyStateProps = HTMLAttributes<HTMLParagraphElement>;

type WorkspaceNoteListProps = {
  items: ReactNode[];
  className?: string;
};

type WorkspaceTenantCellProps = {
  title: ReactNode;
  subtitle: ReactNode;
};

type WorkspaceAlertTone = "critical" | "warning" | "info";

type WorkspaceAlertItemProps = {
  title: ReactNode;
  message: ReactNode;
  badge: ReactNode;
  tone?: WorkspaceAlertTone;
};

type WorkspaceAlertListProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceDistributionRowProps = {
  label: ReactNode;
  value: ReactNode;
  percentage: number;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkspaceScrollStack({ children, className }: WorkspaceScrollStackProps) {
  return (
    <div className={joinClasses("authed-workspace__workspace-scroll-stack min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pb-4 pr-1 [scroll-padding-bottom:1rem] [contain:layout_paint] lg:pb-0 lg:[scroll-padding-bottom:1rem]", className)}>
      <div className="grid auto-rows-max gap-3 lg:gap-4">
        {children}
      </div>
    </div>
  );
}

export function WorkspaceMetricGrid({ children, className }: WorkspaceMetricGridProps) {
  return (
    <section className={joinClasses("flex items-stretch gap-3 overflow-x-auto pb-2 lg:grid lg:gap-4 lg:overflow-visible lg:pb-0 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 [&>*]:min-h-[9rem] [&>*]:min-w-[14rem] lg:[&>*]:min-h-[9rem] lg:[&>*]:min-w-0", className)}>
      {children}
    </section>
  );
}

export function WorkspaceKpiRailLayout({
  kpis,
  children,
  className,
  railClassName,
  contentClassName
}: WorkspaceKpiRailLayoutProps) {
  return (
    <div
      className={joinClasses(
        "grid h-auto min-h-0 flex-none gap-4 lg:h-full lg:flex-1 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]",
        className
      )}
    >
      <aside
        className={joinClasses(
          "min-h-0 max-h-none overflow-x-auto overflow-y-hidden overscroll-contain rounded-box border border-base-300/65 bg-base-200/35 p-3 [contain:layout_paint] lg:overflow-x-hidden lg:overflow-y-auto",
          railClassName
        )}
      >
        <div className="flex items-stretch gap-3 lg:grid [&>*]:min-h-[9rem] [&>*]:min-w-[14rem] lg:[&>*]:min-h-[9rem] lg:[&>*]:min-w-0">
          {kpis}
        </div>
      </aside>

      <section className={joinClasses("min-h-0 flex flex-col gap-4", contentClassName)}>
        {children}
      </section>
    </div>
  );
}

export function WorkspacePanelGrid({
  children,
  className,
  singleColumn = false
}: WorkspacePanelGridProps) {
  return (
    <section
      className={joinClasses(
        "grid gap-4",
        singleColumn ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2",
        className
      )}
    >
      {children}
    </section>
  );
}

export function WorkspacePanel({ children, className }: WorkspacePanelProps) {
  return (
    <section
      className={joinClasses(
        "authed-workspace__panel flex min-h-0 flex-col gap-3 rounded-box border border-base-300/65 bg-base-100 p-3 shadow-sm lg:gap-4 lg:p-4 lg:[content-visibility:auto] lg:[contain-intrinsic-size:360px]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function WorkspacePanelHeader({ eyebrow, title, actions }: WorkspacePanelHeaderProps) {
  return (
    <div className="flex flex-row items-start justify-between gap-3 lg:gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60 lg:text-[0.74rem]">{eyebrow}</p> : null}
        <h2 className="mt-0.5 text-[1.05rem] leading-tight tracking-[-0.03em] break-words text-base-content lg:mt-1 lg:text-[1.15rem]">{title}</h2>
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

export function WorkspaceToolbar({ children, className }: WorkspaceToolbarProps) {
  return (
    <div className={joinClasses("flex flex-wrap items-end gap-2 lg:gap-3", className)}>
      {children}
    </div>
  );
}

export function WorkspaceSubtableShell({ children, className }: WorkspaceSubtableShellProps) {
  return (
    <div className={joinClasses("authed-workspace__subtable-shell overflow-auto rounded-box border border-base-300/65 bg-base-100", className)}>
      {children}
    </div>
  );
}

export function WorkspaceSubtable({ children, className, ...props }: WorkspaceSubtableProps) {
  return (
    <table
      className={joinClasses(
        "authed-workspace__subtable table table-pin-rows text-sm text-base-content max-lg:block max-lg:min-w-0 max-lg:[&_thead]:hidden max-lg:[&_tbody]:grid max-lg:[&_tbody]:gap-3 max-lg:[&_tr]:grid max-lg:[&_tr]:grid-cols-1 max-lg:[&_tr]:gap-2 max-lg:[&_tr]:rounded-[1.15rem] max-lg:[&_tr]:border max-lg:[&_tr]:border-base-300/70 max-lg:[&_tr]:bg-base-100 max-lg:[&_tr]:p-3 max-lg:[&_td]:min-w-0 max-lg:[&_td]:border-0 max-lg:[&_td]:px-0 max-lg:[&_td]:py-0 max-lg:[&_td]:text-[0.82rem] max-lg:[&_td]:leading-5 max-lg:[&_td]:break-words max-lg:[&_td:first-child]:text-sm max-lg:[&_td:first-child]:font-bold [&_td]:border-base-300/55 [&_th]:border-b [&_th]:border-base-300/70 [&_th]:bg-base-200 [&_th]:text-[0.76rem] [&_th]:font-extrabold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-base-content/64 [&_tr:hover_td]:bg-base-content/3",
        className
      )}
      {...props}
    >
      {children}
    </table>
  );
}

export function WorkspaceDetailGrid({ children, className }: WorkspaceDetailGridProps) {
  return (
    <dl className={joinClasses("grid gap-3 md:grid-cols-2", className)}>
      {children}
    </dl>
  );
}

export function WorkspaceDetailItem({ label, value }: WorkspaceDetailItemProps) {
  return (
    <div className="rounded-box border border-base-300/65 bg-base-200/52 px-4 py-3">
      <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-base-content">{value}</dd>
    </div>
  );
}

export function WorkspaceEmptyState({ className, ...props }: WorkspaceEmptyStateProps) {
  return <p className={joinClasses("text-base-content/65", className)} {...props} />;
}

export function WorkspaceNoteList({ items, className }: WorkspaceNoteListProps) {
  return (
    <ul className={joinClasses("m-0 grid list-disc gap-3 pl-5 text-base-content/70 marker:text-primary", className)}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function WorkspaceTenantCell({ title, subtitle }: WorkspaceTenantCellProps) {
  return (
    <div className="grid gap-1">
      <strong className="text-base-content">{title}</strong>
      <span className="text-sm text-base-content/65">{subtitle}</span>
    </div>
  );
}

export function WorkspaceAlertList({ children, className }: WorkspaceAlertListProps) {
  return <ul className={joinClasses("m-0 grid list-none gap-3 p-0", className)}>{children}</ul>;
}

export function WorkspaceAlertItem({
  title,
  message,
  badge,
  tone = "info"
}: WorkspaceAlertItemProps) {
  const toneClasses =
    tone === "critical"
      ? "border-error/24 bg-error/10"
      : tone === "warning"
        ? "border-warning/30 bg-warning/12"
        : "border-base-300/70 bg-base-200/48";
  const badgeClasses =
    tone === "critical"
      ? "border border-error/20 bg-error/14 text-error"
      : tone === "warning"
        ? "border border-warning/20 bg-warning/18 text-warning"
        : "border border-base-300/65 bg-base-100/92 text-base-content/72";

  return (
    <li className={joinClasses("flex flex-wrap items-start justify-between gap-4 rounded-2xl border px-4 py-4", toneClasses)}>
      <div>
        <strong className="text-base-content">{title}</strong>
        <p className="mt-1 text-base-content/65">{message}</p>
      </div>
      <span className={joinClasses("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold", badgeClasses)}>
        {badge}
      </span>
    </li>
  );
}

export function WorkspaceDistributionRow({ label, value, percentage }: WorkspaceDistributionRowProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4">
        <strong className="text-base-content">{label}</strong>
        <span className="font-bold text-base-content/65">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-base-300/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-info"
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
    </div>
  );
}
