"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function SignupPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  async function createDatabaseRecords(userId: string) {
    /*
     * Check whether the main user profile
     * already exists.
     */
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

        role: "buyer",
      });

      if (profileError) {
        throw new Error(profileError.message);
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

    if (!acceptedTerms) {
      setMessage(
        "Please agree to the Terms of Service and Privacy Policy to create your account.",
      );

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

          /*
           * Keep signup information in
           * Supabase Auth until the email
           * confirmation callback finishes.
           */
          data: {
            full_name: cleanName,

            phone_number: cleanPhone,

            city: cleanCity,

            /*
             * Only buyer/seller can come
             * from public signup.
             *
             * Never accept admin from
             * this form.
             */
            role: "buyer",

            /*
             * Keep a simple record in Auth
             * metadata that the user agreed
             * during signup.
             *
             * A dedicated database record
             * can be added later if you
             * want versioned legal consent.
             */
            accepted_terms: true,

            terms_version: "2026-08-27",
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
       *    Account exists, but there is no
       *    session until the user clicks the
       *    email confirmation link.
       */
      if (data.session) {
        await createDatabaseRecords(data.user.id);

        router.replace("/");

        router.refresh();

        return;
      }

      /*
       * No session means email confirmation
       * is required.
       */
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
      style={{
        background: "var(--paper)",
      }}
    >
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center mb-3 text-sm"
          style={{
            color: "var(--indigo)",
          }}
        >
          Teraa
        </Link>

        <h1
          className="font-display text-3xl mb-2 text-center"
          style={{
            color: "var(--ink)",
          }}
        >
          Create your account
        </h1>

        <p className="text-sm text-gray-500 text-center mb-8">
          Join Teraa to buy and sell across The Gambia.
        </p>

        <GoogleAuthButton />

        <div className="flex items-center gap-3 my-5">
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
          <span className="text-xs text-gray-400">or continue with email</span>
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* FULL NAME */}

          <div>
            <label className="text-sm font-medium block mb-1">Full name</label>

            <input
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* EMAIL */}

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
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* PASSWORD */}

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
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
          </div>

          {/* CONFIRM PASSWORD */}

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
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* PHONE */}

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
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              Used for delivery coordination.
            </p>
          </div>

          {/* CITY */}

          <div>
            <label className="text-sm font-medium block mb-1">City</label>

            <input
              required
              autoComplete="address-level2"
              placeholder="Serrekunda, Banjul, Brikama..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* TERMS CONSENT */}

          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: acceptedTerms ? "var(--indigo)" : "var(--sand)",

              background: "#fbfaf7",
            }}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span className="text-xs text-gray-600 leading-5">
                I agree to Teraa&apos;s{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{
                    color: "var(--indigo)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{
                    color: "var(--indigo)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <p className="text-[11px] text-gray-500 mt-2 ml-7 leading-4">
              By using Teraa, you also agree to follow our{" "}
              <Link
                href="/marketplace-rules"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{
                  color: "var(--indigo)",
                }}
              >
                Marketplace Rules
              </Link>
              .
            </p>
          </div>

          {/* ERROR */}

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

          {/* SUBMIT */}

          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full rounded-lg py-3 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--indigo)",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* LOGIN */}

        <p className="text-sm text-center mt-6 text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline"
            style={{
              color: "var(--indigo)",
            }}
          >
            Log in
          </Link>
        </p>

        {/* POLICY LINKS */}

        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-6 text-[11px] text-gray-400">
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>

          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>

          <Link href="/marketplace-rules" className="hover:underline">
            Marketplace Rules
          </Link>

          <Link href="/safety" className="hover:underline">
            Safety
          </Link>
        </div>
      </div>
    </main>
  );
}

