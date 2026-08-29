import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportButton } from "@/components/ReportButton";
import { ProductGallery } from "@/components/ProductGallery";

import { CONDITION_LABELS, type ProductCondition } from "@/types/database";

import { messageSeller } from "./actions";

type ProductReview = {
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

type PublicSellerProfile = {
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

async function getProduct(id: string) {
  const supabase = await createClient();

  /*
   * Do not join directly to public.sellers here.
   *
   * That table is intentionally protected by RLS.
   * Public seller information is loaded separately
   * through get_public_profile().
   */
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      seller_id,
      title,
      description,
      price,
      stock_quantity,
      status,
      condition,
      location_city,
      created_at,

      product_photos(
        photo_url,
        is_cover,
        sort_order
      )
      `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * ----------------------------------------------------------
   * PRODUCT PHOTOS
   * ----------------------------------------------------------
   */

  const photos =
    (
      product as {
        product_photos?: {
          photo_url: string;
          is_cover: boolean;
          sort_order: number;
        }[];
      }
    ).product_photos ?? [];

  const sortedPhotos = [...photos].sort(
    (a, b) =>
      (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) ||
      a.sort_order - b.sort_order,
  );

  /*
   * ----------------------------------------------------------
   * PUBLIC SELLER PROFILE
   * ----------------------------------------------------------
   *
   * This is the safe public seller source used by Teraa.
   *
   * Buyers and other sellers do not need direct SELECT access
   * to the private sellers table.
   */

  const { data: publicSellerData, error: publicSellerError } =
    await supabase.rpc("get_public_profile", {
      p_user_id: product.seller_id,
    });

  if (publicSellerError) {
    console.error("Could not load public seller profile:", publicSellerError);
  }

  const rawPublicSeller = Array.isArray(publicSellerData)
    ? publicSellerData[0]
    : publicSellerData;

  const publicSeller = rawPublicSeller as PublicSellerProfile | null;

  const seller = publicSeller?.public_role === "seller" ? publicSeller : null;

  const isVerified = seller?.verification_status === "approved";

  const sellerSales = Number(seller?.total_sales ?? 0);

  /*
   * ----------------------------------------------------------
   * PRODUCT STATE
   * ----------------------------------------------------------
   */

  const condition = product.condition as ProductCondition;

  const outOfStock =
    product.status === "out_of_stock" || product.stock_quantity === 0;

  /*
   * Ownership must come directly from the product.
   *
   * Do not depend on whether another user's public seller
   * profile was returned.
   */
  const isOwnListing = Boolean(user && user.id === product.seller_id);

  /*
   * ----------------------------------------------------------
   * PRODUCT REVIEWS
   * ----------------------------------------------------------
   */

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
    .eq("product_id", product.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (reviewError) {
    console.error("Could not load product reviews:", reviewError);
  }

  const reviews = (reviewData ?? []) as ProductReview[];

  const reviewCount = reviews.length;

  const productRating =
    reviewCount > 0
      ? reviews.reduce((total, review) => total + Number(review.rating), 0) /
        reviewCount
      : 0;

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-7 pb-24 sm:pb-8">
        {/* BREADCRUMB */}

        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 overflow-hidden">
          <Link href="/" className="hover:underline shrink-0">
            Home
          </Link>

          <ChevronRightIcon />

          <span className="truncate">{product.title}</span>
        </nav>

        {/* MAIN PRODUCT AREA */}

        <div className="grid md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 lg:gap-9 items-start">
          {/* PRODUCT PHOTOS */}

          <section className="w-full max-w-[420px] mx-auto md:mx-0">
            <div
              className="w-full rounded-xl overflow-hidden flex items-center justify-center"
              style={{
                background: "var(--sand)",
                aspectRatio: "4 / 3",
              }}
            >
              {sortedPhotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sortedPhotos[0].photo_url}
                  alt={product.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon />

                  <p className="text-xs mt-2">No photo provided</p>
                </div>
              )}
            </div>

            {/* THUMBNAILS */}

            {sortedPhotos.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {sortedPhotos.slice(1, 6).map((photo, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    src={photo.photo_url}
                    alt={`${product.title} photo ${index + 2}`}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border shrink-0 bg-white"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* PRODUCT DETAILS */}

          <section className="min-w-0">
            <h1
              className="font-display text-xl sm:text-2xl font-semibold leading-tight"
              style={{
                color: "var(--ink)",
              }}
            >
              {product.title}
            </h1>

            <p
              className="text-2xl sm:text-3xl font-bold mt-2"
              style={{
                color: "var(--clay)",
              }}
            >
              GMD {Number(product.price).toLocaleString()}
            </p>

            {/* PRODUCT RATING */}

            {reviewCount > 0 && (
              <a
                href="#product-reviews"
                className="inline-flex items-center gap-2 mt-2 text-xs hover:underline"
              >
                <StaticStarRating rating={productRating} size={14} />

                <strong
                  style={{
                    color: "var(--ink)",
                  }}
                >
                  {productRating.toFixed(1)}
                </strong>

                <span className="text-gray-500">
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </span>
              </a>
            )}

            {/* PRODUCT META */}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: "var(--sand)",
                  color: "var(--ink)",
                }}
              >
                {CONDITION_LABELS[condition]}
              </span>

              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
                style={{
                  background: "var(--sand)",
                  color: "var(--ink)",
                }}
              >
                <LocationIcon />

                {product.location_city}
              </span>

              {outOfStock && (
                <span className="rounded-full px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700">
                  Out of stock
                </span>
              )}
            </div>

            {/* SELLER */}

            {seller && (
              <div
                className="rounded-xl border p-4 mt-5 bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                      Seller
                    </p>

                    <Link
                      href={`/profile/${seller.id}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-sm hover:underline"
                    >
                      <span className="truncate">
                        {seller.business_name ?? seller.full_name}
                      </span>

                      {isVerified && <VerifiedIcon />}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      {sellerSales > 0 && (
                        <span>
                          {sellerSales} {sellerSales === 1 ? "sale" : "sales"}
                        </span>
                      )}

                      {isVerified && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldIcon />
                          Verified seller
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/profile/${seller.id}`}
                    className="text-xs font-medium shrink-0"
                    style={{
                      color: "var(--indigo)",
                    }}
                  >
                    View profile
                  </Link>
                </div>
              </div>
            )}

            {/* MESSAGE SELLER
                Keep contact independent from seller-card visibility.
                messageSeller() performs its own secure seller checks.
            */}

            {!isOwnListing && (
              <form
                action={messageSeller.bind(null, product.id)}
                className={seller ? "mt-3" : "mt-5"}
              >
                <button
                  type="submit"
                  className="w-full rounded-full border py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-gray-50"
                  style={{
                    borderColor: "var(--indigo)",
                    color: "var(--indigo)",
                  }}
                >
                  <MessageIcon />
                  Message seller
                </button>
              </form>
            )}

            {/* PAYMENT */}

            <div
              className="rounded-xl border p-4 mt-4"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <PaymentIcon />

                <h2 className="text-sm font-semibold">Payment options</h2>
              </div>

              <div className="space-y-3">
                <PaymentRow
                  icon={<CardIcon />}
                  title="Bank transfer or mobile money"
                  description="Arrange payment directly with the seller."
                />

                <PaymentRow
                  icon={<CashIcon />}
                  title="Cash on delivery"
                  description="Inspect the item before you pay."
                />
              </div>

              <div
                className="border-t mt-4 pt-3"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start gap-2">
                  <ShieldIcon />

                  <p className="text-xs leading-relaxed text-gray-500">
                    Teraa verifies seller identity but does not hold funds in
                    escrow. Meet in a public place and inspect items before
                    paying cash.
                  </p>
                </div>
              </div>
            </div>

            {/* BUY */}

            <div className="mt-5">
              {!isOwnListing ? (
                <Link
                  href={outOfStock ? "#" : `/products/${product.id}/checkout`}
                  aria-disabled={outOfStock}
                  className="block w-full text-center rounded-full py-3 text-white text-sm font-semibold transition-opacity"
                  style={{
                    background: outOfStock ? "#c9c9c0" : "var(--indigo)",

                    pointerEvents: outOfStock ? "none" : "auto",
                  }}
                >
                  {outOfStock ? "Out of stock" : "Buy now"}
                </Link>
              ) : (
                <Link
                  href={`/seller/dashboard/products/${product.id}`}
                  className="block w-full text-center rounded-full py-3 text-white text-sm font-semibold"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  Manage your listing
                </Link>
              )}
            </div>

            {/* DESCRIPTION */}

            {product.description && (
              <div
                className="mt-6 pt-5 border-t"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <h2 className="text-sm font-semibold">Description</h2>

                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mt-2">
                  {product.description}
                </p>
              </div>
            )}

            {/* LISTING INFO */}

            <div
              className="mt-5 pt-4 border-t"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <p className="text-xs text-gray-400">
                Listed {formatListingDate(product.created_at)}
              </p>
            </div>

            {/* REPORT */}

            {!isOwnListing && (
              <div className="mt-5">
                <ReportButton targetType="product" targetId={product.id} />
              </div>
            )}
          </section>
        </div>

        {/* PRODUCT REVIEWS */}

        <section id="product-reviews" className="mt-10 sm:mt-12 scroll-mt-24">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2
                className="font-display text-xl"
                style={{
                  color: "var(--ink)",
                }}
              >
                Product reviews
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                Reviews from buyers who purchased this product through Teraa.
              </p>
            </div>

            {reviewCount > 0 && (
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1.5">
                  <StarIcon />

                  <span
                    className="font-bold text-lg"
                    style={{
                      color: "var(--ink)",
                    }}
                  >
                    {productRating.toFixed(1)}
                  </span>
                </div>

                <p className="text-[10px] text-gray-500">
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </p>
              </div>
            )}
          </div>

          {reviewCount === 0 ? (
            <div
              className="rounded-xl border bg-white p-7 text-center"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full mx-auto flex items-center justify-center"
                style={{
                  background: "#fbf3df",
                  color: "var(--gold)",
                }}
              >
                <StarOutlineIcon />
              </div>

              <p className="text-sm font-medium mt-3">No product reviews yet</p>

              <p className="text-xs text-gray-500 mt-1">
                Reviews will appear after buyers complete their orders.
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

                const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

                const reviewerName = buyer?.full_name?.trim() || "Teraa buyer";

                const initial = reviewerName.charAt(0).toUpperCase() || "T";

                return (
                  <article
                    key={review.id}
                    className="p-4 sm:p-5 border-b last:border-b-0"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {buyer?.profile_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={buyer.profile_photo_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-white font-semibold shrink-0"
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
                            <p className="text-sm font-medium">
                              {reviewerName}
                            </p>

                            <div className="mt-1">
                              <StaticStarRating
                                rating={Number(review.rating)}
                                size={13}
                              />
                            </div>
                          </div>

                          <time className="text-[10px] text-gray-400 shrink-0">
                            {formatReviewDate(review.created_at)}
                          </time>
                        </div>

                        {review.comment ? (
                          <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">
                            {review.comment}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-3">
                            Buyer left a rating without a written review.
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
      </main>
    </>
  );
}

/* --------------------------------
   PAYMENT ROW
-------------------------------- */

function PaymentRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "#f3f4f6",
          color: "var(--indigo)",
        }}
      >
        {icon}
      </div>

      <div>
        <p className="text-xs font-medium">{title}</p>

        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/* --------------------------------
   STAR RATING
-------------------------------- */

function StaticStarRating({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
  const roundedRating = Math.round(rating);

  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={value <= roundedRating ? "currentColor" : "none"}
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
      ))}
    </div>
  );
}

/* --------------------------------
   ICONS
-------------------------------- */

function LocationIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{
        color: "var(--leaf)",
      }}
      aria-label="Verified seller"
    >
      <path d="M12 2l2.4 1.9 3-.5 1.1 2.9 2.9 1.1-.5 3L23 12l-1.9 2.4.5 3-2.9 1.1-1.1 2.9-3-.5L12 23l-2.4-1.9-3 .5-1.1-2.9-2.9-1.1.5-3L1 12l1.9-2.4-.5-3 2.9-1.1L6.4 2.6l3 .5L12 2Z" />

      <path
        d="m8.5 12 2.2 2.2 4.8-4.8"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
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

function StarOutlineIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" />
    </svg>
  );
}

function ShieldIcon() {
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
      className="shrink-0"
      style={{
        color: "var(--leaf)",
      }}
      aria-hidden="true"
    >
      <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />

      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        color: "var(--indigo)",
      }}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />

      <path d="M3 10h18" />
    </svg>
  );
}

function CardIcon() {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />

      <path d="M3 10h18M7 15h3" />
    </svg>
  );
}

function CashIcon() {
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
      <rect x="3" y="6" width="18" height="12" rx="2" />

      <circle cx="12" cy="12" r="2.5" />

      <path d="M7 9H5v2M17 15h2v-2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />

      <circle cx="8.5" cy="8.5" r="1.5" />

      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* --------------------------------
   DATES
-------------------------------- */

function formatListingDate(value: string) {
  const date = new Date(value);
  const now = new Date();

  const difference = now.getTime() - date.getTime();

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
