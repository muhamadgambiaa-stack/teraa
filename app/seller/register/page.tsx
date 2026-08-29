"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

const SELLER_TERMS_VERSION = "2026-08-30";

export default function SellerRegisterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function prepare() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login?redirect=/seller/register");
        return;
      }

      const { data: existingSeller, error: sellerError } = await supabase
        .from("sellers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (sellerError) {
        console.error("Seller lookup failed:", sellerError);
      }

      if (existingSeller) {
        router.replace("/seller/dashboard");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("full_name, role, account_status")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError || !profile) {
        setError("Couldn't load your Teraa account.");
        setChecking(false);
        return;
      }

      if (profile.role === "admin") {
        router.replace("/account");
        return;
      }

      if (profile.account_status !== "active") {
        setError(
          "Your Teraa account must be active before you can register as a seller.",
        );
        setChecking(false);
        return;
      }

      setLegalName(profile.full_name?.trim() ?? "");
      setChecking(false);
    }

    void prepare();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);

    const cleanLegalName = legalName.trim();
    const cleanBusinessName = businessName.trim();

    if (cleanLegalName.length < 2) {
      setError("Please enter your legal full name.");
      return;
    }

    if (cleanBusinessName.length < 2) {
      setError("Please enter the name you want buyers to see on Teraa.");
      return;
    }

    if (!acceptedTerms) {
      setError("Please read and agree to the Teraa Seller Terms.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: applicationError } = await supabase.rpc(
        "register_seller_application",
        {
          p_legal_name: cleanLegalName,
          p_business_name: cleanBusinessName,
          p_terms_version: SELLER_TERMS_VERSION,
        },
      );

      if (applicationError) {
        const message = applicationError.message ?? "";

        if (message.includes("seller_application_exists")) {
          router.replace("/seller/dashboard");
          return;
        }

        if (message.includes("account_not_active")) {
          throw new Error(
            "Your Teraa account must be active before you can register as a seller.",
          );
        }

        if (message.includes("admin_cannot_register_as_seller")) {
          throw new Error("Admin accounts cannot register as sellers.");
        }

        throw new Error(message || "Couldn't submit your seller application.");
      }

      router.push("/seller/dashboard/verify");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't submit your seller application.",
      );

      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "var(--paper)" }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--indigo)" }}
          />

          <p className="mt-3 text-sm text-gray-500">
            Preparing seller registration...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6">
          <Link
            href="/account"
            className="text-sm hover:underline"
            style={{ color: "var(--indigo)" }}
          >
            Back to account
          </Link>

          <h1
            className="font-display text-2xl mt-4"
            style={{ color: "var(--ink)" }}
          >
            Start selling on Teraa
          </h1>

          <p className="text-sm text-gray-600 mt-2 leading-6">
            Create your seller profile. Your legal name is used for identity
            verification, while your business name is what buyers will see.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-white p-4 sm:p-5 space-y-5"
          style={{ borderColor: "var(--sand)" }}
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Legal full name
            </label>

            <input
              required
              autoComplete="name"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />

            <p className="text-xs text-gray-500 mt-1.5 leading-5">
              Enter your name exactly as it appears on the ID you will submit.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Business or display name
            </label>

            <input
              required
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Example: Bah Electronics"
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />

            <p className="text-xs text-gray-500 mt-1.5 leading-5">
              This is the seller name that will appear publicly on Teraa.
            </p>
          </div>

          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: acceptedTerms ? "var(--indigo)" : "var(--sand)",
              background: "#fbfaf7",
            }}
          >
            <p className="text-sm font-medium">Seller agreement</p>

            <p className="text-xs text-gray-500 mt-1 leading-5">
              Read the Seller Terms before continuing. They include identity
              verification, commission payment rules and seller obligations.
            </p>

            <Link
              href="/seller/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm font-medium underline"
              style={{ color: "var(--indigo)" }}
            >
              Open Seller Terms
            </Link>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) =>
                  setAcceptedTerms(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 shrink-0"
              />

              <span className="text-xs text-gray-600 leading-5">
                I have read and agree to the Teraa Seller Terms.
              </span>
            </label>
          </div>

          {error && (
            <div
              className="rounded-lg border p-3 text-sm text-red-700"
              style={{
                borderColor: "#efb4b4",
                background: "#fff5f5",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !acceptedTerms}
            className="w-full rounded-lg py-3 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--indigo)" }}
          >
            {submitting
              ? "Submitting application..."
              : "Continue to identity verification"}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-4 leading-5 text-center">
          Creating a seller profile does not automatically approve your shop.
          Teraa reviews seller identity before listings can be published.
        </p>
      </main>
    </>
  );
}