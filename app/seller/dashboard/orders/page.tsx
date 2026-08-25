import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";

import { cancelSellerOrder, updateOrderStatus } from "./actions";

import type { OrderStatus } from "@/types/database";

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
    bg: "#eee",
    color: "#888",
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

export default async function SellerOrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, verification_status")
    .eq("id", user.id)
    .single();

  if (!seller) {
    redirect("/account");
  }

  const { data: orders, error } = await supabase
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

      order_items(
        quantity,
        price_at_purchase,
        products(title)
      ),

      users:buyer_id(
        full_name,
        phone_number
      ),

      seller_payment_methods(
        provider_name
      )
      `,
    )
    .eq("seller_id", seller.id)
    .order("created_at", {
      ascending: false,
    });

  return (
    <>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1
          className="font-display text-2xl mb-6"
          style={{
            color: "var(--ink)",
          }}
        >
          Orders
        </h1>

        <SellerNav active="orders" />

        {seller.verification_status !== "approved" && (
          <p className="text-sm text-gray-500">
            Orders will appear here once you&apos;re verified.
          </p>
        )}

        {error && (
          <div
            className="rounded-xl border p-6 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
            }}
          >
            Couldn&apos;t load your orders.
          </div>
        )}

        {seller.verification_status === "approved" &&
          !error &&
          (!orders || orders.length === 0) && (
            <div
              className="rounded-xl border p-10 text-center text-sm text-gray-500"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              No orders yet.
            </div>
          )}

        <div className="space-y-3">
          {(orders ?? []).map((order) => {
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

            const buyerRaw = (
              order as {
                users?:
                  | {
                      full_name: string;
                      phone_number: string;
                    }
                  | {
                      full_name: string;
                      phone_number: string;
                    }[];
              }
            ).users;

            const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

            const methodRaw = (
              order as {
                seller_payment_methods?:
                  | {
                      provider_name: string;
                    }
                  | {
                      provider_name: string;
                    }[];
              }
            ).seller_payment_methods;

            const method = Array.isArray(methodRaw) ? methodRaw[0] : methodRaw;

            const total = items.reduce(
              (sum, item) =>
                sum + item.quantity * Number(item.price_at_purchase),
              0,
            );

            const status = order.status as OrderStatus;

            const style = STATUS_STYLES[status];

            const action = NEXT_ACTION[status];

            const canCancel = ["placed", "confirmed"].includes(status);

            return (
              <div
                key={order.id}
                className="rounded-xl border p-4 bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs text-gray-400">
                    #{order.id.slice(0, 8)} ·{" "}
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>

                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: style.bg,
                      color: style.color,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                {items.map((item, index) => {
                  const title = Array.isArray(item.products)
                    ? item.products[0]?.title
                    : item.products?.title;

                  return (
                    <p key={index} className="text-sm">
                      {item.quantity} × {title}
                    </p>
                  );
                })}

                <p
                  className="text-sm font-bold mt-1"
                  style={{
                    color: "var(--clay)",
                  }}
                >
                  GMD {total.toLocaleString()}
                </p>

                <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                  {buyer && (
                    <p>
                      {buyer.full_name} · {buyer.phone_number}
                    </p>
                  )}

                  <p>
                    Deliver to: {order.delivery_city}
                    {order.delivery_notes ? `, ${order.delivery_notes}` : ""}
                  </p>

                  <p>
                    Payment:{" "}
                    {order.payment_method === "digital"
                      ? (method?.provider_name ?? "Digital")
                      : "Cash on delivery"}
                    {order.payment_method === "digital" &&
                      ` (${order.payment_status})`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {action && (
                    <form
                      action={updateOrderStatus.bind(
                        null,
                        order.id,
                        action.next,
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
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
                        className="rounded-full px-4 py-1.5 text-xs font-medium border"
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
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
