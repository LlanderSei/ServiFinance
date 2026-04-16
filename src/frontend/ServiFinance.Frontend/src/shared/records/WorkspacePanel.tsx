import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

type WorkspaceScrollStackProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceMetricGridProps = {
  children: ReactNode;
  className?: string;
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
    <div className={joinClasses("min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pr-1 [contain:layout_paint]", className)}>
      <div className="grid auto-rows-max gap-4">
        {children}
      </div>
    </div>
  );
}

export function WorkspaceMetricGrid({ children, className }: WorkspaceMetricGridProps) {
  return (
    <section className={joinClasses("grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5", className)}>
      {children}
    </section>
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
        "authed-workspace__panel flex min-h-0 flex-col gap-4 rounded-box border border-base-300/65 bg-base-100 p-4 shadow-sm [content-visibility:auto] [contain-intrinsic-size:360px]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function WorkspacePanelHeader({ eyebrow, title, actions }: WorkspacePanelHeaderProps) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-start">
      <div>
        {eyebrow ? <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{eyebrow}</p> : null}
        <h2 className="mt-1 text-[1.15rem] tracking-[-0.03em] text-base-content">{title}</h2>
      </div>

      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function WorkspaceToolbar({ children, className }: WorkspaceToolbarProps) {
  return (
    <div className={joinClasses("flex flex-wrap items-end gap-3", className)}>
      {children}
    </div>
  );
}

export function WorkspaceSubtableShell({ children, className }: WorkspaceSubtableShellProps) {
  return (
    <div className={joinClasses("authed-workspace__subtable-shell overflow-x-auto overflow-y-hidden rounded-box border border-base-300/65 bg-base-100", className)}>
      {children}
    </div>
  );
}

export function WorkspaceSubtable({ children, className, ...props }: WorkspaceSubtableProps) {
  return (
    <table
      className={joinClasses(
        "authed-workspace__subtable table table-pin-rows text-sm text-base-content [&_td]:border-base-300/55 [&_th]:border-b [&_th]:border-base-300/70 [&_th]:bg-base-200 [&_th]:text-[0.76rem] [&_th]:font-extrabold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-base-content/64 [&_tr:hover_td]:bg-base-content/3",
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
      <dd className="mt-1 text-base-content">{value}</dd>
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
