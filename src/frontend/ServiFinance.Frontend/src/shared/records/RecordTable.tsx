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
        "authed-workspace__table-shell min-h-0 flex-1 overflow-auto rounded-box border border-base-300/70 bg-base-100 shadow-sm lg:[content-visibility:auto] lg:[contain-intrinsic-size:640px]",
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
        "authed-workspace__table table table-pin-rows table-zebra w-full text-sm text-base-content max-lg:block max-lg:min-w-0 max-lg:[&_thead]:hidden max-lg:[&_tbody]:grid max-lg:[&_tbody]:gap-3 max-lg:[&_tbody_tr]:grid max-lg:[&_tbody_tr]:grid-cols-1 max-lg:[&_tbody_tr]:gap-2 max-lg:[&_tbody_tr]:rounded-[1.15rem] max-lg:[&_tbody_tr]:border max-lg:[&_tbody_tr]:border-base-300/70 max-lg:[&_tbody_tr]:bg-base-100 max-lg:[&_tbody_tr]:p-3 max-lg:[&_tbody_tr]:shadow-sm max-lg:[&_tbody_td]:min-w-0 max-lg:[&_tbody_td]:border-0 max-lg:[&_tbody_td]:px-0 max-lg:[&_tbody_td]:py-0 max-lg:[&_tbody_td]:text-[0.82rem] max-lg:[&_tbody_td]:leading-5 max-lg:[&_tbody_td]:break-words max-lg:[&_tbody_td:first-child]:text-sm max-lg:[&_tbody_td:first-child]:font-bold [&_tbody_td]:border-b [&_tbody_td]:border-base-300/60 [&_tbody_td]:px-4 [&_tbody_td]:py-2 [&_tbody_td]:align-top [&_tbody_tr:hover]:bg-primary/5 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:border-b [&_thead_th]:border-base-300/70 [&_thead_th]:bg-base-200 [&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:text-left [&_thead_th]:text-[0.82rem] [&_thead_th]:font-extrabold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.08em] [&_thead_th]:text-base-content/60",
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
          "py-6 text-center align-middle text-base-content/65 max-lg:ml-0 max-lg:w-full max-lg:basis-full max-lg:items-center max-lg:justify-center",
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
        "max-lg:w-full max-lg:justify-center",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
