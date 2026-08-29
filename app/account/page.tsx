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

type IconName =
  | "orders"
  | "heart"
  | "message"
  | "bell"
  | "support"
  | "store"
  | "tag"
  | "sellerOrders"
  | "settings"
  | "admin"
  | "users"
  | "report"
  | "appeal";

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

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        .select(
          `
          full_name,
          phone_number,
          city,
          role
        `,
        )
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError || !profileData) {
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

      if (userProfile.role === "seller") {
        const [
          { data: sellerData, error: sellerError },
          { count: completedSales, error: salesError },
        ] = await Promise.all([
          supabase
            .from("sellers")
            .select(
              `
              business_name,
              verification_status,
              account_status,
              rating_avg
            `,
            )
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("orders")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("seller_id", user.id)
            .eq("status", "completed"),
        ]);

        if (sellerError) {
          console.error("Could not load seller account:", sellerError);
        }

        if (salesError) {
          console.error("Could not load completed sales:", salesError);
        }

        if (active && sellerData) {
          setSeller({
            business_name: sellerData.business_name,
            verification_status: sellerData.verification_status,
            account_status: sellerData.account_status,
            rating_avg: sellerData.rating_avg,
            total_sales: completedSales ?? 0,
          });
        }
      }

      setLoading(false);
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

  async function handleDeleteAccount() {
    if (deleteConfirmation !== "delete my account") {
      setDeleteError('Type exactly "delete my account" to continue.');
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setDeletingAccount(false);
      setDeleteError("Your session has expired. Please log in again.");
      return;
    }

    const { error: deleteAccountError } = await supabase.rpc(
      "delete_my_account",
      {
        p_confirmation: deleteConfirmation,
      },
    );

    if (deleteAccountError) {
      console.error("Account deletion failed:", deleteAccountError);

      setDeletingAccount(false);
      setDeleteError(
        "Couldn't delete your account. Please try again or contact support.",
      );
      return;
    }

    /*
     * The Auth user has now been deleted server-side.
     * Clear any remaining local session data before leaving /account.
     */
    try {
      await supabase.auth.signOut();
    } catch {
      // The Auth identity is already deleted, so there may be nothing left
      // for the server to sign out. Redirecting still clears the UI state.
    }

    window.location.replace("/");
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-6"
        style={{ background: "#fffdf8" }}
        role="status"
        aria-live="polite"
        aria-label="Loading Teraa"
      >
        <div className="flex flex-col items-center">
          <img
            src="/branding/teraa-icon.svg"
            alt=""
            width="72"
            height="72"
            className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
          />

          <p
            className="mt-3 text-lg font-semibold"
            style={{ color: "var(--indigo)" }}
          >
            Teraa
          </p>

          <p className="mt-1 text-sm text-gray-400">
            Loading...
          </p>

          <div
            className="mt-5 flex items-center gap-2"
            aria-hidden="true"
          >
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: "var(--indigo)" }}
            />

            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{
                background: "var(--leaf)",
                animationDelay: "150ms",
              }}
            />

            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{
                background: "var(--indigo)",
                animationDelay: "300ms",
              }}
            />
          </div>
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <>
        <SiteHeader />

        <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
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

      <main className="max-w-2xl mx-auto px-4 py-5 pb-28 sm:pb-8">
        {/* PROFILE */}

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
                  âœ“ Verified seller
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

        {/* MY TERAA */}

        <AccountSection title="My Teraa">
          <AccountLink
            href="/orders"
            icon="orders"
            title="My orders"
            description="Track purchases and order history"
          />

          <AccountLink
            href="/favorites"
            icon="heart"
            title="Favorites"
            description="Products you've saved"
          />

          <AccountLink
            href="/messages"
            icon="message"
            title="Messages"
            description="Your marketplace conversations"
          />

          <AccountLink
            href="/notifications"
            icon="bell"
            title="Notifications"
            description="Updates about your activity"
          />

          <AccountLink
            href="/account/support"
            icon="support"
            title="Contact support"
            description="Get help with orders, delivery and your account"
          />
        </AccountSection>

        {/* SELLING */}

        {isSeller && (
          <AccountSection title="Selling">
            {seller && (
              <div
                className="px-4 py-4 border-b"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className="font-display font-semibold text-lg truncate"
                      style={{
                        color: "var(--ink)",
                      }}
                    >
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

                {/* SELLER STATS */}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "var(--sand)",
                      background: "#fbfaf7",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base" aria-hidden="true">
                        â­
                      </span>

                      <p
                        className="font-bold text-base"
                        style={{
                          color: "var(--ink)",
                        }}
                      >
                        {Number(seller.rating_avg ?? 0).toFixed(1)}
                      </p>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-1">Rating</p>
                  </div>

                  <div
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "var(--sand)",
                      background: "#fbfaf7",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base" aria-hidden="true">
                        ðŸ›ï¸
                      </span>

                      <p
                        className="font-bold text-base"
                        style={{
                          color: "var(--ink)",
                        }}
                      >
                        {seller.total_sales ?? 0}
                      </p>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-1">
                      Completed sales
                    </p>
                  </div>
                </div>
              </div>
            )}

            <AccountLink
              href="/seller/dashboard"
              icon="store"
              title="Seller dashboard"
              description="Manage your store and listings"
            />

            <AccountLink
              href="/seller/dashboard"
              icon="tag"
              title="My listings"
              description="View and manage your products"
            />

            <AccountLink
              href="/seller/dashboard/orders"
              icon="sellerOrders"
              title="Seller orders"
              description="Manage orders from buyers"
            />

            <AccountLink
              href="/seller/dashboard/settings"
              icon="settings"
              title="Seller settings"
              description="Business information and shop settings"
            />
          </AccountSection>
        )}

        {/* ADMIN */}

        {isAdmin && (
          <AccountSection title="Administration">
            <AccountLink
              href="/admin"
              icon="admin"
              title="Admin dashboard"
              description="Marketplace administration"
            />

            <AccountLink
              href="/admin/support"
              icon="support"
              title="Support queue"
              description="Respond to user support conversations"
            />

            <AccountLink
              href="/admin/sellers"
              icon="store"
              title="Seller management"
              description="Verification, restrictions and seller accounts"
            />

            <AccountLink
              href="/admin/listings"
              icon="tag"
              title="Listing moderation"
              description="Search and moderate marketplace listings"
            />

            <AccountLink
              href="/admin/reports"
              icon="report"
              title="Reports"
              description="Investigate marketplace reports"
            />

            <AccountLink
              href="/admin/appeals"
              icon="appeal"
              title="Listing appeals"
              description="Review seller moderation appeals"
            />

            <AccountLink
              href="/admin/users"
              icon="users"
              title="User management"
              description="Restrict, suspend and manage user accounts"
            />
          </AccountSection>
        )}

        {/* ACCOUNT SETTINGS */}

        <AccountSection title="Account">
          <AccountLink
            href="/account/settings"
            icon="settings"
            title="Settings"
            description="Personal information and account details"
          />

          {!isAdmin && (
            <Link
              href="/account/delete"
              className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 hover:bg-red-50 transition"
              style={{ borderColor: "var(--sand)" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "#fff1f1",
                  color: "#b42318",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v5" />
                  <path d="M14 11v5" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-700">
                  Delete account
                </p>

                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently remove your Teraa account
                </p>
              </div>

              <ChevronIcon />
            </Link>
          )}
        </AccountSection>
        {/* LOGOUT */}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl border py-3 text-sm font-medium mb-6"
          style={{
            borderColor: "var(--clay)",
            color: "var(--clay)",
          }}
        >
          Log out
        </button>

        {/* LEGAL FOOTER */}

        <footer
          className="border-t pt-5 pb-3 text-center"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs text-gray-500">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>

            <span className="text-gray-300">Â·</span>

            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>

            <span className="text-gray-300">Â·</span>

            <Link href="/marketplace-rules" className="hover:underline">
              Marketplace Rules
            </Link>

            <span className="text-gray-300">Â·</span>

            <Link href="/safety" className="hover:underline">
              Safety
            </Link>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">Â© 2026 Teraa</p>
        </footer>
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
  icon: IconName;
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
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "#f6f6f3",
          color: "var(--indigo)",
        }}
      >
        <AccountIcon name={icon} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>

        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <ChevronIcon />
    </Link>
  );
}

function AccountIcon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "orders":
      return (
        <svg {...common}>
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "heart":
      return (
        <svg {...common}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      );

    case "message":
      return (
        <svg {...common}>
          <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-4.5A2 2 0 0 1 2 15V7a2 2 0 0 1 2-2Z" />
        </svg>
      );

    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      );

    case "support":
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <path d="M4 13v4a2 2 0 0 0 2 2h2v-6H4Z" />
          <path d="M20 13v4a2 2 0 0 1-2 2h-2v-6h4Z" />
          <path d="M16 19c0 2-2 3-4 3" />
        </svg>
      );

    case "store":
      return (
        <svg {...common}>
          <path d="M3 9 5 4h14l2 5" />
          <path d="M5 13v7h14v-7" />
          <path d="M9 20v-5h6v5" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        </svg>
      );

    case "tag":
      return (
        <svg {...common}>
          <path d="M20 13 13 20 4 11V4h7l9 9Z" />
          <circle cx="8.5" cy="8.5" r="1" />
        </svg>
      );

    case "sellerOrders":
      return (
        <svg {...common}>
          <path d="M6 3h12v18H6z" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />

          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );

    case "admin":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />

          <circle cx="17" cy="9" r="2" />

          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M15 15a5 5 0 0 1 6 5" />
        </svg>
      );

    case "report":
      return (
        <svg {...common}>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "appeal":
      return (
        <svg {...common}>
          <path d="M9 7 4 12l5 5" />
          <path d="M4 12h9a7 7 0 0 1 7 7" />
        </svg>
      );
  }
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400 shrink-0"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
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
    return <StatusPill text="Suspended" type="danger" />;
  }

  if (accountStatus === "banned") {
    return <StatusPill text="Banned" type="danger" />;
  }

  if (verification === "approved") {
    return <StatusPill text="âœ“ Verified" type="success" />;
  }

  if (verification === "rejected") {
    return <StatusPill text="Verification rejected" type="danger" />;
  }

  return <StatusPill text="Verification pending" type="warning" />;
}

function StatusPill({
  text,
  type,
}: {
  text: string;
  type: "success" | "danger" | "warning";
}) {
  const style =
    type === "success"
      ? {
          background: "#e3f0e8",
          color: "var(--leaf)",
        }
      : type === "danger"
        ? {
            background: "#fdf0f0",
            color: "var(--clay)",
          }
        : {
            background: "#fbf3df",
            color: "var(--gold)",
          };

  return (
    <span
      className="inline-flex w-fit items-center text-[10px] leading-none rounded-full px-2.5 py-1.5 font-semibold shrink-0 self-start"
      style={style}
    >
      {text}
    </span>
  );
}




