import type { ReactNode } from "react";

type MobileRecordFieldProps = {
  label: string;
  value: ReactNode;
  emptyLabel?: string;
  showLabel?: boolean;
  className?: string;
};

type MobileRecordFieldGridProps = {
  children: ReactNode;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function isEmptyMobileRecordValue(value: ReactNode) {
  return value === null || value === undefined || value === "" || value === "-";
}

export function mobileRecordFallback(label: string) {
  return `No ${label}`;
}

export function MobileRecordField({
  label,
  value,
  emptyLabel,
  showLabel = true,
  className
}: MobileRecordFieldProps) {
  const isEmpty = isEmptyMobileRecordValue(value);

  return (
    <span className={joinClasses("min-w-0 text-xs leading-5 text-base-content/68", className)}>
      {showLabel && !isEmpty ? (
        <span className="font-semibold text-base-content/82">{label}: </span>
      ) : null}
      <span className={joinClasses(isEmpty ? "italic text-base-content/45" : "text-base-content/70")}>
        {isEmpty ? (emptyLabel ?? mobileRecordFallback(label)) : value}
      </span>
    </span>
  );
}

export function MobileRecordFieldGrid({ children, className }: MobileRecordFieldGridProps) {
  return (
    <div className={joinClasses("grid gap-1.5", className)}>
      {children}
    </div>
  );
}

export function mobileRecordRailClass(count: number) {
  if (count <= 1) {
    return "max-lg:[&_tbody]:grid max-lg:[&_tbody]:grid-cols-1";
  }

  if (count === 2) {
    return "max-lg:[&_tbody]:grid max-lg:[&_tbody]:grid-cols-2";
  }

  return "max-lg:overflow-x-auto max-lg:[&_tbody]:flex max-lg:[&_tbody]:w-max max-lg:[&_tbody_tr]:w-[17rem] max-lg:[&_tbody_tr]:shrink-0";
}
