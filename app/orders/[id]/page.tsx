import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
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
   * RLS should protect this too, but we also
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
   * Buyers may only confirm receipt after
   * shipping has actually begun.
   */
  const canMarkReceived = ["shipped", "delivered"].includes(order.status);

  let existingReview = null;

  if (order.status === "completed") {
    const { data } = await supabase
      .from("reviews")
      .select("id, rating, comment")
      .eq("order_id", order.id)
      .maybeSingle();

    existingReview = data;
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl text-white"
            style={{
              background: order.status === "cancelled" ? "#888" : "var(--leaf)",
            }}
          >
            {order.status === "cancelled" ? "×" : "✓"}
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

        <div
          className="rounded-lg border p-4 mb-4 bg-white"
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

                <span>
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

        {order.payment_method === "digital" && (
          <div
            className="rounded-lg border p-4 mb-4"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="text-sm font-medium mb-1">Complete your payment</p>

            {chosenMethod ? (
              <p className="text-sm">
                Send GMD {total.toLocaleString()} to{" "}
                <strong>{chosenMethod.provider_name}</strong> (
                {chosenMethod.method_type === "bank"
                  ? "bank transfer"
                  : "mobile money"}
                ), account name <strong>{chosenMethod.account_name}</strong>,
                number <strong>{chosenMethod.account_number}</strong>.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Contact the seller to arrange payment.
              </p>
            )}
          </div>
        )}

        {order.payment_method === "cod" && (
          <div
            className="rounded-lg border p-4 mb-4"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="text-sm font-medium mb-1">Cash on delivery</p>

            <p className="text-sm text-gray-600">
              Pay when your item arrives in {order.delivery_city}. Inspect it
              before paying.
            </p>
          </div>
        )}

        <div
          className="rounded-lg border p-4 mb-6 text-sm"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <p className="font-medium mb-1">Delivery</p>

          <p className="text-gray-600">{order.delivery_city}</p>

          {order.delivery_notes && (
            <p className="text-gray-600 mt-1">{order.delivery_notes}</p>
          )}
        </div>

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

        {order.status === "cancelled" && (
          <div
            className="rounded-lg border p-4 mb-4 text-sm text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            This order has been cancelled. Reserved stock has been returned to
            the seller&apos;s listing.
          </div>
        )}

        {order.status === "completed" && seller && !existingReview && (
          <form
            action={submitReview}
            className="rounded-lg border p-4 mb-4 space-y-3"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <input type="hidden" name="orderId" value={order.id} />

            <input type="hidden" name="sellerId" value={seller.id} />

            <p className="text-sm font-medium">
              Rate your experience with {seller.business_name}
            </p>

            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label
                  key={rating}
                  className="flex flex-col items-center text-xs cursor-pointer"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={rating}
                    required
                    className="mb-1"
                    defaultChecked={rating === 5}
                  />
                  {rating}★
                </label>
              ))}
            </div>

            <textarea
              name="comment"
              rows={2}
              placeholder="Optional: how was the item, communication and delivery?"
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none resize-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <button
              type="submit"
              className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Submit review
            </button>
          </form>
        )}

        {existingReview && (
          <div
            className="rounded-lg border p-4 mb-4 text-sm"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium mb-1">
              You rated this order {existingReview.rating}★
            </p>

            {existingReview.comment && (
              <p className="text-gray-600">{existingReview.comment}</p>
            )}
          </div>
        )}

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
