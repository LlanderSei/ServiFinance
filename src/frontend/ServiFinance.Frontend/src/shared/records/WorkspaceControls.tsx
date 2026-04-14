import type {
  ButtonHTMLAttributes,
  FormEventHandler,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from "react";
import { Link, type LinkProps } from "react-router-dom";

type WorkspaceFormProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

type WorkspaceFieldGridProps = {
  children: ReactNode;
};

type WorkspaceFieldProps = {
  label: string;
  children: ReactNode;
  wide?: boolean;
};

type WorkspaceInputProps = InputHTMLAttributes<HTMLInputElement>;
type WorkspaceSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

type WorkspaceModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "primary" | "danger";
};

type WorkspaceActionLinkProps = LinkProps;
type WorkspaceActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

type WorkspaceStatusPillProps = {
  children: ReactNode;
  tone?: "active" | "inactive" | "warning" | "progress" | "neutral";
};

type WorkspaceFilterProps = {
  label: string;
  children: ReactNode;
};

type WorkspaceToggleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

type WorkspaceToggleGroupProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceInlineNoteProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceNoticeProps = {
  children: ReactNode;
  className?: string;
  tone?: "info" | "error";
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkspaceForm({ children, className, ...props }: WorkspaceFormProps) {
  return (
    <form className={joinClasses("grid gap-4", className)} {...props}>
      {children}
    </form>
  );
}

export function WorkspaceFieldGrid({ children }: WorkspaceFieldGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
      {children}
    </div>
  );
}

export function WorkspaceField({ label, children, wide = false }: WorkspaceFieldProps) {
  return (
    <label className={joinClasses("grid gap-1.5", wide && "md:col-span-2")}>
      <span className="text-[0.8rem] font-bold uppercase tracking-[0.04em] text-base-content/60">{label}</span>
      {children}
    </label>
  );
}

export function WorkspaceInput(props: WorkspaceInputProps) {
  return (
    <input
      className="input input-bordered w-full border-base-300/70 bg-base-100 text-base-content shadow-none"
      {...props}
    />
  );
}

export function WorkspaceSelect(props: WorkspaceSelectProps) {
  return (
    <select
      className="select select-bordered w-full border-base-300/70 bg-base-100 text-base-content shadow-none"
      {...props}
    />
  );
}

export function WorkspaceModalButton({
  className,
  tone = "default",
  type = "button",
  ...props
}: WorkspaceModalButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "btn rounded-full shadow-none disabled:cursor-not-allowed disabled:opacity-65",
        tone === "default" && "btn-ghost border border-base-300/70 text-base-content",
        tone === "primary" && "btn-primary text-primary-content",
        tone === "danger" && "btn-error btn-soft",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceActionLink({ className, ...props }: WorkspaceActionLinkProps) {
  return (
    <Link
      className={joinClasses(
        "btn btn-sm rounded-full border border-base-300/70 bg-base-100/80 text-base-content shadow-none hover:bg-base-200/80",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceActionButton({ className, type = "button", ...props }: WorkspaceActionButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "btn btn-sm rounded-full border border-base-300/70 bg-base-100/80 text-base-content shadow-none hover:bg-base-200/80",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceStatusPill({ children, tone = "neutral" }: WorkspaceStatusPillProps) {
  return (
    <span
      className={joinClasses(
        "badge border-0 px-3 py-3 font-semibold whitespace-nowrap",
        tone === "active" && "badge-success badge-soft text-success",
        tone === "inactive" && "badge-error badge-soft text-error",
        tone === "warning" && "badge-warning badge-soft text-warning-content",
        tone === "progress" && "badge-info badge-soft text-info-content",
        tone === "neutral" && "badge-ghost text-base-content/70"
      )}
    >
      {children}
    </span>
  );
}

export function WorkspaceFilter({ label, children }: WorkspaceFilterProps) {
  return (
    <label className="grid min-w-44 gap-1.5">
      <span className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-base-content/60">{label}</span>
      {children}
    </label>
  );
}

export function WorkspaceToggleButton({
  className,
  active = false,
  type = "button",
  ...props
}: WorkspaceToggleButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "btn btn-sm rounded-full shadow-none",
        active
          ? "btn-primary text-primary-content"
          : "btn-ghost border border-base-300/70 text-base-content/75",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceToggleGroup({ children, className }: WorkspaceToggleGroupProps) {
  return (
    <div
      className={joinClasses(
        "inline-flex items-center gap-1 rounded-full border border-base-300/70 bg-base-100/80 p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceInlineNote({ children, className }: WorkspaceInlineNoteProps) {
  return <span className={joinClasses("text-sm text-base-content/65", className)}>{children}</span>;
}

export function WorkspaceNotice({
  children,
  className,
  tone = "info"
}: WorkspaceNoticeProps) {
  return (
    <div
      className={joinClasses(
        "alert rounded-box border shadow-none",
        tone === "info"
          ? "border-info/20 bg-info/10 text-info-content"
          : "border-error/20 bg-error/10 text-error",
        className
      )}
    >
      <span>{children}</span>
    </div>
  );
}
