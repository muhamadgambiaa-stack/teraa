import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import { banUser, restrictUser, restoreUser, suspendUser } from "../actions";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_id: string;
  seller_id: string;
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { supabase, user: admin } = await requireAdmin();

  /*
   * USER
   */
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

  /*
   * REVIEWS WRITTEN BY USER
   */
  const { data: writtenReviewData } = await supabase
    .from("reviews")
    .select(
      `
        id,
        rating,
        comment,
        created_at,
        buyer_id,
        seller_id
        `,
    )
    .eq("buyer_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  const writtenReviews = (writtenReviewData ?? []) as ReviewRow[];

  /*
   * REVIEWS RECEIVED
   *
   * This may be empty for buyers.
   */
  const { data: receivedReviewData } = await supabase
    .from("reviews")
    .select(
      `
        id,
        rating,
        comment,
        created_at,
        buyer_id,
        seller_id
        `,
    )
    .eq("seller_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  const receivedReviews = (receivedReviewData ?? []) as ReviewRow[];

  /*
   * Get names for people connected
   * to these reviews.
   */
  const relatedUserIds = Array.from(
    new Set([
      ...writtenReviews.map((review) => review.seller_id),

      ...receivedReviews.map((review) => review.buyer_id),
    ]),
  ).filter(Boolean);

  const relatedUsers = new Map<
    string,
    {
      full_name: string;
      profile_photo_url: string | null;
    }
  >();

  if (relatedUserIds.length > 0) {
    const { data: people } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        profile_photo_url
        `,
      )
      .in("id", relatedUserIds);

    for (const person of people ?? []) {
      relatedUsers.set(person.id, {
        full_name: person.full_name,
        profile_photo_url: person.profile_photo_url,
      });
    }
  }

  /*
   * SELLER BUSINESS NAMES
   */
  const sellerIds = Array.from(
    new Set(writtenReviews.map((review) => review.seller_id)),
  ).filter(Boolean);

  const sellerNames = new Map<string, string>();

  if (sellerIds.length > 0) {
    const { data: sellers } = await supabase
      .from("sellers")
      .select(
        `
        id,
        business_name
        `,
      )
      .in("id", sellerIds);

    for (const seller of sellers ?? []) {
      sellerNames.set(seller.id, seller.business_name);
    }
  }

  /*
   * AVERAGE RECEIVED RATING
   */
  const averageReceivedRating =
    receivedReviews.length > 0
      ? receivedReviews.reduce(
          (total, review) => total + Number(review.rating),
          0,
        ) / receivedReviews.length
      : null;

  const isOwnAccount = admin.id === user.id;

  const isAdminAccount = user.role === "admin";

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:underline"
        >
          <ArrowLeftIcon />
          Back to users
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

          {/* REVIEW SUMMARY */}

          <div
            className="border-t p-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold">Review activity</h2>

            <p className="text-sm text-gray-500 mt-1 mb-4">
              Reviews written and received by this marketplace account.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ReviewStat
                value={String(writtenReviews.length)}
                label="Reviews written"
              />

              <ReviewStat
                value={String(receivedReviews.length)}
                label="Reviews received"
              />

              <ReviewStat
                value={
                  averageReceivedRating !== null
                    ? averageReceivedRating.toFixed(1)
                    : "—"
                }
                label="Seller rating"
                wide
              />
            </div>
          </div>

          {/* REVIEWS RECEIVED */}

          {receivedReviews.length > 0 && (
            <div
              className="border-t p-6"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold">Reviews received</h2>

                  <p className="text-xs text-gray-500 mt-1">
                    What buyers have said about this seller.
                  </p>
                </div>

                {averageReceivedRating !== null && (
                  <div className="flex items-center gap-2">
                    <StaticStarRating rating={averageReceivedRating} />

                    <span className="text-sm font-semibold">
                      {averageReceivedRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                {receivedReviews.map((review) => {
                  const reviewer = relatedUsers.get(review.buyer_id);

                  return (
                    <ReviewItem
                      key={review.id}
                      review={review}
                      personName={reviewer?.full_name ?? "Teraa buyer"}
                      photoUrl={reviewer?.profile_photo_url ?? null}
                      profileHref={`/admin/users/${review.buyer_id}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* REVIEWS WRITTEN */}

          {writtenReviews.length > 0 && (
            <div
              className="border-t p-6"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <h2 className="font-semibold">Reviews written</h2>

              <p className="text-xs text-gray-500 mt-1 mb-4">
                Reviews this user has left for sellers.
              </p>

              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                {writtenReviews.map((review) => {
                  const sellerName =
                    sellerNames.get(review.seller_id) ??
                    relatedUsers.get(review.seller_id)?.full_name ??
                    "Teraa seller";

                  const sellerUser = relatedUsers.get(review.seller_id);

                  return (
                    <ReviewItem
                      key={review.id}
                      review={review}
                      personName={sellerName}
                      photoUrl={sellerUser?.profile_photo_url ?? null}
                      profileHref={`/admin/users/${review.seller_id}`}
                      prefix="Review for"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* NO REVIEWS */}

          {receivedReviews.length === 0 && writtenReviews.length === 0 && (
            <div
              className="border-t p-6"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <div
                className="rounded-xl border p-8 text-center"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-full mx-auto flex items-center justify-center"
                  style={{
                    background: "#fbf3df",
                    color: "var(--gold)",
                  }}
                >
                  <StarIcon size={20} />
                </div>

                <p className="text-sm font-medium mt-3">No review activity</p>

                <p className="text-xs text-gray-500 mt-1">
                  This user has not written or received any reviews.
                </p>
              </div>
            </div>
          )}

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

/* --------------------------------
   REVIEW ITEM
-------------------------------- */

function ReviewItem({
  review,
  personName,
  photoUrl,
  profileHref,
  prefix,
}: {
  review: ReviewRow;
  personName: string;
  photoUrl: string | null;
  profileHref: string;
  prefix?: string;
}) {
  const initial = personName.trim().charAt(0).toUpperCase() || "T";

  return (
    <div
      className="p-4 border-b last:border-b-0"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <div className="flex items-start gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={personName}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
            style={{
              background: "var(--indigo)",
            }}
          >
            {initial}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              {prefix && <p className="text-[10px] text-gray-400">{prefix}</p>}

              <Link
                href={profileHref}
                className="text-sm font-medium hover:underline"
              >
                {personName}
              </Link>

              <div className="mt-1">
                <StaticStarRating rating={Number(review.rating)} />
              </div>
            </div>

            <span className="text-[10px] text-gray-400 shrink-0">
              {formatReviewDate(review.created_at)}
            </span>
          </div>

          {review.comment && (
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------
   REVIEW STAT
-------------------------------- */

function ReviewStat({
  value,
  label,
  wide = false,
}: {
  value: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        wide ? "col-span-2 sm:col-span-1" : ""
      }`}
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="text-xl font-bold">{value}</p>

      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/* --------------------------------
   STAR RATING
-------------------------------- */

function StaticStarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon key={value} filled={value <= Math.round(rating)} />
      ))}
    </div>
  );
}

function StarIcon({
  filled = false,
  size = 14,
}: {
  filled?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        color: "var(--gold)",
      }}
      aria-hidden="true"
    >
      <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" />
    </svg>
  );
}

/* --------------------------------
   ACCOUNT INFO
-------------------------------- */

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

/* --------------------------------
   USER STATUS
-------------------------------- */

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

/* --------------------------------
   BACK ICON
-------------------------------- */

function ArrowLeftIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />

      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/* --------------------------------
   DATE
-------------------------------- */

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
