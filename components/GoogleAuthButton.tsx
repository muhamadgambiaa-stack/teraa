"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function GoogleAuthButton() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function continueWithGoogle() {
    setLoading(true);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not continue with Google.",
      );

      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="w-full rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          borderColor: "var(--sand)",
          background: "white",
          color: "var(--ink)",
        }}
      >
        {loading ? "Connecting to Google..." : "Continue with Google"}
      </button>

      {message && (
        <p className="mt-2 text-center text-xs text-red-600">{message}</p>
      )}
    </div>
  );
}
