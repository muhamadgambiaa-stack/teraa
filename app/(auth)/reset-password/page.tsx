"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthPageShell } from "@/components/AuthPageShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (
      password.length < 10 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setMessage(
        "Password must contain at least 10 characters, including uppercase, lowercase, a number and a symbol.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    setLoading(true);
    // Supabase establishes a temporary session from the reset link's token,
    // updateUser works against that session without needing the old password.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <AuthPageShell>
        <h1
          className="font-display text-2xl mb-6 text-center"
          style={{ color: "var(--indigo)" }}
        >
          Set a new password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">
              New password
            </label>
            <input
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
            <p className="mt-1 text-xs text-gray-500">
              At least 10 characters with uppercase, lowercase, a number and a
              symbol.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
    </AuthPageShell>
  );
}
