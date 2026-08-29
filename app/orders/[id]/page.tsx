import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { MessageSellerButton } from "@/components/MessageSellerButton";
import { StarRatingInput } from "@/components/StarRatingInput";

import {
  cancelOrder,
  markOrderReceived,
  messageSellerFromOrder,
  reportOrderNotReceived,
  submitReview,
  updateReview,
} from "./actions";

type PublicSellerProfile = {
  id: string;
  full_name: string;
  city: string | null;
  profile_photo_url: string | null;

  public_role: "buyer" | "seller";

  business_name: string | null;
  verification_status: string | null;

  rating_avg: number | null;
  total_sales: number | null;
};

type DeliveryIssue = {
  status: string;
  reported_at: string;
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/orders/${id}`);
  }

  /*
   * ==========================================================
   * ORDER
   * ==========================================================
   */
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      payment_method,
      payment_status,
      delivery_city,
      delivery_notes,
      created_at,
      buyer_id,
      seller_id,

      order_items(
        product_id,
        quantity,
        price_at_purchase,

        products(
          id,
          title
        )
      ),

      seller_payment_methods(
        provider_name,
        method_type,
        account_name,
        account_number
      )
      `,
    )
    .eq("id", id)
    .single();

  if (error || !order) {
    notFound();
  }

  if (order.buyer_id !== user.id) {
    notFound();
  }

  /*
   * ==========================================================
   * PUBLIC SELLER PROFILE
   * ==========================================================
   */
  const { data: sellerProfileData, error: sellerProfileError } =
    await supabase.rpc("get_public_profile", {
      p_user_id: order.seller_id,
    });

  if (sellerProfileError) {
    console.error("Could not load public seller profile:", sellerProfileError);
  }

  const rawSellerProfile = Array.isArray(sellerProfileData)
    ? sellerProfileData[0]
    : sellerProfileData;

  const publicSeller = rawSellerProfile as PublicSellerProfile | null;

  const seller = publicSeller?.public_role === "seller" ? publicSeller : null;

  const sellerName =
    seller?.business_name ?? seller?.full_name ?? "Teraa seller";

  const sellerVerified = seller?.verification_status === "approved";

  /*
   * ==========================================================
   * ORDER ITEMS
   * ==========================================================
   */
  const items =
    (
      order as {
        order_items?: {
          product_id: string;
          quantity: number;
          price_at_purchase: number;

          products?:
            | {
                id: string;
                title: string;
              }
            | {
                id: string;
                title: string;
              }[];
        }[];
      }
    ).order_items ?? [];

  /*
   * ==========================================================
   * PAYMENT METHOD
   * ==========================================================
   */
  const paymentMethodRaw = (
    order as {
      seller_payment_methods?:
        | {
            provider_name: string;
            method_type: string;
            account_name: string;
            account_number: string;
          }
        | {
            provider_name: string;
            method_type: string;
            account_name: string;
            account_number: string;
          }[];
    }
  ).seller_payment_methods;

  const chosenMethod = Array.isArray(paymentMethodRaw)
    ? paymentMethodRaw[0]
    : paymentMethodRaw;

  const total = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.price_at_purchase),
    0,
  );

  const canCancel = ["placed", "confirmed"].includes(order.status);

  const canMarkReceived = ["shipped", "delivered"].includes(order.status);

  const canReportNotReceived = order.status === "delivered";

  /*
   * ==========================================================
   * DELIVERY ISSUE
   * ==========================================================
   */
  let deliveryIssue: DeliveryIssue | null = null;

  if (order.status === "delivered") {
    const { data: issueData, error: issueError } = await supabase
      .from("order_delivery_issues")
      .select(
        `
        status,
        reported_at
        `,
      )
      .eq("order_id", order.id)
      .maybeSingle();

    if (issueError) {
      console.error("Could not load delivery issue:", issueError);
    }

    deliveryIssue = issueData;
  }

  /*
   * ==========================================================
   * REVIEW
   * ==========================================================
   */
  const reviewItem = items[0] ?? null;

  const reviewProductRaw = reviewItem?.products;

  const reviewProduct = Array.isArray(reviewProductRaw)
    ? reviewProductRaw[0]
    : reviewProductRaw;

  let existingReview: {
    id: string;
    product_id: string | null;
    rating: number;
    comment: string | null;
    updated_at: string | null;
  } | null = null;

  if (order.status === "completed" && reviewItem) {
    const { data } = await supabase
      .from("reviews")
      .select(
        `
        id,
        product_id,
        rating,
        comment,
        updated_at
        `,
      )
      .eq("order_id", order.id)
      .eq("product_id", reviewItem.product_id)
      .maybeSingle();

    existingReview = data;
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 sm:py-8 sm:pb-8">
        {/* ORDER HEADER */}

        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-white"
            style={{
              background: order.status === "cancelled" ? "#888" : "var(--leaf)",
            }}
          >
            {order.status === "cancelled" ? <CloseIcon /> : <CheckIcon />}
          </div>

          <h1
            className="font-display text-xl"
            style={{
              color: "var(--ink)",
            }}
          >
            {order.status === "cancelled"
              ? "Order cancelled"
              : order.status === "completed"
                ? "Order completed"
                : "Your order"}
          </h1>

          <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}</p>

          <OrderStatus status={order.status} />
        </div>

        {/* ORDER ITEMS */}

        <div
          className="rounded-xl border p-4 mb-4 bg-white"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {items.map((item) => {
            const productRaw = item.products;

            const product = Array.isArray(productRaw)
              ? productRaw[0]
              : productRaw;

            return (
              <div
                key={item.product_id}
                className="flex justify-between gap-4 text-sm py-1"
              >
                <span className="min-w-0">
                  {item.quantity} &times; {product?.title ?? "Product"}
                </span>

                <span className="shrink-0">
                  GMD{" "}
                  {(
                    item.quantity * Number(item.price_at_purchase)
                  ).toLocaleString()}
                </span>
              </div>
            );
          })}

          <div
            className="flex justify-between text-sm font-bold pt-2 mt-2 border-t"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <span>Total</span>

            <span
              style={{
                color: "var(--clay)",
              }}
            >
              GMD {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* SELLER */}

        <div
          className="rounded-xl border p-4 mb-4 bg-white"
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
                href={`/profile/${order.seller_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <span className="truncate">{sellerName}</span>

                {sellerVerified && <VerifiedIcon />}
              </Link>

              {sellerVerified && (
                <div
                  className="flex items-center gap-1 mt-1 text-xs"
                  style={{
                    color: "var(--leaf)",
                  }}
                >
                  <ShieldIcon />
                  Verified seller
                </div>
              )}
            </div>

            <Link
              href={`/profile/${order.seller_id}`}
              className="text-xs font-medium shrink-0"
              style={{
                color: "var(--indigo)",
              }}
            >
              View profile
            </Link>
          </div>

          <form
            action={messageSellerFromOrder.bind(null, order.id)}
            className="mt-4"
          >
            <MessageSellerButton />
          </form>
        </div>

        {/* DIGITAL PAYMENT */}

        {order.payment_method === "digital" && (
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "white",
                  color: "var(--gold)",
                }}
              >
                <PaymentIcon />
              </div>

              <div>
                <p className="text-sm font-medium mb-1">
                  Complete your payment
                </p>

                {chosenMethod ? (
                  <p className="text-sm text-gray-700">
                    Send GMD {total.toLocaleString()} to{" "}
                    <strong>{chosenMethod.provider_name}</strong> (
                    {chosenMethod.method_type === "bank"
                      ? "bank transfer"
                      : "mobile money"}
                    ), account name <strong>{chosenMethod.account_name}</strong>
                    , number <strong>{chosenMethod.account_number}</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Contact the seller to arrange payment.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CASH ON DELIVERY */}

        {order.payment_method === "cod" && (
          <div
            className="rounded-xl border p-4 mb-4 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "#f3f4f6",
                  color: "var(--indigo)",
                }}
              >
                <CashIcon />
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Cash on delivery</p>

                <p className="text-sm text-gray-600">
                  Pay when your item arrives in {order.delivery_city}. Inspect
                  it before paying.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY */}

        <div
          className="rounded-xl border p-4 mb-6 text-sm bg-white"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "#f3f4f6",
                color: "var(--indigo)",
              }}
            >
              <LocationIcon />
            </div>

            <div>
              <p className="font-medium mb-1">Delivery</p>

              <p className="text-gray-600">{order.delivery_city}</p>

              {order.delivery_notes && (
                <p className="text-gray-600 mt-1">{order.delivery_notes}</p>
              )}
            </div>
          </div>
        </div>

        {/* CANCEL */}

        {canCancel && (
          <form action={cancelOrder.bind(null, order.id)} className="mb-3">
            <button
              type="submit"
              className="w-full rounded-full py-2.5 text-sm font-semibold border"
              style={{
                borderColor: "var(--clay)",
                color: "var(--clay)",
              }}
            >
              Cancel order
            </button>

            <p className="text-xs text-gray-500 text-center mt-1.5">
              You can cancel before the order is shipped.
            </p>
          </form>
        )}

        {/* DELIVERY CONFIRMATION */}

        {canMarkReceived && (
          <div className="mb-4">
            <form action={markOrderReceived.bind(null, order.id)}>
              <button
                type="submit"
                className="w-full rounded-full py-2.5 text-white text-sm font-semibold"
                style={{
                  background: "var(--leaf)",
                }}
              >
                I&apos;ve received this order
              </button>
            </form>

            {canReportNotReceived && deliveryIssue?.status !== "open" && (
              <form
                action={reportOrderNotReceived.bind(null, order.id)}
                className="mt-3"
              >
                <button
                  type="submit"
                  className="w-full rounded-full py-2.5 text-sm font-semibold border"
                  style={{
                    borderColor: "var(--clay)",
                    color: "var(--clay)",
                  }}
                >
                  I haven&apos;t received this order
                </button>
              </form>
            )}

            <p className="text-xs text-gray-500 text-center mt-2">
              Only confirm after you actually receive and inspect the item.
            </p>
          </div>
        )}

        {/* DELIVERY ISSUE */}

        {deliveryIssue?.status === "open" && (
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              borderColor: "var(--clay)",
              background: "#fffaf7",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "#f8eee9",
                  color: "var(--clay)",
                }}
              >
                <AlertIcon />
              </div>

              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--clay)",
                  }}
                >
                  Delivery issue reported
                </p>

                <p className="text-sm text-gray-600 mt-1 leading-5">
                  You told us that this order has not arrived. The order will
                  remain open while you resolve the delivery with the seller.
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  If the item arrives later, use &ldquo; I&apos;ve received this
                  order &rdquo; to complete the order.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CANCELLED */}

        {order.status === "cancelled" && (
          <div
            className="rounded-xl border p-4 mb-4 text-sm text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            This order has been cancelled. Reserved stock has been returned to
            the seller&apos;s listing.
          </div>
        )}

        {/* NEW PRODUCT REVIEW */}

        {order.status === "completed" &&
          reviewItem &&
          reviewProduct &&
          !existingReview && (
            <form
              action={submitReview}
              className="rounded-xl border p-4 mb-4 bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <input type="hidden" name="orderId" value={order.id} />

              <input
                type="hidden"
                name="productId"
                value={reviewItem.product_id}
              />

              <div className="mb-4">
                <p className="text-sm font-semibold">Rate this product</p>

                <p className="text-xs text-gray-500 mt-1">
                  How was <strong>{reviewProduct.title}</strong>? Was it as
                  described?
                </p>
              </div>

              <StarRatingInput />

              <div className="mt-4">
                <label
                  htmlFor="review-comment"
                  className="text-xs font-medium block mb-1.5"
                >
                  Product review{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>

                <textarea
                  id="review-comment"
                  name="comment"
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe the product quality, condition, and whether it matched the listing."
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />
              </div>

              <button
                type="submit"
                className="rounded-full px-5 py-2 text-xs font-semibold text-white mt-3"
                style={{
                  background: "var(--indigo)",
                }}
              >
                Submit product review
              </button>
            </form>
          )}

        {/* EXISTING REVIEW */}

        {existingReview && reviewProduct && (
          <div
            className="rounded-xl border p-4 mb-4 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Your product review</p>

                <p className="text-xs text-gray-500 mt-1">
                  {reviewProduct.title}
                </p>
              </div>

              {existingReview.updated_at && (
                <span
                  className="rounded-full px-2 py-1 text-[10px] font-medium shrink-0"
                  style={{
                    background: "#f3f4f6",
                    color: "#6b7280",
                  }}
                >
                  Edited
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <StaticStarRating rating={Number(existingReview.rating)} />

              <span className="text-xs text-gray-500">
                {existingReview.rating}/5
              </span>
            </div>

            {existingReview.comment && (
              <p className="text-sm text-gray-600 mt-3 leading-6">
                {existingReview.comment}
              </p>
            )}

            <details
              className="rounded-xl border mt-4 overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <summary
                className="px-4 py-3 text-sm font-medium cursor-pointer list-none select-none flex items-center gap-2"
                style={{
                  color: "var(--indigo)",
                }}
              >
                <EditIcon />
                Edit review
              </summary>

              <form
                action={updateReview}
                className="border-t p-4"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <input
                  type="hidden"
                  name="reviewId"
                  value={existingReview.id}
                />

                <div>
                  <p className="text-xs font-medium mb-2">Your rating</p>

                  <StarRatingInput
                    name="rating"
                    defaultValue={Number(existingReview.rating)}
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="edit-review-comment"
                    className="text-xs font-medium block mb-1.5"
                  >
                    Product review{" "}
                    <span className="font-normal text-gray-400">
                      (optional)
                    </span>
                  </label>

                  <textarea
                    id="edit-review-comment"
                    name="comment"
                    rows={3}
                    maxLength={1000}
                    defaultValue={existingReview.comment ?? ""}
                    placeholder="Describe the product quality, condition, and whether it matched the listing."
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-full px-5 py-2.5 text-xs font-semibold text-white mt-3"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  Save review changes
                </button>
              </form>
            </details>
          </div>
        )}

        {/* CONTINUE */}

        <Link
          href="/"
          className="block text-center rounded-full py-2.5 text-sm font-medium border"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          Continue browsing
        </Link>
      </main>
    </>
  );
}

/*
 * ============================================================
 * STATUS
 * ============================================================
 */
function OrderStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    placed: "Order placed",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <span
      className="inline-flex mt-2 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: status === "cancelled" ? "#eee" : "#e6edf3",

        color: status === "cancelled" ? "#666" : "var(--indigo)",
      }}
    >
      {labels[status] ?? status}
    </span>
  );
}

/*
 * ============================================================
 * STAR RATING
 * ============================================================
 */
function StaticStarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={value <= rating ? "currentColor" : "none"}
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

/*
 * ============================================================
 * ICONS
 * ============================================================
 */
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      style={{
        color: "var(--leaf)",
      }}
      aria-label="Verified seller"
    >
      <path d="M12 2l2.4 1.9 3-.5 1.1 2.9 2.9 1.1-.5 3L23 12l-1.9 2.4.5 3-2.9 1.1-1.1 2.9-3-.5L12 23l-2.4-1.9-3 .5-1.1-2.9-2.9-1.1.5-3L1 12l1.9-2.4-.5-3 2.9-1.1L6.4 2.6l3 .5L12 2Z" />

      <path
        d="m9 12 2 2 4-4"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertIcon() {
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
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.8 2.4 17.5A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.5L13.7 3.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function EditIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function PaymentIcon() {
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
      <rect x="3" y="6" width="18" height="12" rx="2" />

      <circle cx="12" cy="12" r="2.5" />

      <path d="M7 9H5v2M17 15h2v-2" />
    </svg>
  );
}

function LocationIcon() {
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
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}


