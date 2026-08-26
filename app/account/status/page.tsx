import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AccountStatusPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select(
      `
      full_name,
      account_status,
      restriction_reason
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/account");
  }

  if (profile.account_status === "active") {
    redirect("/account");
  }

  const status = profile.account_status;

  const title =
    status === "banned"
      ? "Account banned"
      : status === "suspended"
        ? "Account suspended"
        : "Account restricted";

  const description =
    status === "banned"
      ? "Your Teraa account has been banned from marketplace activity."
      : status === "suspended"
        ? "Your Teraa account has been temporarily suspended from marketplace activity."
        : "Some marketplace features are currently unavailable on your account.";

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-8">
        <div
          className="rounded-2xl border bg-white p-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4"
            style={{
              background: "#fdf0f0",
            }}
          >
            ⚠️
          </div>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>

          <p className="text-sm text-gray-500 mt-2">{description}</p>

          {profile.restriction_reason && (
            <div
              className="rounded-xl p-4 mt-5"
              style={{
                background: "#f7f7f5",
              }}
            >
              <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
                Reason
              </p>

              <p className="text-sm">{profile.restriction_reason}</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-5">
            You can still access your account and existing marketplace
            information. Marketplace actions may be unavailable while this
            status remains on your account.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/account"
              className="rounded-full px-5 py-2.5 text-sm text-white font-medium"
              style={{
                background: "var(--indigo)",
              }}
            >
              My account
            </Link>

            <Link
              href="/"
              className="rounded-full px-5 py-2.5 text-sm border font-medium"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              Browse Teraa
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
