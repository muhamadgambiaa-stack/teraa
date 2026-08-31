import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import type { OrderStatus } from "@/types/database";

import {
  cancelSellerOrder,
  markOrderShipped,
  messageBuyerFromOrder,
  updateOrderStatus,
} from "../actions";

/*
 * ============================================================
 * ORDER STATUS UI
 * ============================================================
 */

const STATUS_STYLES: Record<
  OrderStatus,
  {
    bg: string;
    color: string;
    label: string;
  }
> = {
  placed: {
    bg: "#fbf3df",
    color: "var(--gold)",
    label: "New order",
  },

  confirmed: {
    bg: "#e6edf3",
    color: "var(--indigo)",
    label: "Confirmed",
  },

  shipped: {
    bg: "#e6edf3",
    color: "var(--indigo)",
    label: "Shipped",
  },

  delivered: {
    bg: "#e3f0e8",
    color: "var(--leaf)",
    label: "Delivered",
  },

  completed: {
    bg: "#e3f0e8",
    color: "var(--leaf)",
    label: "Completed",
  },

  cancelled: {
    bg: "#eeeeee",
    color: "#666",
    label: "Cancelled",
  },
};

/*
 * Seller takes the order only as far as delivered.
 *
 * Buyer confirms receipt and completes the order.
 */

const NEXT_ACTION: Partial<
  Record<
    OrderStatus,
    {
      next: OrderStatus;
      label: string;
    }
  >
> = {
  placed: {
    next: "confirmed",
    label: "Confirm order",
  },

  confirmed: {
    next: "shipped",
    label: "Mark as shipped",
  },

  shipped: {
    next: "delivered",
    label: "Mark as delivered",
  },
};

/*
 * Buyer information intentionally exposed to
 * the seller for this order.
 *
 * No phone number.
 */

type BuyerContact = {
  id: string;
  full_name: string;
  city: string | null;
};

type DeliveryIssue = {
  status: string;
  reported_at: string;
};

export default async function SellerOrderDetailPage({
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
    redirect(`/login?redirect=/seller/dashboard/orders/${id}`);
  }

  /*
   * ==========================================================
   * SELLER
   * ==========================================================
   */

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select(
      `
      id,
      verification_status,
      account_status
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (sellerError || !seller) {
    redirect("/account");
  }

  /*
   * ==========================================================
   * ORDER
   * ==========================================================
   *
   * Do not directly join another user's users row.
   *
   * Buyer information is loaded later through
   * get_order_buyer_for_seller().
   */

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      status,
      payment_method,
      payment_status,
      delivery_city,
      delivery_region,
      delivery_town,
      delivery_address,
      delivery_phone,
      delivery_landmark,
      delivery_fee,
      delivery_estimated_min_days,
      delivery_estimated_max_days,
      delivery_handler,
      delivery_contact_name,
      delivery_contact_phone,
      delivery_tracking_reference,
      shipped_at,
      delivered_at,
      delivery_notes,
      created_at,

      order_items(
        product_id,
        quantity,
        price_at_purchase,

        products(
          id,
          title,

          product_photos(
            photo_url,
            is_cover
          )
        )
      ),

      seller_payment_methods(
        provider_name,
        method_type
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  /*
   * Seller can only view their own order.
   */

  if (order.seller_id !== user.id) {
    notFound();
  }

  /*
   * ==========================================================
   * BUYER
   * ==========================================================
   *
   * This RPC only exposes:
   *
   * - buyer ID
   * - full name
   * - city
   *
   * Phone number is not requested or displayed.
   */

  const { data: buyerData, error: buyerError } = await supabase.rpc(
    "get_order_buyer_for_seller",
    {
      p_order_id: order.id,
    },
  );

  if (buyerError) {
    console.error("Could not load order buyer:", buyerError);
  }

  const buyerRaw = Array.isArray(buyerData) ? buyerData[0] : buyerData;

  const buyer = (buyerRaw as BuyerContact | null) ?? null;

  /*
   * ==========================================================
   * DELIVERY ISSUE
   * ==========================================================
   *
   * Sellers can only read delivery issues for their own orders
   * through the existing RLS policy.
   */

  let deliveryIssue: DeliveryIssue | null = null;

  const { data: deliveryIssueData, error: deliveryIssueError } = await supabase
    .from("order_delivery_issues")
    .select(
      `
      status,
      reported_at
      `,
    )
    .eq("order_id", order.id)
    .maybeSingle();

  if (deliveryIssueError) {
    console.error("Could not load delivery issue:", deliveryIssueError);
  }

  deliveryIssue = (deliveryIssueData as DeliveryIssue | null) ?? null;

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

                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                }[];
              }
            | {
                id: string;
                title: string;

                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                }[];
              }[];
        }[];
      }
    ).order_items ?? [];

  /*
   * ==========================================================
   * LEGACY DIGITAL PAYMENT DATA
   * ==========================================================
   *
   * Current checkout is COD-only.
   *
   * This remains so older digital orders can still render.
   */

  const methodRaw = (
    order as {
      seller_payment_methods?:
        | {
            provider_name: string;
            method_type: string;
          }
        | {
            provider_name: string;
            method_type: string;
          }[];
    }
  ).seller_payment_methods;

  const method = Array.isArray(methodRaw) ? methodRaw[0] : methodRaw;

  /*
   * ==========================================================
   * TOTAL
   * ==========================================================
   */

  const productSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.price_at_purchase),
    0,
  );
  const deliveryFee = Number(order.delivery_fee ?? 0);
  const total = productSubtotal + deliveryFee;

  const status = order.status as OrderStatus;

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.placed;

  const action = NEXT_ACTION[status];

  const canCancel = ["placed", "confirmed"].includes(status);

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        {/* BACK */}

        <Link
          href="/seller/dashboard/orders"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <ArrowLeftIcon />
          Back to orders
        </Link>

        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 mt-5 mb-6">
          <div>
            <p className="text-xs text-gray-500">Order</p>

            <h1
              className="font-display text-2xl mt-1"
              style={{
                color: "var(--ink)",
              }}
            >
              #{order.id.slice(0, 8)}
            </h1>

            <p className="text-xs text-gray-400 mt-1">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: style.bg,
              color: style.color,
            }}
          >
            {style.label}
          </span>
        </div>

        {/* ORDER ITEMS */}

        <section
          className="rounded-xl border bg-white overflow-hidden"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="text-sm font-semibold">Order items</h2>
          </div>

          <div className="p-4 space-y-4">
            {items.map((item) => {
              const rawProduct = item.products;

              const product = Array.isArray(rawProduct)
                ? rawProduct[0]
                : rawProduct;

              const photos = product?.product_photos ?? [];

              const cover =
                photos.find((photo) => photo.is_cover)?.photo_url ??
                photos[0]?.photo_url ??
                null;

              return (
                <div key={item.product_id} className="flex gap-3">
                  <div
                    className="w-16 h-16 rounded-lg overflow-hidden shrink-0"
                    style={{
                      background: "var(--sand)",
                    }}
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={product?.title ?? ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.product_id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {product?.title ?? "Product"}
                    </Link>

                    <p className="text-xs text-gray-500 mt-1">
                      Quantity: {item.quantity}
                    </p>

                    <p
                      className="text-sm font-semibold mt-1"
                      style={{
                        color: "var(--clay)",
                      }}
                    >
                      GMD{" "}
                      {(
                        item.quantity * Number(item.price_at_purchase)
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="border-t pt-3 flex items-center justify-between text-sm" style={{ borderColor: "var(--sand)" }}>
              <span className="text-gray-600">Product subtotal</span>
              <span>GMD {productSubtotal.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Delivery</span>
              <span>GMD {deliveryFee.toLocaleString()}</span>
            </div>

            <div
              className="border-t pt-3 flex items-center justify-between text-sm font-bold"
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
        </section>

        {/* BUYER */}

        <section
          className="rounded-xl border bg-white p-4 mt-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <UserIcon />

            <h2 className="text-sm font-semibold">Buyer</h2>
          </div>

          {buyer ? (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{buyer.full_name}</p>

                {buyer.city && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                    <SmallLocationIcon />

                    <span>{buyer.city}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/profile/${buyer.id}`}
                className="text-xs font-medium shrink-0 hover:underline"
                style={{
                  color: "var(--indigo)",
                }}
              >
                View profile
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Buyer information is currently unavailable.
            </p>
          )}

          {/* MESSAGE BUYER */}

          <form
            action={messageBuyerFromOrder.bind(null, order.id)}
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
              Message buyer
            </button>
          </form>
        </section>

        {/* DELIVERY ISSUE */}

        {deliveryIssue?.status === "open" && (
          <section
            className="rounded-xl border p-4 mt-4"
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

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--clay)",
                  }}
                >
                  Buyer reported a delivery issue
                </p>

                <p className="text-sm text-gray-600 mt-1 leading-5">
                  The buyer says they have not received this order. Contact the
                  buyer and check the delivery before taking any further action.
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  The buyer must confirm receipt when the item arrives. You
                  cannot mark this issue as resolved on their behalf.
                </p>

                <form
                  action={messageBuyerFromOrder.bind(null, order.id)}
                  className="mt-4"
                >
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white"
                    style={{
                      background: "var(--indigo)",
                    }}
                  >
                    <MessageIcon />
                    Message buyer
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        {/* DELIVERY */}

        <section
          className="rounded-xl border bg-white p-4 mt-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <LocationIcon />

            <h2 className="text-sm font-semibold">Delivery</h2>
          </div>

          <p className="text-sm font-medium">
            {[order.delivery_town, order.delivery_region]
              .filter(Boolean)
              .join(", ") || order.delivery_city}
          </p>

          {order.delivery_address && (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
              {order.delivery_address}
            </p>
          )}

          {order.delivery_landmark && (
            <p className="text-sm text-gray-500 mt-2">
              Landmark: {order.delivery_landmark}
            </p>
          )}

          {order.delivery_phone && (
            <a
              href={`tel:${order.delivery_phone}`}
              className="text-sm font-medium mt-2 inline-block hover:underline"
              style={{ color: "var(--indigo)" }}
            >
              Call {order.delivery_phone}
            </a>
          )}

          {order.delivery_estimated_min_days !== null &&
            order.delivery_estimated_max_days !== null && (
              <p className="text-sm text-gray-500 mt-2">
                Estimated delivery: {order.delivery_estimated_min_days === 0 && order.delivery_estimated_max_days === 0
                  ? "Same day"
                  : `${order.delivery_estimated_min_days}–${order.delivery_estimated_max_days} days`}
              </p>
            )}

          {order.delivery_notes && (
            <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">
              {order.delivery_notes}
            </p>
          )}

          {order.delivery_contact_name && order.delivery_contact_phone && (
            <div className="rounded-lg bg-gray-50 p-3 mt-3 text-sm">
              <p className="font-semibold">Delivery contact</p>
              <p className="text-gray-600 mt-1 capitalize">
                {order.delivery_handler} · {order.delivery_contact_name}
              </p>
              <a
                href={`tel:${order.delivery_contact_phone}`}
                className="font-medium mt-1 inline-block hover:underline"
                style={{ color: "var(--indigo)" }}
              >
                {order.delivery_contact_phone}
              </a>
              {order.delivery_tracking_reference && (
                <p className="text-gray-500 mt-1">
                  Reference: {order.delivery_tracking_reference}
                </p>
              )}
            </div>
          )}
        </section>

        {/* PAYMENT */}

        <section
          className="rounded-xl border bg-white p-4 mt-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <PaymentIcon />

            <h2 className="text-sm font-semibold">Payment</h2>
          </div>

          <p className="text-sm">
            {order.payment_method === "digital"
              ? (method?.provider_name ?? "Digital payment")
              : "Cash on delivery"}
          </p>

          {order.payment_method === "digital" && (
            <p className="text-xs text-gray-500 mt-1 capitalize">
              Payment status: {order.payment_status}
            </p>
          )}
        </section>

        {/* ACTIONS */}

        {(action || status === "confirmed" || canCancel) && (
          <section
            className="border-t mt-6 pt-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3">Order actions</h2>

            <div className="flex flex-wrap gap-2">
              {action && status !== "confirmed" && (
                <form
                  action={updateOrderStatus.bind(null, order.id, action.next)}
                >
                  <button
                    type="submit"
                    className="rounded-full px-5 py-2.5 text-white text-sm font-medium"
                    style={{
                      background: "var(--indigo)",
                    }}
                  >
                    {action.label}
                  </button>
                </form>
              )}


              {status === "confirmed" && (
                <form
                  action={markOrderShipped.bind(null, order.id)}
                  className="w-full rounded-xl border p-4 space-y-3"
                  style={{ borderColor: "var(--sand)" }}
                >
                  <p className="text-sm font-semibold">Delivery details</p>

                  <label className="block text-xs font-medium">
                    Who is delivering?
                    <select
                      name="deliveryHandler"
                      required
                      defaultValue="seller"
                      className="w-full rounded-lg border px-3 py-2.5 mt-1 bg-white"
                      style={{ borderColor: "var(--sand)" }}
                    >
                      <option value="seller">Seller delivery</option>
                      <option value="rider">Independent rider</option>
                      <option value="courier">Courier company</option>
                    </select>
                  </label>

                  <label className="block text-xs font-medium">
                    Delivery contact name
                    <input
                      name="contactName"
                      required
                      minLength={2}
                      maxLength={100}
                      className="w-full rounded-lg border px-3 py-2.5 mt-1"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </label>

                  <label className="block text-xs font-medium">
                    Delivery contact phone
                    <input
                      name="contactPhone"
                      type="tel"
                      required
                      minLength={7}
                      maxLength={30}
                      className="w-full rounded-lg border px-3 py-2.5 mt-1"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </label>

                  <label className="block text-xs font-medium">
                    Tracking or reference
                    <span className="font-normal text-gray-400"> (optional)</span>
                    <input
                      name="trackingReference"
                      maxLength={120}
                      className="w-full rounded-lg border px-3 py-2.5 mt-1"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </label>

                  <button
                    type="submit"
                    className="w-full rounded-full px-5 py-2.5 text-white text-sm font-medium"
                    style={{ background: "var(--indigo)" }}
                  >
                    Mark as shipped
                  </button>
                </form>
              )}

              {canCancel && (
                <form action={cancelSellerOrder.bind(null, order.id)}>
                  <button
                    type="submit"
                    className="rounded-full border px-5 py-2.5 text-sm font-medium"
                    style={{
                      borderColor: "var(--clay)",
                      color: "var(--clay)",
                    }}
                  >
                    Cancel order
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* COMPLETED */}

        {status === "completed" && (
          <div
            className="rounded-xl border p-4 mt-5 text-sm"
            style={{
              borderColor: "var(--leaf)",
              background: "#e3f0e8",
            }}
          >
            This order has been completed.
          </div>
        )}

        {/* CANCELLED */}

        {status === "cancelled" && (
          <div
            className="rounded-xl border p-4 mt-5 text-sm"
            style={{
              borderColor: "var(--sand)",
              background: "#f5f5f5",
            }}
          >
            This order was cancelled.
          </div>
        )}
      </main>
    </>
  );
}

/*
 * ============================================================
 * ICONS
 * ============================================================
 */

function ArrowLeftIcon() {
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
    >
      <path d="M19 12H5" />

      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function UserIcon() {
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
      <circle cx="12" cy="8" r="4" />

      <path d="M4 21a8 8 0 0 1 16 0" />
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

function SmallLocationIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function LocationIcon() {
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
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
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

function ImageIcon() {
  return (
    <svg
      width="20"
      height="20"
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
