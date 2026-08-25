"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      setLoading(false);
      setMessage(error?.message ?? "Couldn't create your account.");
      return;
    }

    // Create the profile row. RLS policy "users_insert_own" only allows a
    // user to insert their own row, matched by auth.uid(). Phone is
    // collected for delivery and payment coordination, it's not a login
    // credential, no verification needed for it.
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
    <main
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-sm">
        <h1
          className="font-display text-2xl mb-6 text-center"
          style={{ color: "var(--indigo)" }}
        >
          Create your account
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
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
          <div>
            <label className="text-sm font-medium block mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Phone number
            </label>
            <input
              type="tel"
              required
              placeholder="+220 7XX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used for delivery and payment coordination.
            </p>
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

          {message && <p className="text-sm text-red-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {role === "seller" && (
          <p className="text-xs text-gray-500 text-center mt-4">
            Sellers submit ID verification after signup. Listings go live once
            approved.
          </p>
        )}

        <p className="text-sm text-center mt-6 text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline"
            style={{ color: "var(--indigo)" }}
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
