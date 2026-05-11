import { useEffect, useRef, useState } from "react";
import type { CaptchaChallenge } from "./useCaptchaChallenge";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

type CaptchaFieldProps = {
  answer: string;
  challenge: CaptchaChallenge | null;
  disabled?: boolean;
  error?: string | null;
  isLoading?: boolean;
  onAnswerChange: (value: string) => void;
  onRefresh: () => void;
};

export function CaptchaField({
  answer,
  challenge,
  disabled = false,
  error,
  isLoading = false,
  onAnswerChange,
  onRefresh
}: CaptchaFieldProps) {
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const isTurnstile = challenge?.provider === "turnstile" && Boolean(challenge.siteKey);

  useEffect(() => {
    if (!isTurnstile) {
      return;
    }

    let isMounted = true;
    setTurnstileReady(false);
    void loadTurnstileScript()
      .then(() => {
        if (!isMounted || !turnstileContainerRef.current || !window.turnstile || !challenge?.siteKey) {
          return;
        }

        if (turnstileWidgetRef.current) {
          window.turnstile.remove(turnstileWidgetRef.current);
        }

        turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: challenge.siteKey,
          callback: (token) => onAnswerChange(token),
          "expired-callback": () => onAnswerChange(""),
          "error-callback": () => onAnswerChange("")
        });
        setTurnstileReady(true);
      })
      .catch(() => {
        if (isMounted) {
          setTurnstileReady(false);
        }
      });

    return () => {
      isMounted = false;
      if (turnstileWidgetRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetRef.current);
        turnstileWidgetRef.current = null;
      }
    };
  }, [challenge?.challengeId, challenge?.siteKey, isTurnstile, onAnswerChange]);

  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">
          {challenge?.prompt ?? (isLoading ? "Loading CAPTCHA..." : "CAPTCHA unavailable")}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs rounded-full text-slate-600"
          disabled={disabled || isLoading}
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
      {isTurnstile ? (
        <div className="grid gap-2">
          <div ref={turnstileContainerRef} className={disabled ? "pointer-events-none opacity-60" : undefined} />
          <span className="text-xs text-slate-500">
            {answer
              ? "Human verification completed."
              : turnstileReady
                ? "Complete the Cloudflare Turnstile check before submitting."
                : "Loading Cloudflare Turnstile..."}
          </span>
        </div>
      ) : (
        <input
          className="input input-bordered input-sm w-full rounded-xl border-slate-200 bg-white text-slate-950"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="Answer"
          disabled={disabled || !challenge}
          inputMode="numeric"
          required
        />
      )}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}

function loadTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-servifinance-turnstile]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Turnstile script failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.servifinanceTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load."));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}
