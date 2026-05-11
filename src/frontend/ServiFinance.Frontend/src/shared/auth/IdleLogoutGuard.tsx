import { useEffect, useRef, useState } from "react";

const idleWarningDelayMs = 5 * 60 * 1000;
const warningLogoutDelayMs = 5 * 60 * 1000;
const activityEvents = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "wheel"
] as const;

type IdleLogoutGuardProps = {
  workspaceLabel: string;
  onLogout: () => Promise<void>;
};

type IdlePhase = "active" | "warning" | "logging-out";

export function IdleLogoutGuard({ workspaceLabel, onLogout }: IdleLogoutGuardProps) {
  const [phase, setPhase] = useState<IdlePhase>("active");
  const [secondsRemaining, setSecondsRemaining] = useState(warningLogoutDelayMs / 1000);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const warningDeadlineRef = useRef<number>(0);
  const phaseRef = useRef<IdlePhase>("active");
  const logoutRef = useRef(onLogout);
  const activityHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    logoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    function clearTimer(timerId: number | null) {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    }

    async function logoutForIdleTimeout() {
      if (phaseRef.current === "logging-out") {
        return;
      }

      phaseRef.current = "logging-out";
      setPhase("logging-out");
      await logoutRef.current();
    }

    function showWarning() {
      warningDeadlineRef.current = Date.now() + warningLogoutDelayMs;
      phaseRef.current = "warning";
      setPhase("warning");
      setSecondsRemaining(Math.ceil(warningLogoutDelayMs / 1000));
      clearTimer(logoutTimerRef.current);
      logoutTimerRef.current = window.setTimeout(() => {
        void logoutForIdleTimeout();
      }, warningLogoutDelayMs);
    }

    function scheduleWarning() {
      clearTimer(warningTimerRef.current);
      clearTimer(logoutTimerRef.current);
      warningTimerRef.current = window.setTimeout(showWarning, idleWarningDelayMs);
    }

    function handleActivity() {
      if (phaseRef.current === "logging-out") {
        return;
      }

      phaseRef.current = "active";
      setPhase("active");
      scheduleWarning();
    }

    activityHandlerRef.current = handleActivity;
    scheduleWarning();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      clearTimer(warningTimerRef.current);
      clearTimer(logoutTimerRef.current);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      activityHandlerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== "warning") {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    countdownTimerRef.current = window.setInterval(() => {
      const remainingMs = Math.max(warningDeadlineRef.current - Date.now(), 0);
      setSecondsRemaining(Math.ceil(remainingMs / 1000));
    }, 1000);

    return () => {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [phase]);

  if (phase !== "warning" && phase !== "logging-out") {
    return null;
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[1.75rem] border border-base-300/70 bg-base-100 p-5 text-base-content shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-base-content/55">
          Session idle warning
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-base-content">
          Still using {workspaceLabel}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-base-content/68">
          No activity has been detected for 5 minutes. Move, type, scroll, or choose stay signed in to keep this session active.
        </p>
        <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning-content">
          {phase === "logging-out"
            ? "Signing out now..."
            : `Automatic logout in ${timeLabel}.`}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn rounded-full border-none bg-primary text-primary-content hover:bg-primary/90"
            disabled={phase === "logging-out"}
            onClick={() => activityHandlerRef.current?.()}
          >
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
