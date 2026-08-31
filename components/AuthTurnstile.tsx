"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

type AuthTurnstileProps = {
  onTokenChange: (token: string | null) => void;
  resetKey: number;
};

export function isTurnstileConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export default function AuthTurnstile({
  onTokenChange,
  resetKey,
}: AuthTurnstileProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [failed, setFailed] = useState(false);

  // This keeps existing authentication available while the site key is being
  // added to Vercel. Supabase CAPTCHA must only be enabled after that deploy.
  if (!siteKey) {
    return null;
  }

  return (
    <div>
      <div className="flex justify-center overflow-hidden">
      <Turnstile
        key={resetKey}
        siteKey={siteKey}
        options={{
          appearance: "always",
          size: "flexible",
          theme: "light",
        }}
        onSuccess={(token) => {
          setFailed(false);
          onTokenChange(token);
        }}
        onExpire={() => onTokenChange(null)}
        onError={() => {
          setFailed(true);
          onTokenChange(null);
        }}
        onTimeout={() => onTokenChange(null)}
      />
      </div>
      {failed && (
        <p className="mt-2 text-center text-xs text-red-600">
          The security check could not load. Refresh the page and try again.
        </p>
      )}
    </div>
  );
}
