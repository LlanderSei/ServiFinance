import type { ButtonHTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

type RecordTableShellProps = {
  children: ReactNode;
  className?: string;
};

type RecordTableProps = TableHTMLAttributes<HTMLTableElement>;

type RecordTableStateRowProps = {
  colSpan: number;
  children: ReactNode;
  tone?: "default" | "error";
};

type RecordTableActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RecordTableShell({ children, className }: RecordTableShellProps) {
  return (
    <div
      className={joinClasses(
        "min-h-0 flex-1 overflow-auto rounded-box border border-base-300/70 bg-base-100 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function RecordTable({ children, className, ...props }: RecordTableProps) {
  return (
    <table
      className={joinClasses(
        "table table-pin-rows table-zebra w-full text-sm text-base-content [&_tbody_td]:border-b [&_tbody_td]:border-base-300/60 [&_tbody_td]:px-4 [&_tbody_td]:py-2 [&_tbody_td]:align-top [&_tbody_tr:hover]:bg-primary/5 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:border-b [&_thead_th]:border-base-300/70 [&_thead_th]:bg-base-200/70 [&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:text-left [&_thead_th]:text-[0.82rem] [&_thead_th]:font-extrabold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.08em] [&_thead_th]:text-base-content/60",
        className
      )}
      {...props}
    >
      {children}
    </table>
  );
}

export function RecordTableStateRow({
  colSpan,
  children,
  tone = "default"
}: RecordTableStateRowProps) {
  return (
    <tr>
      <td
        className={joinClasses(
          "py-6 text-center align-middle text-base-content/65",
          tone === "error" && "text-error"
        )}
        colSpan={colSpan}
      >
        {children}
      </td>
    </tr>
  );
}

export function RecordTableActionButton({
  className,
  children,
  type = "button",
  ...props
}: RecordTableActionButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "btn btn-sm border border-base-300/70 bg-base-100/80 text-primary shadow-none hover:bg-base-200/80 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
