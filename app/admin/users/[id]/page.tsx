import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import { banUser, restrictUser, restoreUser, suspendUser } from "../actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { supabase, user: admin } = await requireAdmin();

  const { data: user, error } = await supabase
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
      restriction_reason,
      restricted_at,
      created_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Admin user lookup failed:", error);
  }

  if (error || !user) {
    notFound();
  }

  const isOwnAccount = admin.id === user.id;
  const isAdminAccount = user.role === "admin";

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link
          href="/admin/users"
          className="text-sm text-gray-500 hover:underline"
        >
          ← Back to users
        </Link>

        <div
          className="mt-5 rounded-xl border bg-white overflow-hidden"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {/* USER HEADER */}

          <div className="p-6">
            <div className="flex items-center gap-4">
              {user.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profile_photo_url}
                  alt={user.full_name}
                  className="w-20 h-20 rounded-full object-cover border shrink-0"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl text-white font-bold shrink-0"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {user.full_name?.charAt(0).toUpperCase() ?? "T"}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1">User account</p>

                <h1
                  className="font-display text-2xl truncate"
                  style={{
                    color: "var(--ink)",
                  }}
                >
                  {user.full_name}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
                    style={{
                      background: "var(--sand)",
                      color: "var(--ink)",
                    }}
                  >
                    {user.role}
                  </span>

                  <UserStatusBadge status={user.account_status} />
                </div>
              </div>
            </div>
          </div>

          {/* ACCOUNT INFO */}

          <div
            className="border-t p-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Account information</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <InfoBox label="Full name" value={user.full_name} />

              <InfoBox label="Phone number" value={user.phone_number} />

              <InfoBox label="City" value={user.city ?? "Not provided"} />

              <InfoBox label="Role" value={user.role} />

              <InfoBox label="Account status" value={user.account_status} />

              <InfoBox
                label="Joined"
                value={new Date(user.created_at).toLocaleDateString()}
              />
            </div>
          </div>

          {/* CURRENT MODERATION STATUS */}

          <div
            className="border-t p-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Moderation</h2>

            {user.account_status === "active" ? (
              <div
                className="rounded-lg p-4 text-sm"
                style={{
                  background: "#e3f0e8",
                  color: "var(--leaf)",
                }}
              >
                This account is currently active.
              </div>
            ) : (
              <div
                className="rounded-lg border p-4"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <p className="text-xs text-gray-500">Restriction reason</p>

                <p className="text-sm mt-1">
                  {user.restriction_reason ?? "No reason provided."}
                </p>

                {user.restricted_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    Action taken {new Date(user.restricted_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ADMIN ACTIONS */}

          <div
            className="border-t p-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold">Admin actions</h2>

            <p className="text-sm text-gray-500 mt-1 mb-5">
              Restrict, suspend or ban this account.
            </p>

            {isOwnAccount || isAdminAccount ? (
              <div
                className="rounded-lg border p-4 text-sm text-gray-500"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                Admin accounts cannot be restricted, suspended or banned from
                this page.
              </div>
            ) : user.account_status !== "active" ? (
              <div>
                <form action={restoreUser.bind(null, user.id)}>
                  <button
                    type="submit"
                    className="rounded-full px-5 py-2.5 text-white text-sm font-medium"
                    style={{
                      background: "var(--leaf)",
                    }}
                  >
                    Restore account
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {/* RESTRICT */}

                <form
                  action={restrictUser.bind(null, user.id)}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <p className="font-medium text-sm">Restrict</p>

                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Block new marketplace actions while keeping account access.
                  </p>

                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="Reason for restriction..."
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />

                  <button
                    type="submit"
                    className="w-full rounded-full py-2 text-white text-xs font-medium mt-3"
                    style={{
                      background: "var(--gold)",
                    }}
                  >
                    Restrict user
                  </button>
                </form>

                {/* SUSPEND */}

                <form
                  action={suspendUser.bind(null, user.id)}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <p className="font-medium text-sm">Suspend</p>

                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Temporarily block the account from marketplace activity.
                  </p>

                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="Reason for suspension..."
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />

                  <button
                    type="submit"
                    className="w-full rounded-full py-2 text-white text-xs font-medium mt-3"
                    style={{
                      background: "var(--clay)",
                    }}
                  >
                    Suspend user
                  </button>
                </form>

                {/* BAN */}

                <form
                  action={banUser.bind(null, user.id)}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <p className="font-medium text-sm">Ban</p>

                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Permanently block normal marketplace activity.
                  </p>

                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="Reason for ban..."
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />

                  <button
                    type="submit"
                    className="w-full rounded-full py-2 text-white text-xs font-medium mt-3"
                    style={{
                      background: "#555",
                    }}
                  >
                    Ban user
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* LINKS */}

          <div
            className="border-t p-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-3">User activity</h2>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/profile/${user.id}`}
                className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                View public profile
              </Link>

              {user.role === "seller" && (
                <Link
                  href={`/admin/sellers/${user.id}`}
                  className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  View seller account
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="text-xs text-gray-500">{label}</p>

      <p className="text-sm font-medium mt-1 capitalize">{value}</p>
    </div>
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
      bg: "#eeeeee",
      color: "#555555",
    },
  };

  const style = styles[status] ?? styles.active;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
