import type { ReactNode } from "react";

type BottomCenterToastProps = {
  open: boolean;
  children: ReactNode;
};

export function BottomCenterToast({ open, children }: BottomCenterToastProps) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-[280] -translate-x-1/2 rounded-full bg-neutral px-4 py-2 text-sm font-semibold text-neutral-content shadow-2xl ring-1 ring-white/15 transition-all duration-200 ease-out lg:hidden ${
        open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}
