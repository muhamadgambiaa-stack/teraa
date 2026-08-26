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

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <nav className="text-xs text-gray-500 mb-4">
          <Link href="/" className="hover:underline">
            Home
          </Link>

          {" / "}

          {product.title}
        </nav>

        <div className="grid md:grid-cols-2 gap-8">
          {/* PRODUCT PHOTOS */}

          <div>
            <div
              className="aspect-square rounded-xl overflow-hidden"
              style={{
                background: "var(--sand)",
              }}
            >
              {sortedPhotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sortedPhotos[0].photo_url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                  No photo provided
                </div>
              )}
            </div>

            {sortedPhotos.length > 1 && (
              <div className="grid grid-cols-5 gap-2 mt-2">
                {sortedPhotos.slice(1, 6).map((photo, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    src={photo.photo_url}
                    alt=""
                    className="aspect-square object-cover rounded-lg border"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* PRODUCT DETAILS */}

          <div>
            <h1
              className="font-display text-2xl mb-2"
              style={{
                color: "var(--ink)",
              }}
            >
              {product.title}
            </h1>

            <p
              className="text-2xl font-bold mb-3"
              style={{
                color: "var(--clay)",
              }}
            >
              GMD {Number(product.price).toLocaleString()}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "var(--sand)",
                  color: "var(--ink)",
                }}
              >
                {CONDITION_LABELS[condition]}
              </span>

              <span
                className="rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1"
                style={{
                  background: "var(--sand)",
                  color: "var(--ink)",
                }}
              >
                📍 {product.location_city}
              </span>

              {outOfStock && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-red-100 text-red-700">
                  Out of stock
                </span>
              )}
            </div>

            {/* SELLER */}

            {seller && (
              <div
                className="rounded-xl border p-4 mb-4 bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${seller.id}`}
                      className="text-sm font-semibold flex items-center gap-1 hover:underline"
                    >
                      {seller.business_name}

                      {isVerified && (
                        <span
                          style={{
                            color: "var(--leaf)",
                          }}
                          title="ID-verified seller"
                        >
                          ✓
                        </span>
                      )}
                    </Link>

                    <p className="text-xs text-gray-500 mt-1">
                      {isVerified ? "Verified seller" : "Seller"}

                      {seller.rating_avg > 0 &&
                        ` · ${Number(seller.rating_avg).toFixed(1)}★`}

                      {seller.total_sales > 0 &&
                        ` · ${seller.total_sales} sales`}
                    </p>
                  </div>

                  <Link
                    href={`/profile/${seller.id}`}
                    className="text-xs font-medium underline shrink-0"
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
                      className="w-full rounded-full border py-2.5 text-sm font-medium"
                      style={{
                        borderColor: "var(--indigo)",
                        color: "var(--indigo)",
                      }}
                    >
                      💬 Message seller
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* PAYMENT */}

            <div
              className="rounded-lg border p-3 mb-6 text-xs space-y-1.5"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <p className="font-medium text-sm mb-1">Payment options</p>

              <p>
                💳 Bank transfer or mobile money: you and the seller arrange the
                transfer directly
              </p>

              <p>💵 Cash on delivery: inspect the item before you pay</p>

              <p className="text-gray-500 pt-1">
                Teraa verifies seller identity but does not hold funds in
                escrow. Meet in a public place and inspect items before paying
                cash.
              </p>
            </div>

            {/* BUY */}

            {!isOwnListing ? (
              <Link
                href={outOfStock ? "#" : `/products/${product.id}/checkout`}
                aria-disabled={outOfStock}
                className="block w-full text-center rounded-full py-3 text-white text-sm font-semibold"
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

            {/* DESCRIPTION */}

            {product.description && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-1">Description</p>

                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* REPORT */}

            {!isOwnListing && (
              <div className="mt-6">
                <ReportButton targetType="product" targetId={product.id} />
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
