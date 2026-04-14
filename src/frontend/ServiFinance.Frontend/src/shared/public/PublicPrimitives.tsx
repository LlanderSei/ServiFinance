import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type PublicShellProps = {
  children: ReactNode;
};

type PublicContainerProps = {
  children: ReactNode;
  className?: string;
};

type PublicSectionHeadingProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

type PublicCardProps = {
  children: ReactNode;
  className?: string;
};

type PublicActionRowProps = {
  children: ReactNode;
  className?: string;
};

type PublicBadgeProps = {
  children: ReactNode;
  className?: string;
};

type PublicButtonLinkProps = LinkProps & {
  tone?: "primary" | "ghost";
  size?: "default" | "small";
};

type PublicButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost";
  size?: "default" | "small";
};

type PublicListProps = HTMLAttributes<HTMLOListElement> & {
  children: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getButtonClasses(tone: "primary" | "ghost", size: "default" | "small") {
  return joinClasses(
    "btn rounded-full border shadow-sm",
    size === "small" ? "btn-sm" : "",
    tone === "primary"
      ? "btn-primary border-primary text-primary-content"
      : "border-base-300/70 bg-base-100/90 text-base-content hover:bg-base-100"
  );
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div
      className="relative min-h-screen overflow-clip bg-[radial-gradient(circle_at_14%_18%,rgba(120,196,255,0.35),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(213,201,255,0.42),transparent_24%),radial-gradient(circle_at_64%_62%,rgba(194,239,233,0.44),transparent_24%),linear-gradient(135deg,#f9fbff_0%,#eef3fb_45%,#f7f8fc_100%)]"
    >
      <div className="pointer-events-none absolute right-[5vw] top-20 -z-0 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(189,212,255,0.2)_0%,transparent_68%)] opacity-75" />
      {children}
    </div>
  );
}

export function PublicContainer({ children, className }: PublicContainerProps) {
  return <div className={joinClasses("mx-auto w-full max-w-[1260px] px-7", className)}>{children}</div>;
}

export function PublicSectionHeading({
  eyebrow,
  title,
  description,
  className
}: PublicSectionHeadingProps) {
  return (
    <div className={joinClasses("max-w-[52rem]", className)}>
      <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
      <h1 className="mt-2 font-['Iowan_Old_Style','Book_Antiqua',Georgia,serif] text-[clamp(2.8rem,5vw,4.8rem)] leading-[0.96] tracking-[-0.055em] text-slate-950">
        {title}
      </h1>
      {description ? <p className="mt-4 max-w-[36rem] text-[1.08rem] leading-[1.75] text-slate-500">{description}</p> : null}
    </div>
  );
}

export function PublicCard({ children, className }: PublicCardProps) {
  return (
    <article
      className={joinClasses(
        "relative overflow-hidden rounded-[1.9rem] border border-slate-300/40 bg-white/90 p-6 shadow-[0_14px_34px_rgba(40,49,84,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </article>
  );
}

export function PublicActionRow({ children, className }: PublicActionRowProps) {
  return <div className={joinClasses("mt-6 flex flex-wrap gap-3", className)}>{children}</div>;
}

export function PublicBadge({ children, className }: PublicBadgeProps) {
  return (
    <span
      className={joinClasses(
        "inline-flex rounded-full bg-primary/10 px-3 py-1 text-[0.78rem] font-bold tracking-[0.02em] text-primary",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PublicButtonLink({
  tone = "ghost",
  size = "default",
  className,
  ...props
}: PublicButtonLinkProps) {
  return <Link className={joinClasses(getButtonClasses(tone, size), className)} {...props} />;
}

export function PublicButton({
  tone = "ghost",
  size = "default",
  className,
  type = "button",
  ...props
}: PublicButtonProps) {
  return (
    <button type={type} className={joinClasses(getButtonClasses(tone, size), className)} {...props} />
  );
}

export function PublicWorkflowList({ children, className, ...props }: PublicListProps) {
  return (
    <ol className={joinClasses("grid gap-4", className)} {...props}>
      {children}
    </ol>
  );
}
