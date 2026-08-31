"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
import { deleteAccountPermanently } from "./actions";

export default function DeleteAccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirect=/account/delete");
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setAllowed(data?.role !== "admin");
      setLoading(false);
    }

    load();
  }, [router]);

  async function deleteAccount() {
    if (confirmation !== "delete my account") return;

    setDeleting(true);
    setError(null);

    const result = await deleteAccountPermanently(confirmation);

    if (!result.success) {
      setDeleting(false);
      setError(result.message);
      return;
    }

    const supabase = createClient();

    try {
      await supabase.auth.signOut();
    } catch {}

    window.location.replace("/");
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "#fffdf8" }}
      >
        <p style={{ color: "var(--indigo)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <Link
          href="/account"
          className="text-sm font-medium"
          style={{ color: "var(--indigo)" }}
        >
          ‹ Account
        </Link>

        {!allowed ? (
          <section
            className="rounded-xl border bg-white p-5 mt-5"
            style={{ borderColor: "var(--sand)" }}
          >
            <h1 className="font-display text-xl font-bold">
              Account deletion unavailable
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              Administrator accounts cannot be deleted through self-service.
            </p>
          </section>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-red-700 mt-4">
              Delete account
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              This action cannot be undone.
            </p>

            <section
              className="rounded-xl border bg-white p-5 mt-5"
              style={{ borderColor: "#efb4b4" }}
            >
              <div className="text-sm text-gray-600 leading-6 space-y-2">
                <p>
                  Your login, personal information, messages, uploaded ID
                  document and listing photos will be permanently removed.
                </p>

                <p>
                  Completed and cancelled orders, settled commissions and
                  resolved dispute records will be retained without your
                  personal details for financial and safety records.
                </p>

                <p className="font-medium text-red-700">
                  You cannot delete your account while an order, delivery
                  issue, commission payment or report is unresolved.
                </p>
              </div>

              <p className="text-sm text-gray-600 mt-5">
                Type{" "}
                <span className="font-semibold text-red-700">
                  delete my account
                </span>{" "}
                to confirm.
              </p>

              <input
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value);
                  setError(null);
                }}
                disabled={deleting}
                autoComplete="off"
                placeholder="delete my account"
                className="w-full rounded-lg border px-3 py-3 text-sm mt-3 outline-none"
                style={{ borderColor: "#efb4b4" }}
              />

              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}

              <button
                type="button"
                onClick={deleteAccount}
                disabled={
                  deleting || confirmation !== "delete my account"
                }
                className="w-full rounded-lg py-3 mt-4 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "#b42318" }}
              >
                {deleting
                  ? "Deleting account..."
                  : "Delete my account permanently"}
              </button>
            </section>
          </>
        )}
      </main>
    </>
  );
}
