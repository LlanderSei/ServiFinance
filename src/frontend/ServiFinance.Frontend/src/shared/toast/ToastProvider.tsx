import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type ToastTone = "success" | "warning" | "error" | "info";

type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastRecord = ToastInput & {
  id: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  success: (input: Omit<ToastInput, "tone">) => void;
  warning: (input: Omit<ToastInput, "tone">) => void;
  error: (input: Omit<ToastInput, "tone">) => void;
  info: (input: Omit<ToastInput, "tone">) => void;
  dismissToast: (id: string) => void;
};

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 4200;

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-400/45 bg-emerald-950/92 text-emerald-50",
  warning: "border-amber-300/50 bg-amber-950/92 text-amber-50",
  error: "border-rose-400/45 bg-rose-950/92 text-rose-50",
  info: "border-sky-400/45 bg-sky-950/92 text-sky-50"
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    counterRef.current += 1;

    const toast: ToastRecord = {
      id: `toast-${counterRef.current}`,
      tone: input.tone ?? "info",
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      title: input.title,
      message: input.message
    };

    setToasts((current) => [...current, toast].slice(-MAX_TOASTS));
  }, []);

  const contextValue = useMemo<ToastContextValue>(() => ({
    showToast,
    dismissToast,
    success: (input) => showToast({ ...input, tone: "success" }),
    warning: (input) => showToast({ ...input, tone: "warning" }),
    error: (input) => showToast({ ...input, tone: "error" }),
    info: (input) => showToast({ ...input, tone: "info" })
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div
        className="pointer-events-none fixed right-4 top-4 z-[120] grid w-[min(24rem,calc(100vw-2rem))] gap-3"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}

function ToastItem({
  toast,
  onClose
}: {
  toast: ToastRecord;
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onClose(toast.id);
    }, toast.durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onClose, toast.durationMs, toast.id]);

  return (
    <div
      className={[
        "pointer-events-auto rounded-box border shadow-2xl backdrop-blur-md",
        toneClasses[toast.tone]
      ].join(" ")}
      role="status"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {toast.title ? (
            <p className="mb-1 text-sm font-semibold leading-tight">{toast.title}</p>
          ) : null}
          <p className="text-sm leading-5 text-current/90">{toast.message}</p>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle shrink-0 border-0 text-current hover:bg-white/10"
          aria-label="Close toast"
          onClick={() => onClose(toast.id)}
        >
          x
        </button>
      </div>
    </div>
  );
}
