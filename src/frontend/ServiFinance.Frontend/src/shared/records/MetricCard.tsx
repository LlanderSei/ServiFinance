import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  description: string;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function MetricCard({ label, value, description, className }: MetricCardProps) {
  return (
    <article
      className={joinClasses(
        "grid gap-1.5 rounded-box border border-base-300/70 bg-base-100/70 px-4 py-4 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <span className="text-[0.74rem] font-extrabold uppercase tracking-[0.08em] text-base-content/60">{label}</span>
      <strong className="text-[1.9rem] tracking-[-0.05em] text-base-content">{value}</strong>
      <small className="leading-[1.55] text-base-content/70">{description}</small>
    </article>
  );
}
