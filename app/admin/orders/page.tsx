import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
  }>;
}) {
  const params = await searchParams;

  const query = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const payment = params.payment ?? "all";

  const { supabase } = await requireAdmin();

  let request = supabase
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

      users:buyer_id(
        full_name,
        phone_number
      ),

      sellers(
        business_name
      ),

      order_items(
        quantity,
        price_at_purchase,
        products(
          title
        )
      )
      `,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(200);

  if (status !== "all") {
    request = request.eq("status", status);
  }

  if (payment !== "all") {
    request = request.eq("payment_status", payment);
  }

  const { data: orders, error } = await request;

  const rows = orders ?? [];

  const filteredRows = query
    ? rows.filter((order) => {
        const buyerRaw = (
          order as {
            users?:
              | {
                  full_name: string | null;
                  phone_number: string | null;
                }
              | {
                  full_name: string | null;
                  phone_number: string | null;
                }[];
          }
        ).users;

        const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

        const sellerRaw = (
          order as {
            sellers?:
              | {
                  business_name: string | null;
                }
              | {
                  business_name: string | null;
                }[];
          }
        ).sellers;

        const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;

        const searchValue = query.toLowerCase();

        return (
          order.id.toLowerCase().includes(searchValue) ||
          buyer?.full_name?.toLowerCase().includes(searchValue) ||
          buyer?.phone_number?.toLowerCase().includes(searchValue) ||
          seller?.business_name?.toLowerCase().includes(searchValue) ||
          order.delivery_city?.toLowerCase().includes(searchValue)
        );
      })
    : rows;

  return (
    <>
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500">Admin</p>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Orders
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Inspect marketplace orders, payment issues and delivery activity.
          </p>
        </div>

        <form
          method="GET"
          className="grid md:grid-cols-[1fr_auto_auto_auto] gap-2 mb-6"
        >
          <input
            name="q"
            defaultValue={query}
            placeholder="Search order, buyer, seller or city..."
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          />

          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All order statuses</option>
            <option value="placed">Placed</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            name="payment"
            defaultValue={payment}
            className="rounded-lg border px-3 py-2.5 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All payment statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>

          <button
            type="submit"
            className="rounded-lg px-4 py-2.5 text-sm text-white"
            style={{
              background: "var(--indigo)",
            }}
          >
            Search
          </button>
        </form>

        {error && (
          <div
            className="rounded-xl border p-5 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
            }}
          >
            Couldn&apos;t load orders.
          </div>
        )}

        {!error && filteredRows.length === 0 && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No orders found.
          </div>
        )}

        <div className="space-y-3">
          {filteredRows.map((order) => {
            const buyerRaw = (
              order as {
                users?:
                  | {
                      full_name: string | null;
                      phone_number: string | null;
                    }
                  | {
                      full_name: string | null;
                      phone_number: string | null;
                    }[];
              }
            ).users;

            const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

            const sellerRaw = (
              order as {
                sellers?:
                  | {
                      business_name: string | null;
                    }
                  | {
                      business_name: string | null;
                    }[];
              }
            ).sellers;

            const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;

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

            const total = items.reduce(
              (sum, item) =>
                sum + item.quantity * Number(item.price_at_purchase),
              0,
            );

            return (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block rounded-xl border bg-white p-4 hover:bg-gray-50 transition"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      #{order.id.slice(0, 8)} ·{" "}
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>

                    <p className="font-medium text-sm mt-1">
                      {buyer?.full_name ?? "Buyer"}
                      {" → "}
                      {seller?.business_name ?? "Seller"}
                    </p>

                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      {items.map((item, index) => {
                        const productRaw = item.products;

                        const product = Array.isArray(productRaw)
                          ? productRaw[0]
                          : productRaw;

                        return (
                          <p key={index}>
                            {item.quantity} × {product?.title ?? "Product"}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="font-bold"
                      style={{
                        color: "var(--clay)",
                      }}
                    >
                      GMD {total.toLocaleString()}
                    </p>

                    <div className="flex flex-col gap-1 items-end mt-2">
                      <StatusBadge value={order.status} />

                      <PaymentBadge value={order.payment_status} />
                    </div>
                  </div>
                </div>

                <div
                  className="border-t mt-3 pt-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <span>
                    {order.payment_method === "cod"
                      ? "Cash on delivery"
                      : "Digital payment"}
                  </span>

                  <span>Deliver to: {order.delivery_city}</span>

                  <span>View order →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<
    string,
    {
      bg: string;
      color: string;
    }
  > = {
    placed: {
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    confirmed: {
      bg: "#e6edf3",
      color: "var(--indigo)",
    },

    shipped: {
      bg: "#e6edf3",
      color: "var(--indigo)",
    },

    delivered: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    completed: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    cancelled: {
      bg: "#eee",
      color: "#777",
    },
  };

  const style = styles[value] ?? styles.placed;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {value}
    </span>
  );
}

function PaymentBadge({ value }: { value: string }) {
  const styles: Record<
    string,
    {
      bg: string;
      color: string;
    }
  > = {
    pending: {
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    submitted: {
      bg: "#e6edf3",
      color: "var(--indigo)",
    },

    paid: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    failed: {
      bg: "#fdf0f0",
      color: "var(--clay)",
    },
  };

  const style = styles[value] ?? styles.pending;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      Payment: {value}
    </span>
  );
}
