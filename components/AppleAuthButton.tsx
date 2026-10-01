"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AppleAuthButton() {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Enable only after configuring the Apple provider and callback URLs.
  if (process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED !== "true") return null;

  async function continueWithApple() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: `${window.location.origin}/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue with Apple.");
      busy.current = false;
      setLoading(false);
    }
  }

  return <div className="mt-3">
    <button type="button" disabled={loading} onClick={continueWithApple} className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white disabled:opacity-50">
      {loading ? "Connecting..." : "Continue with Apple"}
    </button>
    {message && <p role="alert" className="mt-2 text-sm text-red-700">{message}</p>}
  </div>;
}
