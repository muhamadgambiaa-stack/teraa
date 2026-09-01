import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    role?: string;
  }>;
}) {
  const params = await searchParams;

  const query = params.q?.trim() ?? "";

  const status = params.status ?? "all";

  const role = params.role ?? "all";

  const { supabase } = await requireAdmin();

  let request = supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      phone_number,
      city,
      role,
      profile_photo_url,
      account_status,
      restriction_reason
      `,
    )
    .order("full_name", {
      ascending: true,
    })
    .limit(200);

  if (status !== "all") {
    request = request.eq("account_status", status);
  }

  if (role !== "all") {
    request = request.eq("role", role);
  }

  if (query) {
    request = request.or(
      `full_name.ilike.%${query}%,phone_number.ilike.%${query}%,city.ilike.%${query}%`,
    );
  }

  const { data: users, error } = await request;

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
            Users
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Search and manage buyer, seller and marketplace accounts.
          </p>
        </div>

        <form
          method="GET"
          className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 mb-6"
        >
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, phone or city..."
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          />

          <select
            name="role"
            defaultValue={role}
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All roles</option>

            <option value="buyer">Buyers</option>

            <option value="seller">Sellers</option>

            <option value="admin">Admins</option>
          </select>

          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All statuses</option>

            <option value="active">Active</option>

            <option value="restricted">Restricted</option>

            <option value="suspended">Suspended</option>

            <option value="banned">Banned</option>

            <option value="deleted">Deleted</option>
          </select>

          <button
            type="submit"
            className="rounded-lg px-4 py-2.5 text-sm text-white"
            style={{
              background: "var(--indigo)",
            }}
          >
            Search
          </button>
        </form>

        {error && (
          <div
            className="rounded-xl border p-5 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
            }}
          >
            Couldn&apos;t load users.
          </div>
        )}

        {!error && (!users || users.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No users found.
          </div>
        )}

        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {(users ?? []).map((user) => (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="flex items-center gap-3 px-4 py-4 border-b last:border-b-0 hover:bg-gray-50 transition"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              {user.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profile_photo_url}
                  alt={user.full_name}
                  className="w-11 h-11 rounded-full object-cover border shrink-0"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {user.full_name?.charAt(0).toUpperCase() ?? "T"}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {user.full_name}
                  </p>

                  <span className="text-[10px] capitalize text-gray-400">
                    {user.role}
                  </span>
                </div>

                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {user.phone_number}

                  {user.city ? ` · ${user.city}` : ""}
                </p>
              </div>

              <UserStatusBadge status={user.account_status} />

              <span className="text-gray-400">›</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

function UserStatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      bg: string;
      color: string;
    }
  > = {
    active: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    restricted: {
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    suspended: {
      bg: "#fdf0f0",
      color: "var(--clay)",
    },

    banned: {
      bg: "#eee",
      color: "#555",
    },

    deleted: {
      bg: "#f3f4f6",
      color: "#6b7280",
    },
  };

  const style = styles[status] ?? styles.active;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize shrink-0"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
