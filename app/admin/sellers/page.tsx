import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

type SearchParams = Promise<{
  q?: string;
  verification?: string;
  account?: string;
}>;

type UserInfo = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
  account_status: string;
};

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const search = params.q?.trim() ?? "";

  const verification = params.verification ?? "all";

  const account = params.account ?? "all";

  const { supabase } = await requireAdmin();

  let request = supabase
    .from("sellers")
    .select(
      `
      id,
      business_name,
      verification_status,
      account_status,
      rating_avg,
      total_sales,
      created_at,
      verification_request_reason,
      admin_note
      `,
    )
    .not("application_submitted_at", "is", null)
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (search) {
    request = request.ilike("business_name", `%${search}%`);
  }

  if (verification !== "all") {
    request = request.eq("verification_status", verification);
  }

  if (account !== "all") {
    request = request.eq("account_status", account);
  }

  const { data: sellers, error } = await request;

  const sellerIds = (sellers ?? []).map((seller) => seller.id);

  let users: UserInfo[] = [];

  if (sellerIds.length > 0) {
    const { data, error: usersError } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        phone_number,
        city
        ,account_status
        `,
      )
      .in("id", sellerIds);

    if (usersError) {
      console.error("Seller users lookup failed:", usersError);
    } else {
      users = (data ?? []) as UserInfo[];
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500">Admin</p>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Sellers
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage verification, account access and seller activity.
          </p>
        </div>

        <form method="GET" className="flex flex-wrap gap-2 mb-6">
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search seller..."
            className="flex-1 min-w-52 rounded-full border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--sand)",
            }}
          />

          <select
            name="verification"
            defaultValue={verification}
            className="rounded-full border px-4 py-2 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All verification</option>

            <option value="pending">Pending</option>

            <option value="approved">Approved</option>

            <option value="rejected">Rejected</option>
          </select>

          <select
            name="account"
            defaultValue={account}
            className="rounded-full border px-4 py-2 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All accounts</option>

            <option value="active">Active</option>

            <option value="suspended">Suspended</option>

            <option value="banned">Banned</option>

            <option value="deleted">Deleted</option>
          </select>

          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm text-white font-medium"
            style={{
              background: "var(--indigo)",
            }}
          >
            Search
          </button>
        </form>

        {error && (
          <div
            className="rounded-xl border p-5 mb-6"
            style={{
              borderColor: "#e0a0a0",
            }}
          >
            Couldn&apos;t load sellers.
          </div>
        )}

        {!error && (!sellers || sellers.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No sellers found.
          </div>
        )}

        <div className="space-y-3">
          {(sellers ?? []).map((seller) => {
            const profile =
              users.find((entry) => entry.id === seller.id) ?? null;
            const effectiveStatus =
              profile?.account_status === "deleted"
                ? "deleted"
                : seller.account_status;

            return (
              <Link
                key={seller.id}
                href={`/admin/sellers/${seller.id}`}
                className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
                style={{
                  borderColor:
                    effectiveStatus === "banned" ||
                    effectiveStatus === "suspended" ||
                    effectiveStatus === "deleted"
                      ? "var(--clay)"
                      : "var(--sand)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{seller.business_name}</p>

                    {profile && (
                      <p className="text-xs text-gray-500 mt-1">
                        {profile.full_name}

                        {profile.city ? ` · ${profile.city}` : ""}

                        {profile.phone_number
                          ? ` · ${profile.phone_number}`
                          : ""}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">
                      Sales: {seller.total_sales ?? 0}
                      {" · "}
                      Rating: {Number(seller.rating_avg ?? 0).toFixed(1)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <VerificationBadge
                      status={
                        effectiveStatus === "deleted"
                          ? "deleted"
                          : seller.verification_status
                      }
                    />

                    <AccountBadge status={effectiveStatus} />
                  </div>
                </div>

                {seller.verification_request_reason && (
                  <p
                    className="rounded-md px-3 py-2 mt-3 text-xs"
                    style={{
                      background: "#fbf3df",
                    }}
                  >
                    Verification request: {seller.verification_request_reason}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      label: string;
      bg: string;
      color: string;
    }
  > = {
    approved: {
      label: "Verified",
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    pending: {
      label: "Pending",
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    rejected: {
      label: "Rejected",
      bg: "#fdf0f0",
      color: "var(--clay)",
    },

    deleted: {
      label: "Deleted account",
      bg: "#eeeeee",
      color: "#666666",
    },
  };

  const selected = styles[status] ?? styles.pending;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{
        background: selected.bg,
        color: selected.color,
      }}
    >
      {selected.label}
    </span>
  );
}

function AccountBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      label: string;
      bg: string;
      color: string;
    }
  > = {
    active: {
      label: "Active",
      bg: "#e6edf3",
      color: "var(--indigo)",
    },

    suspended: {
      label: "Suspended",
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    banned: {
      label: "Banned",
      bg: "#fdf0f0",
      color: "var(--clay)",
    },

    deleted: {
      label: "Deleted",
      bg: "#eeeeee",
      color: "#666666",
    },
  };

  const selected = styles[status] ?? styles.active;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{
        background: selected.bg,
        color: selected.color,
      }}
    >
      {selected.label}
    </span>
  );
}
