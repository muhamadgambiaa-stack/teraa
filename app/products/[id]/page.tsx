import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportButton } from "@/components/ReportButton";

import { CONDITION_LABELS, type ProductCondition } from "@/types/database";

import { messageSeller } from "./actions";

async function getProduct(id: string) {
  const supabase = await createClient();

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
      ),

      sellers(
        id,
        business_name,
        verification_status,
        account_status,
        rating_avg,
        total_sales
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

  const sellerRaw = (
    product as {
      sellers?:
        | {
            id: string;
            business_name: string;
            verification_status: string;
            account_status: string;
            rating_avg: number;
            total_sales: number;
          }
        | {
            id: string;
            business_name: string;
            verification_status: string;
            account_status: string;
            rating_avg: number;
            total_sales: number;
          }[];
    }
  ).sellers;

  const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;

  const isVerified = seller?.verification_status === "approved";

  const condition = product.condition as ProductCondition;

  const outOfStock =
    product.status === "out_of_stock" || product.stock_quantity === 0;

  const isOwnListing = Boolean(user && seller && user.id === seller.id);

  /*
   * REVIEW COUNT
   */
  let reviewCount = 0;

  if (seller) {
    const { count } = await supabase
      .from("reviews")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("seller_id", seller.id);

    reviewCount = count ?? 0;
  }

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

        <div className="grid md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-6 lg:gap-10 items-start">
          {/* PRODUCT PHOTOS */}

          <section>
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
                <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center text-gray-400">
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
                    className="w-16 h-16 sm:w-[72px] sm:h-[72px] object-cover rounded-lg border shrink-0 bg-white"
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
                      <span className="truncate">{seller.business_name}</span>

                      {isVerified && <VerifiedIcon />}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      {seller.rating_avg > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <StarIcon />

                          <strong
                            className="font-semibold"
                            style={{
                              color: "var(--ink)",
                            }}
                          >
                            {Number(seller.rating_avg).toFixed(1)}
                          </strong>

                          {reviewCount > 0 && (
                            <span>
                              ({reviewCount}{" "}
                              {reviewCount === 1 ? "review" : "reviews"})
                            </span>
                          )}
                        </span>
                      )}

                      {seller.total_sales > 0 && (
                        <span>
                          {seller.total_sales}{" "}
                          {seller.total_sales === 1 ? "sale" : "sales"}
                        </span>
                      )}

                      {isVerified && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldIcon />
                          Verified
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

                {!isOwnListing && (
                  <form
                    action={messageSeller.bind(null, product.id)}
                    className="mt-4"
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
              </div>
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
   DATE
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
