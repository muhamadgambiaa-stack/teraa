"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-sm">
        <h1
          className="font-display text-2xl mb-2 text-center"
          style={{ color: "var(--indigo)" }}
        >
          Reset your password
        </h1>

        {sent ? (
          <p className="text-sm text-center text-gray-600 mt-6">
            If an account exists for that email, a reset link is on its way.
            Check your inbox.
          </p>
        ) : (
          <>
            <p className="text-sm text-center text-gray-500 mb-6">
              Enter your email and we&apos;ll send you a link to set a new
              password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "var(--sand)" }}
                />
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--indigo)" }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="text-sm text-center mt-6 text-gray-500">
          <Link
            href="/login"
            className="underline"
            style={{ color: "var(--indigo)" }}
          >
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
