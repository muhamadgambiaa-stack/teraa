"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setStep("otp");
      setMessage("Code sent, check your email.");
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-6 text-center" style={{ color: "var(--indigo)" }}>
          Log in
        </h1>

        {step === "email" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Email address</label>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Enter the 6-digit code</label>
              <input
                type="text"
                required
                inputMode="numeric"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 tracking-widest"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {loading ? "Verifying…" : "Verify & log in"}
            </button>
          </form>
        )}

        {message && <p className="text-sm text-center mt-4 text-gray-600">{message}</p>}
      </div>
    </main>
  );
}
