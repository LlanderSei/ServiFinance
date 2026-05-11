import { useEffect, useState } from "react";
import { isDesktopShell } from "@/platform/runtime";
import { resolveApiUrl } from "@/platform/runtime";

export type CaptchaChallenge = {
  challengeId: string;
  prompt: string;
  expiresAtUtc: string;
  provider: "turnstile" | "local" | string;
  siteKey: string | null;
};

export type CaptchaProof = {
  challengeId?: string | null;
  answer?: string | null;
  token?: string | null;
  provider?: string | null;
};

export function useCaptchaChallenge(isEnabled = true) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!isEnabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const captchaPath = isDesktopShell() ? "/api/auth/captcha?local=true" : "/api/auth/captcha";
      const response = await fetch(await resolveApiUrl(captchaPath), {
        credentials: isDesktopShell() ? "omit" : "include"
      });

      if (!response.ok) {
        setError("Unable to load the CAPTCHA challenge.");
        return;
      }

      setChallenge(await response.json() as CaptchaChallenge);
      setAnswer("");
    } catch {
      setError("Unable to load the CAPTCHA challenge.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isEnabled) {
      void refresh();
    }
  }, [isEnabled]);

  return {
    answer,
    challenge,
    error,
    isLoading,
    proof: challenge
      ? challenge.provider === "turnstile"
        ? { provider: challenge.provider, token: answer } satisfies CaptchaProof
        : { provider: challenge.provider, challengeId: challenge.challengeId, answer } satisfies CaptchaProof
      : null,
    refresh,
    setAnswer
  };
}
