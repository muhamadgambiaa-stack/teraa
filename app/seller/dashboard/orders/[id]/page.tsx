import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import type { OrderStatus } from "@/types/database";

import { cancelSellerOrder, updateOrderStatus } from "../actions";

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

  const { data: seller } = await supabase
    .from("sellers")
    .select(
      `
      id,
      verification_status
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) {
    redirect("/account");
  }

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

      users:buyer_id(
        id,
        full_name,
        phone_number,
        city
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
   * Important:
   * seller can only view their own order.
   */
  if (order.seller_id !== user.id) {
    notFound();
  }

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

  const buyerRaw = (
    order as {
      users?:
        | {
            id: string;
            full_name: string;
            phone_number: string;
            city: string | null;
          }
        | {
            id: string;
            full_name: string;
            phone_number: string;
            city: string | null;
          }[];
    }
  ).users;

  const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

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

  const total = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.price_at_purchase),
    0,
  );

  const status = order.status as OrderStatus;

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.placed;

  const action = NEXT_ACTION[status];

  const canCancel = ["placed", "confirmed"].includes(status);

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-8">
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

        {/* ITEMS */}

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

        {buyer && (
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

            <p className="text-sm font-medium">{buyer.full_name}</p>

            <p className="text-sm text-gray-500 mt-1">{buyer.phone_number}</p>

            {buyer.city && (
              <p className="text-xs text-gray-500 mt-1">{buyer.city}</p>
            )}

            <Link
              href={`/profile/${buyer.id}`}
              className="inline-block text-xs mt-3 hover:underline"
              style={{
                color: "var(--indigo)",
              }}
            >
              View buyer profile
            </Link>
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

          <p className="text-sm">{order.delivery_city}</p>

          {order.delivery_notes && (
            <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">
              {order.delivery_notes}
            </p>
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

        {(action || canCancel) && (
          <section
            className="border-t mt-6 pt-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3">Order actions</h2>

            <div className="flex flex-wrap gap-2">
              {action && (
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
