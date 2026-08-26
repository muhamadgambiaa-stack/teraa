import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";

type PublicProfile = {
  id: string;
  full_name: string;
  city: string | null;
  profile_photo_url: string | null;
  public_role: "buyer" | "seller";

  business_name: string | null;
  shop_description: string | null;
  shop_banner_url: string | null;

  verification_status: string | null;
  rating_avg: number | null;
  total_sales: number | null;

  member_since: string | null;
};

type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_id: string;

  users:
    | {
        full_name: string;
        profile_photo_url: string | null;
      }
    | {
        full_name: string;
        profile_photo_url: string | null;
      }[]
    | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  /*
   * Public profile data comes through the RPC
   * so private user information is not exposed.
   */
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_user_id: id,
  });

  if (error || !data || data.length === 0) {
    notFound();
  }

  const profile = data[0] as PublicProfile;

  const isSeller = profile.public_role === "seller";

  /*
   * PUBLIC SELLER LISTINGS
   */
  let products: any[] = [];

  if (isSeller) {
    const { data: listingData } = await supabase
      .from("products")
      .select(
        `
        *,
        product_photos(
          photo_url,
          is_cover
        ),
        sellers(
          business_name,
          verification_status
        )
        `,
      )
      .eq("seller_id", profile.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      });

    products = listingData ?? [];
  }

  /*
   * PUBLIC REVIEWS
   *
   * We only fetch the review itself and the
   * buyer's public display information.
   */
  let reviews: PublicReview[] = [];

  if (isSeller) {
    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        buyer_id,
        users:buyer_id(
          full_name,
          profile_photo_url
        )
        `,
      )
      .eq("seller_id", profile.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (reviewError) {
      console.error("Couldn't load seller reviews:", reviewError);
    } else {
      reviews = (reviewData ?? []) as PublicReview[];
    }
  }

  const reviewCount = reviews.length;

  /*
   * Calculate rating directly from reviews.
   *
   * This means the number displayed beside
   * the reviews always matches the visible data.
   */
  const averageRating =
    reviewCount > 0
      ? reviews.reduce((total, review) => total + Number(review.rating), 0) /
        reviewCount
      : 0;

  const displayName =
    isSeller && profile.business_name
      ? profile.business_name
      : profile.full_name;

  const initial = displayName?.trim().charAt(0).toUpperCase() || "T";

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto pb-24 sm:pb-8">
        {/* SELLER BANNER */}

        {isSeller && profile.shop_banner_url && (
          <div className="w-full h-36 sm:h-52 overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.shop_banner_url}
              alt={`${displayName} shop banner`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-4">
          {/* PROFILE HEADER */}

          <section
            className={
              isSeller && profile.shop_banner_url ? "-mt-8 relative" : "pt-6"
            }
          >
            <div className="flex items-start gap-4">
              {profile.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profile_photo_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white bg-white shrink-0"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center text-2xl text-white font-bold shrink-0"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {initial}
                </div>
              )}

              <div className="min-w-0 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="font-display text-2xl font-bold"
                    style={{
                      color: "var(--ink)",
                    }}
                  >
                    {displayName}
                  </h1>

                  {isSeller && profile.verification_status === "approved" && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
                      style={{
                        background: "#e3f0e8",
                        color: "var(--leaf)",
                      }}
                    >
                      <VerifiedIcon />
                      Verified seller
                    </span>
                  )}
                </div>

                {isSeller &&
                  profile.business_name &&
                  profile.full_name !== profile.business_name && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {profile.full_name}
                    </p>
                  )}

                {profile.city && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <LocationIcon />

                    <span>{profile.city}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SELLER STATS */}

          {isSeller && (
            <section
              className="grid grid-cols-3 rounded-xl border bg-white mt-6 overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <ProfileStat
                value={reviewCount > 0 ? averageRating.toFixed(1) : "—"}
                label="Rating"
              />

              <ProfileStat
                value={String(profile.total_sales ?? 0)}
                label="Sales"
              />

              <ProfileStat value={String(reviewCount)} label="Reviews" last />
            </section>
          )}

          {/* ABOUT */}

          <section
            className="rounded-xl border bg-white p-4 mt-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold">About</h2>

            {isSeller && profile.shop_description ? (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                {profile.shop_description}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                Teraa marketplace member
                {profile.city ? ` from ${profile.city}` : ""}.
              </p>
            )}

            {profile.member_since && (
              <p className="text-xs text-gray-400 mt-3">
                Member since{" "}
                {new Date(profile.member_since).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </section>

          {/* REVIEWS */}

          {isSeller && (
            <section className="mt-8">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-xl">Reviews</h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {reviewCount === 0
                      ? "No reviews yet"
                      : `${reviewCount} ${
                          reviewCount === 1 ? "review" : "reviews"
                        }`}
                  </p>
                </div>

                {reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating rating={averageRating} />

                    <span className="text-sm font-semibold">
                      {averageRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div
                  className="rounded-xl border p-8 text-center bg-white"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div
                    className="w-11 h-11 mx-auto rounded-full flex items-center justify-center"
                    style={{
                      background: "#fbf3df",
                      color: "var(--gold)",
                    }}
                  >
                    <StarIcon size={20} />
                  </div>

                  <p className="font-medium text-sm mt-3">No reviews yet</p>

                  <p className="text-xs text-gray-500 mt-1">
                    Reviews from completed orders will appear here.
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-xl border bg-white overflow-hidden"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  {reviews.map((review) => {
                    const buyerRaw = review.users;

                    const buyer = Array.isArray(buyerRaw)
                      ? buyerRaw[0]
                      : buyerRaw;

                    const buyerName = buyer?.full_name || "Teraa buyer";

                    const buyerInitial =
                      buyerName.trim().charAt(0).toUpperCase() || "T";

                    return (
                      <article
                        key={review.id}
                        className="p-4 border-b last:border-b-0"
                        style={{
                          borderColor: "var(--sand)",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {buyer?.profile_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={buyer.profile_photo_url}
                              alt={buyerName}
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xs text-white font-semibold shrink-0"
                              style={{
                                background: "var(--indigo)",
                              }}
                            >
                              {buyerInitial}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {buyerName}
                                </p>

                                <div className="mt-1">
                                  <StarRating
                                    rating={Number(review.rating)}
                                    small
                                  />
                                </div>
                              </div>

                              <time className="text-[10px] text-gray-400 shrink-0">
                                {formatReviewDate(review.created_at)}
                              </time>
                            </div>

                            {review.comment && (
                              <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">
                                {review.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SELLER PRODUCTS */}

          {isSeller && (
            <section className="mt-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-xl">Listings</h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {products.length} active{" "}
                    {products.length === 1 ? "listing" : "listings"}
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <div
                  className="rounded-xl border p-8 text-center text-sm text-gray-500"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  No active listings.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* BUYER PROFILE */}

          {!isSeller && (
            <section className="mt-6">
              <div
                className="rounded-xl border p-5 text-sm text-gray-500"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                This is a Teraa buyer profile. Purchase history, contact
                information and payment information are private.
              </div>
            </section>
          )}

          <div className="mt-8">
            <Link href="/" className="text-sm underline text-gray-500">
              Continue browsing
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

/* -----------------------------
   PROFILE STAT
----------------------------- */

function ProfileStat({
  value,
  label,
  last = false,
}: {
  value: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`text-center px-2 py-4 ${last ? "" : "border-r"}`}
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="font-semibold text-sm">{value}</p>

      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/* -----------------------------
   STAR RATING
----------------------------- */

function StarRating({
  rating,
  small = false,
}: {
  rating: number;
  small?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);

        return <StarIcon key={star} filled={filled} size={small ? 13 : 15} />;
      })}
    </div>
  );
}

function StarIcon({
  filled = false,
  size = 16,
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

/* -----------------------------
   LOCATION ICON
----------------------------- */

function LocationIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/* -----------------------------
   VERIFIED ICON
----------------------------- */

function VerifiedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* -----------------------------
   REVIEW DATE
----------------------------- */

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
