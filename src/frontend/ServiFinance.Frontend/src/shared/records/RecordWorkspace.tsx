import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CSSProperties } from "react";
import { formatRecordCount } from "./recordCount";

type RecordWorkspaceProps = {
  breadcrumbs: string;
  title: string;
  description: string;
  recordCount?: number;
  singularLabel?: string;
  pluralLabel?: string;
  headerRight?: ReactNode;
  headerBottom?: ReactNode;
  children: ReactNode;
};

type RecordContentStackProps = {
  children: ReactNode;
  className?: string;
};

type RecordScrollRegionProps = {
  children: ReactNode;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const brandedHeaderStyle = {
  background: "var(--tenant-header-bg, var(--color-base-100))",
  color: "var(--tenant-header-fg, var(--color-base-content))"
} satisfies CSSProperties;

const brandedHeaderTextStyle = {
  color: "var(--tenant-header-fg, var(--color-base-content))"
} satisfies CSSProperties;

const brandedHeaderMutedStyle = {
  color: "var(--tenant-header-muted, color-mix(in srgb, var(--color-base-content) 68%, transparent))"
} satisfies CSSProperties;

const brandedHeaderBadgeStyle = {
  borderColor: "color-mix(in srgb, var(--tenant-header-fg, var(--color-info)) 26%, transparent)",
  background: "color-mix(in srgb, var(--tenant-header-fg, var(--color-info)) 12%, transparent)",
  color: "var(--tenant-header-fg, var(--color-info))"
} satisfies CSSProperties;

export function RecordWorkspace({
  breadcrumbs,
  title,
  description,
  recordCount,
  singularLabel,
  pluralLabel,
  headerRight,
  headerBottom,
  children
}: RecordWorkspaceProps) {
  const hasCountBadge = typeof recordCount === "number" && singularLabel;
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const scrollRegion = workspace?.querySelector<HTMLElement>("[data-record-scroll-region='true']");
    if (!scrollRegion) {
      setIsMobileHeaderHidden(false);
      return;
    }

    let previousScrollTop = scrollRegion.scrollTop;
    const handleScroll = () => {
      const nextScrollTop = scrollRegion.scrollTop;
      const isScrollable = scrollRegion.scrollHeight - scrollRegion.clientHeight > 24;
      if (!isScrollable || nextScrollTop < 24) {
        setIsMobileHeaderHidden(false);
        previousScrollTop = nextScrollTop;
        return;
      }

      if (Math.abs(nextScrollTop - previousScrollTop) < 10) {
        return;
      }

      setIsMobileHeaderHidden(nextScrollTop > previousScrollTop);
      previousScrollTop = nextScrollTop;
    };

    scrollRegion.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollRegion.removeEventListener("scroll", handleScroll);
    };
  }, [children]);

  function openMobileSidebar() {
    window.dispatchEvent(new CustomEvent("servifinance:toggle-sidebar"));
  }

  return (
    <main
      ref={workspaceRef}
      className="authed-workspace mx-auto h-full min-h-0 max-w-none overflow-hidden bg-base-100 text-base-content"
      style={{ background: "var(--tenant-page-bg)" }}
    >
      <section
        className={joinClasses(
          "grid h-full min-h-0 gap-0 bg-transparent transition-[grid-template-rows] duration-200 lg:grid-rows-[auto_minmax(0,1fr)]",
          isMobileHeaderHidden ? "grid-rows-[0_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]"
        )}
      >
        <header
          className={joinClasses(
            "relative z-30 flex shrink-0 flex-col justify-center border-b border-base-300/70 bg-base-100 px-4 transition-[height,padding] duration-200 lg:h-auto lg:justify-start lg:px-6 lg:pt-5 lg:pb-0",
            isMobileHeaderHidden ? "h-0 overflow-hidden border-b-0 py-0" : "h-[5rem] py-3"
          )}
          style={brandedHeaderStyle}
        >
          {/* Upper row: breadcrumbs + title row + count badge + description */}
          <div className={joinClasses("grid gap-0.5", isMobileHeaderHidden && "hidden lg:grid")}>
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="btn btn-circle btn-sm shrink-0 border-base-300/70 bg-base-100 text-base-content shadow-none lg:hidden"
                onClick={openMobileSidebar}
                aria-label="Open workspace navigation"
              >
                <span className="grid gap-1" aria-hidden>
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                </span>
              </button>

              <div className={joinClasses("min-w-0", hasCountBadge && "pr-28 lg:pr-0")}>
                <p className="m-0 truncate text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-base-content/60 lg:text-[0.74rem]" style={brandedHeaderMutedStyle}>{breadcrumbs}</p>
                <h1 className="m-0 truncate text-[1.05rem] font-bold tracking-[-0.035em] text-base-content lg:hidden" style={brandedHeaderTextStyle}>{title}</h1>
              </div>
            </div>

            <div className="hidden flex-col items-start justify-between gap-3 lg:flex lg:flex-row lg:items-start">
              <h1 className="m-0 text-[clamp(1.7rem,2.6vw,2.3rem)] font-bold tracking-[-0.04em] text-base-content" style={brandedHeaderTextStyle}>{title}</h1>

              {hasCountBadge ? (
                <span className="inline-flex items-center rounded-full border border-info/26 bg-info/12 px-3 py-1.5 text-[0.82rem] font-extrabold whitespace-nowrap text-info" style={brandedHeaderBadgeStyle}>
                  {formatRecordCount(recordCount, singularLabel, pluralLabel)}
                </span>
              ) : null}
            </div>

            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 lg:hidden">
              {hasCountBadge ? (
                <span className="inline-flex items-center rounded-full border border-info/26 bg-info/12 px-3 py-1.5 text-[0.72rem] font-extrabold whitespace-nowrap text-info" style={brandedHeaderBadgeStyle}>
                  {formatRecordCount(recordCount, singularLabel, pluralLabel)}
                </span>
              ) : null}
            </div>

            <p className="m-0 hidden pb-2 text-[0.94rem] text-base-content/70 lg:block" style={brandedHeaderMutedStyle}>{description}</p>
          </div>

          {/* Lower row: tabs + extra controls */}
          {headerBottom && (
            <div className="min-w-0">
              {headerBottom}
            </div>
          )}

          {/* Optional right-aligned content (upper row right side) */}
          {headerRight && (
            <div className={joinClasses("shrink-0", isMobileHeaderHidden && "hidden lg:block")}>
              {headerRight}
            </div>
          )}
        </header>

        <section className="min-h-0 overflow-hidden p-0">
          <div className="authed-workspace__surface flex h-full min-h-0 flex-col border border-base-300/65 bg-base-100 p-3 shadow-sm lg:p-4">
            {children}
          </div>
        </section>
      </section>
    </main>
  );
}

export function RecordContentStack({ children, className }: RecordContentStackProps) {
  return (
    <div
      className={joinClasses("authed-workspace__content-stack relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pb-1 [scroll-padding-bottom:0.25rem] lg:overflow-visible lg:pb-0", className)}
      data-record-scroll-region="true"
    >
      {children}
    </div>
  );
}

export function RecordScrollRegion({ children, className }: RecordScrollRegionProps) {
  return (
    <div
      className={joinClasses(
        "authed-workspace__scroll-region min-h-0 flex-1 overflow-auto overscroll-contain pb-1 [scroll-padding-bottom:0.25rem] [contain:layout_paint] lg:pb-4 lg:[scroll-padding-bottom:1rem]",
        className
      )}
      data-record-scroll-region="true"
    >
      {children}
    </div>
  );
}
