"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SignupRole = "buyer" | "seller";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<SignupRole>("buyer");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createDatabaseRecords(
    userId: string,
    selectedRole: SignupRole,
  ) {
    // Check whether the main user profile already exists.
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileLookupError) {
      throw new Error(profileLookupError.message);
    }

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("users").insert({
        id: userId,
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        city: city.trim(),
        role: selectedRole,
      });

      if (profileError) {
        throw new Error(profileError.message);
      }
    }

    // Sellers need an additional row in the sellers table.
    if (selectedRole === "seller") {
      const { data: existingSeller, error: sellerLookupError } = await supabase
        .from("sellers")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (sellerLookupError) {
        throw new Error(sellerLookupError.message);
      }

      if (!existingSeller) {
        const { error: sellerError } = await supabase.from("sellers").insert({
          id: userId,
          business_name: fullName.trim(),
        });

        if (sellerError) {
          throw new Error(sellerError.message);
        }
      }
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim();

    if (!cleanName) {
      setMessage("Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    if (!cleanPhone) {
      setMessage("Please enter your phone number.");
      return;
    }

    if (!cleanCity) {
      setMessage("Please enter your city.");
      return;
    }

    setLoading(true);

    try {
      const callbackUrl = `${window.location.origin}/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: callbackUrl,

          // Keep signup information in Supabase Auth until
          // the email confirmation callback finishes.
          data: {
            full_name: cleanName,
            phone_number: cleanPhone,
            city: cleanCity,

            // Only buyer/seller can come from public signup.
            // Never accept "admin" from this form.
            role,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("Supabase did not return a user account.");
      }

      /*
       * Supabase has two possible behaviours:
       *
       * 1. Email confirmation disabled:
       *    data.session exists immediately.
       *
       * 2. Email confirmation enabled:
       *    Account exists, but there is no session until the
       *    user clicks the email confirmation link.
       */

      if (data.session) {
        await createDatabaseRecords(data.user.id, role);

        if (role === "seller") {
          router.replace("/seller/dashboard");
        } else {
          router.replace("/");
        }

        router.refresh();
        return;
      }

      // No session = email confirmation is required.
      router.replace(`/check-email?email=${encodeURIComponent(cleanEmail)}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Couldn't create your account.";

      setMessage(errorMessage);
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-sm">
        <h1
          className="font-display text-3xl mb-8 text-center"
          style={{ color: "var(--indigo)" }}
        >
          Create your account
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Full name</label>

            <input
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
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
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Password</label>

            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
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
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
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
              autoComplete="tel"
              placeholder="+220 7XX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
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
              autoComplete="address-level2"
              placeholder="Serrekunda, Banjul, Brikama…"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">I want to</label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("buyer")}
                className="rounded-lg border py-3 text-sm font-medium"
                style={{
                  borderColor:
                    role === "buyer" ? "var(--indigo)" : "var(--sand)",
                  background:
                    role === "buyer" ? "var(--indigo)" : "transparent",
                  color: role === "buyer" ? "white" : "var(--ink)",
                }}
              >
                Buy Products
              </button>

              <button
                type="button"
                onClick={() => setRole("seller")}
                className="rounded-lg border py-3 text-sm font-medium"
                style={{
                  borderColor:
                    role === "seller" ? "var(--indigo)" : "var(--sand)",
                  background:
                    role === "seller" ? "var(--indigo)" : "transparent",
                  color: role === "seller" ? "white" : "var(--ink)",
                }}
              >
                Sell Products
              </button>
            </div>
          </div>

          {role === "seller" && (
            <p className="text-xs text-gray-500">
              Sellers complete identity verification after creating an account.
              You can publish listings after your verification is approved.
            </p>
          )}

          {message && (
            <div
              className="rounded-lg border px-3 py-3 text-sm text-red-700"
              style={{
                borderColor: "#efb4b4",
                background: "#fff5f5",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3 text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

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
