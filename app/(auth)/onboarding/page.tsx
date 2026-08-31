"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { accountIdentityErrorMessage } from "@/lib/account-identity";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function prepareOnboarding() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/login");
        return;
      }

      const { data: existingProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.role === "seller") {
          router.replace("/seller/dashboard");
        } else {
          router.replace("/");
        }

        return;
      }

      const metadata = user.user_metadata ?? {};

      const googleName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : "";

      setFullName(googleName.trim());
      setChecking(false);
    }

    void prepareOnboarding();
  }, [router, supabase]);

  async function completeOnboarding(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setMessage("Please enter your full name.");
      return;
    }

    if (!cleanPhone) {
      setMessage("Please enter your phone number.");
      return;
    }

    if (!acceptedTerms) {
      setMessage(
        "Please agree to the Terms of Service and Privacy Policy.",
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session expired. Please log in again.");
      }

      /*
       * Re-check before inserting so refreshing or double submitting
       * onboarding cannot create duplicate profiles.
       */
      const { data: existingProfile, error: lookupError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existingProfile) {
        if (existingProfile.role === "seller") {
          router.replace("/seller/dashboard");
        } else {
          router.replace("/");
        }

        router.refresh();
        return;
      }

      /*
       * Keep useful onboarding information in Auth metadata as well.
       * Every public account starts as a normal Teraa account.
       */
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          phone_number: cleanPhone,
          role: "buyer",
          accepted_terms: true,
          terms_version: "2026-08-27",
        },
      });

      if (metadataError) {
        throw metadataError;
      }

      const { error: profileError } = await supabase.from("users").insert({
        id: user.id,
        full_name: cleanName,
        phone_number: cleanPhone,
        role: "buyer",
      });

      if (profileError) {
        throw profileError;
      }

      router.replace("/");

      router.refresh();
    } catch (error) {
      setMessage(accountIdentityErrorMessage(error));

      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "var(--paper)" }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--indigo)" }}
          />
          <p className="text-sm text-gray-500">Setting up Teraa...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center mb-3 text-sm"
          style={{ color: "var(--indigo)" }}
        >
          Teraa
        </Link>

        <h1
          className="font-display text-3xl mb-2 text-center"
          style={{ color: "var(--ink)" }}
        >
          Finish setting up your account
        </h1>

        <p className="text-sm text-gray-500 text-center mb-8">
          We just need a few details before you continue.
        </p>

        <form onSubmit={completeOnboarding} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">
              Full name
            </label>

            <input
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Phone number
            </label>

            <input
              required
              type="tel"
              autoComplete="tel"
              placeholder="+220 7XX XXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />

            <p className="text-xs text-gray-500 mt-1">
              Used for delivery coordination.
            </p>
          </div>

          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: acceptedTerms
                ? "var(--indigo)"
                : "var(--sand)",
              background: "#fbfaf7",
            }}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) =>
                  setAcceptedTerms(event.target.checked)
                }
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span className="text-xs text-gray-600 leading-5">
                I agree to Teraa&apos;s{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{ color: "var(--indigo)" }}
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{ color: "var(--indigo)" }}
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
                style={{ color: "var(--indigo)" }}
              >
                Marketplace Rules
              </Link>
              .
            </p>
          </div>

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
            disabled={saving || !acceptedTerms}
            className="w-full rounded-lg py-3 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--indigo)" }}
          >
            {saving ? "Finishing setup..." : "Continue to Teraa"}
          </button>
        </form>
      </div>
    </main>
  );
}
