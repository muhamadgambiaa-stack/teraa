"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"details" | "otp">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [otp, setOtp] = useState("");
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

  async function verifyAndCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error || !data.user) {
      setLoading(false);
      setMessage(error?.message ?? "Verification failed.");
      return;
    }

    // Create the profile row. RLS policy "users_insert_own" only allows
    // a user to insert their own row, matched by auth.uid(). Phone is
    // still collected here, it's used for delivery coordination and
    // delivery contact, just not for authentication anymore.
    const { error: profileError } = await supabase.from("users").insert({
      id: data.user.id,
      phone_number: phone,
      full_name: fullName,
      city,
      role,
    });

    if (profileError) {
      setLoading(false);
      setMessage(profileError.message);
      return;
    }

    if (role === "seller") {
      // Sellers start unverified, they'll complete ID upload next.
      await supabase.from("sellers").insert({
        id: data.user.id,
        business_name: fullName,
      });
      router.push("/seller/dashboard");
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-6 text-center" style={{ color: "var(--indigo)" }}>
          Create your account
        </h1>

        {step === "details" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>
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
              <p className="text-xs text-gray-500 mt-1">We&apos;ll send a verification code here.</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Phone number</label>
              <input
                type="tel"
                required
                placeholder="+220 7XX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
              <p className="text-xs text-gray-500 mt-1">Used for delivery contact and payment coordination.</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">City</label>
              <input
                required
                placeholder="Serrekunda, Banjul, Brikama…"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">I want to</label>
              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className="flex-1 rounded-lg border py-2 text-sm capitalize"
                    style={{
                      borderColor: role === r ? "var(--indigo)" : "var(--sand)",
                      background: role === r ? "var(--indigo)" : "transparent",
                      color: role === r ? "white" : "var(--ink)",
                    }}
                  >
                    {r === "buyer" ? "Buy products" : "Sell products"}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {loading ? "Sending…" : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyAndCreateProfile} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Enter the 6-digit code</label>
              <input
                required
                inputMode="numeric"
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
              {loading ? "Creating account…" : "Verify & create account"}
            </button>
          </form>
        )}

        {message && <p className="text-sm text-center mt-4 text-gray-600">{message}</p>}

        {role === "seller" && step === "details" && (
          <p className="text-xs text-gray-500 text-center mt-4">
            Sellers submit ID verification after signup. Listings go live once approved.
          </p>
        )}
      </div>
    </main>
  );
}
