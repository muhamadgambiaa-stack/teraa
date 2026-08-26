"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { GAMBIA_CITIES } from "@/types/database";

type Role = "buyer" | "seller" | "admin";

type Profile = {
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
  role: Role;
};

type Seller = {
  business_name: string | null;
  verification_status: string | null;
  account_status: string | null;
  rating_avg: number | null;
  total_sales: number | null;
};

export default function AccountPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [seller, setSeller] = useState<Seller | null>(null);

  const [email, setEmail] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");

  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirect=/account");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("full_name, phone_number, city, role")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError) {
        setError("Couldn't load your account.");
        setLoading(false);
        return;
      }

      const userProfile = profileData as Profile;

      setProfile(userProfile);

      setEmail(user.email ?? null);

      setFullName(userProfile.full_name ?? "");

      setPhone(userProfile.phone_number ?? "");

      setCity(userProfile.city ?? "");

      /*
       * Sellers have extra marketplace
       * information.
       */
      if (userProfile.role === "seller") {
        const { data: sellerData } = await supabase
          .from("sellers")
          .select(
            `
            business_name,
            verification_status,
            account_status,
            rating_avg,
            total_sales
            `,
          )
          .eq("id", user.id)
          .maybeSingle();

        if (active && sellerData) {
          setSeller(sellerData as Seller);
        }
      }

      setLoading(false);
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        city,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            full_name: fullName.trim(),
            phone_number: phone.trim(),
            city,
          }
        : current,
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <>
        <SiteHeader />

        <main className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-sm text-gray-500">Loading your account…</p>
        </main>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <SiteHeader />

        <main className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-sm text-red-600">
            Couldn&apos;t load your account.
          </p>
        </main>
      </>
    );
  }

  const firstName = profile.full_name?.trim().split(" ")[0] || "Teraa user";

  const initial = firstName.charAt(0).toUpperCase() || "T";

  const isSeller = profile.role === "seller";

  const isAdmin = profile.role === "admin";

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* PROFILE HEADER */}

        <section className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{
              background: "var(--indigo)",
            }}
          >
            {initial}
          </div>

          <div className="min-w-0">
            <h1
              className="font-display text-xl font-bold truncate"
              style={{
                color: "var(--ink)",
              }}
            >
              {profile.full_name || "My account"}
            </h1>

            {email && <p className="text-sm text-gray-500 truncate">{email}</p>}

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className="text-xs capitalize font-medium"
                style={{
                  color: "var(--indigo)",
                }}
              >
                {profile.role}
              </span>

              {isSeller && seller?.verification_status === "approved" && (
                <span
                  className="text-[10px] rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: "#e3f0e8",
                    color: "var(--leaf)",
                  }}
                >
                  Verified seller
                </span>
              )}

              {isAdmin && (
                <span
                  className="text-[10px] rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: "#e6edf3",
                    color: "var(--indigo)",
                  }}
                >
                  Teraa admin
                </span>
              )}
            </div>
          </div>
        </section>

        {/* GENERAL ACTIVITY */}

        <AccountSection title="My Teraa">
          <AccountLink
            href="/orders"
            icon="📦"
            title="My orders"
            description="Track purchases and order history"
          />

          <AccountLink
            href="/favorites"
            icon="♡"
            title="Favorites"
            description="Products you've saved"
          />

          <AccountLink
            href="/messages"
            icon="💬"
            title="Messages"
            description="Your marketplace conversations"
          />

          <AccountLink
            href="/notifications"
            icon="🔔"
            title="Notifications"
            description="Updates about your activity"
          />
        </AccountSection>

        {/* SELLER SECTION */}

        {isSeller && (
          <AccountSection title="Selling">
            {seller && (
              <div
                className="px-4 py-4 border-b"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">
                      {seller.business_name || firstName}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Seller account
                    </p>
                  </div>

                  <SellerStatus
                    verification={seller.verification_status}
                    accountStatus={seller.account_status}
                  />
                </div>

                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="font-semibold text-sm">
                      {Number(seller.rating_avg ?? 0).toFixed(1)}★
                    </p>

                    <p className="text-[10px] text-gray-500">Rating</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm">
                      {seller.total_sales ?? 0}
                    </p>

                    <p className="text-[10px] text-gray-500">Sales</p>
                  </div>
                </div>
              </div>
            )}

            <AccountLink
              href="/seller/dashboard"
              icon="🏪"
              title="Seller dashboard"
              description="Manage your store and listings"
            />

            <AccountLink
              href="/seller/dashboard"
              icon="🏷️"
              title="My listings"
              description="View and manage your products"
            />

            <AccountLink
              href="/seller/dashboard/orders"
              icon="📋"
              title="Seller orders"
              description="Manage orders from buyers"
            />

            <AccountLink
              href="/seller/dashboard/settings"
              icon="💳"
              title="Seller settings"
              description="Business information and payment methods"
            />
          </AccountSection>
        )}

        {/* ADMIN SECTION */}

        {isAdmin && (
          <AccountSection title="Administration">
            <AccountLink
              href="/admin"
              icon="⚙️"
              title="Admin dashboard"
              description="Marketplace administration"
            />

            <AccountLink
              href="/admin/sellers"
              icon="🏪"
              title="Seller management"
              description="Verification, restrictions and seller accounts"
            />

            <AccountLink
              href="/admin/listings"
              icon="🏷️"
              title="Listing moderation"
              description="Search and moderate marketplace listings"
            />

            <AccountLink
              href="/admin/reports"
              icon="⚠️"
              title="Reports"
              description="Investigate marketplace reports"
            />

            <AccountLink
              href="/admin/appeals"
              icon="↩️"
              title="Listing appeals"
              description="Review seller moderation appeals"
            />
          </AccountSection>
        )}

        {/* PROFILE SETTINGS */}

        <AccountSection title="Account settings">
          <form onSubmit={handleSave} className="p-4 space-y-4">
            {email && (
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>

                <input
                  disabled
                  value={email}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />

                <p className="text-xs text-gray-500 mt-1">Used to log in.</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">
                Full name
              </label>

              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Phone number
              </label>

              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />

              <p className="text-xs text-gray-500 mt-1">
                Used for delivery and payment coordination.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">City</label>

              <select
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <option value="">Select your city</option>

                {GAMBIA_CITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full px-6 py-2.5 text-white text-sm font-medium disabled:opacity-50"
                style={{
                  background: "var(--indigo)",
                }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              {saved && (
                <span
                  className="text-sm"
                  style={{
                    color: "var(--leaf)",
                  }}
                >
                  Saved ✓
                </span>
              )}
            </div>
          </form>
        </AccountSection>

        {/* LOG OUT */}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl border py-3 text-sm font-medium mb-5"
          style={{
            borderColor: "var(--clay)",
            color: "var(--clay)",
          }}
        >
          Log out
        </button>

        <p className="text-xs text-center text-gray-400 pb-3">
          Teraa · Buy and sell safely
        </p>
      </main>
    </>
  );
}

function AccountSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2 px-1">
        {title}
      </h2>

      <div
        className="rounded-xl border bg-white overflow-hidden"
        style={{
          borderColor: "var(--sand)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function AccountLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center shrink-0 text-lg">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>

        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <span className="text-gray-400 text-lg">›</span>
    </Link>
  );
}

function SellerStatus({
  verification,
  accountStatus,
}: {
  verification: string | null;
  accountStatus: string | null;
}) {
  if (accountStatus === "suspended") {
    return (
      <span
        className="text-[10px] rounded-full px-2 py-1 font-semibold"
        style={{
          background: "#fdf0f0",
          color: "var(--clay)",
        }}
      >
        Suspended
      </span>
    );
  }

  if (accountStatus === "banned") {
    return (
      <span
        className="text-[10px] rounded-full px-2 py-1 font-semibold"
        style={{
          background: "#fdf0f0",
          color: "var(--clay)",
        }}
      >
        Banned
      </span>
    );
  }

  if (verification === "approved") {
    return (
      <span
        className="text-[10px] rounded-full px-2 py-1 font-semibold"
        style={{
          background: "#e3f0e8",
          color: "var(--leaf)",
        }}
      >
        Verified
      </span>
    );
  }

  if (verification === "rejected") {
    return (
      <span
        className="text-[10px] rounded-full px-2 py-1 font-semibold"
        style={{
          background: "#fdf0f0",
          color: "var(--clay)",
        }}
      >
        Verification rejected
      </span>
    );
  }

  return (
    <span
      className="text-[10px] rounded-full px-2 py-1 font-semibold"
      style={{
        background: "#fbf3df",
        color: "var(--gold)",
      }}
    >
      Verification pending
    </span>
  );
}
