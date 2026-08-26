import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { StarRatingInput } from "@/components/StarRatingInput";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cancelOrder, markOrderReceived, submitReview } from "./actions";

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

      order_items(
        quantity,
        price_at_purchase,
        products(title)
      ),

      sellers(
        id,
        business_name,
        verification_status
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

  /*
   * RLS protects the order too, but we also
   * verify ownership at the page level.
   */
  if (order.buyer_id !== user.id) {
    notFound();
  }

  const items =
    (
      order as {
        order_items?: {
          quantity: number;
          price_at_purchase: number;

          products?:
            | {
                title: string;
              }
            | {
                title: string;
              }[];
        }[];
      }
    ).order_items ?? [];

  const sellerRaw = (
    order as {
      sellers?:
        | {
            id: string;
            business_name: string;
          }
        | {
            id: string;
            business_name: string;
          }[];
    }
  ).sellers;

  const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;

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

  /*
   * Buyers may cancel only before shipping.
   */
  const canCancel = ["placed", "confirmed"].includes(order.status);

  /*
   * Buyers may only confirm receipt once
   * shipping has started.
   */
  const canMarkReceived = ["shipped", "delivered"].includes(order.status);

  /*
   * Look for an existing review only after
   * the order has been completed.
   */
  let existingReview: {
    id: string;
    rating: number;
    comment: string | null;
  } | null = null;

  if (order.status === "completed") {
    const { data } = await supabase
      .from("reviews")
      .select(
        `
        id,
        rating,
        comment
        `,
      )
      .eq("order_id", order.id)
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
          {items.map((item, index) => {
            const productTitle = Array.isArray(item.products)
              ? item.products[0]?.title
              : item.products?.title;

            return (
              <div
                key={index}
                className="flex justify-between gap-4 text-sm py-1"
              >
                <span>
                  {item.quantity} × {productTitle}
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

        {/* RECEIVED */}

        {canMarkReceived && (
          <form
            action={markOrderReceived.bind(null, order.id)}
            className="mb-4"
          >
            <button
              type="submit"
              className="w-full rounded-full py-2.5 text-white text-sm font-semibold"
              style={{
                background: "var(--leaf)",
              }}
            >
              I&apos;ve received this order
            </button>

            <p className="text-xs text-gray-500 text-center mt-1.5">
              Only confirm after you actually receive and inspect the item.
            </p>
          </form>
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

        {/* REVIEW FORM */}

        {order.status === "completed" && seller && !existingReview && (
          <form
            action={submitReview}
            className="rounded-xl border p-4 mb-4 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <input type="hidden" name="orderId" value={order.id} />

            <input type="hidden" name="sellerId" value={seller.id} />

            <div className="mb-4">
              <p className="text-sm font-semibold">Rate your experience</p>

              <p className="text-xs text-gray-500 mt-1">
                How was your experience with {seller.business_name}?
              </p>
            </div>

            <StarRatingInput />

            <div className="mt-4">
              <label
                htmlFor="review-comment"
                className="text-xs font-medium block mb-1.5"
              >
                Review{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>

              <textarea
                id="review-comment"
                name="comment"
                rows={3}
                placeholder="How was the item, communication and delivery?"
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
              Submit review
            </button>
          </form>
        )}

        {/* EXISTING REVIEW */}

        {existingReview && (
          <div
            className="rounded-xl border p-4 mb-4 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="text-sm font-medium">Your review</p>

            <div className="flex items-center gap-2 mt-2">
              <StaticStarRating rating={Number(existingReview.rating)} />

              <span className="text-xs text-gray-500">
                {existingReview.rating}/5
              </span>
            </div>

            {existingReview.comment && (
              <p className="text-sm text-gray-600 mt-3">
                {existingReview.comment}
              </p>
            )}
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

/* --------------------------------
   ORDER STATUS
-------------------------------- */

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

/* --------------------------------
   STATIC STAR RATING
-------------------------------- */

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

/* --------------------------------
   ICONS
-------------------------------- */

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
