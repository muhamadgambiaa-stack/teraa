import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const { supabase } = await requireAdmin();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      delivery_fee,
      delivery_estimated_min_days,
      delivery_estimated_max_days,
      status,
      payment_method,
      payment_status,
      seller_payment_method_id,
      delivery_city,
      delivery_notes,
      created_at,

      users:buyer_id(
        id,
        full_name,
        phone_number,
        city,
        profile_photo_url,
        account_status
      ),

      sellers(
        id,
        business_name,
        verification_status,
        account_status,
        rating_avg,
        total_sales
      ),

      seller_payment_methods(
        provider_name,
        method_type,
        account_name,
        account_number
      ),

      order_items(
        id,
        quantity,
        price_at_purchase,
        product_id,
        products(
          id,
          title,
          status,
          seller_id,
          product_photos(
            photo_url,
            is_cover,
            sort_order
          )
        )
      ),

      commissions(
        id,
        commission_rate,
        commission_amount,
        seller_payout_status
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const buyerRaw = (
    order as {
      users?:
        | {
            id: string;
            full_name: string | null;
            phone_number: string | null;
            city: string | null;
            profile_photo_url: string | null;
            account_status: string;
          }
        | {
            id: string;
            full_name: string | null;
            phone_number: string | null;
            city: string | null;
            profile_photo_url: string | null;
            account_status: string;
          }[];
    }
  ).users;

  const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] : buyerRaw;

  const sellerRaw = (
    order as {
      sellers?:
        | {
            id: string;
            business_name: string | null;
            verification_status: string;
            account_status: string;
            rating_avg: number | null;
            total_sales: number | null;
          }
        | {
            id: string;
            business_name: string | null;
            verification_status: string;
            account_status: string;
            rating_avg: number | null;
            total_sales: number | null;
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

  const paymentMethod = Array.isArray(paymentMethodRaw)
    ? paymentMethodRaw[0]
    : paymentMethodRaw;

  const items =
    (
      order as {
        order_items?: {
          id: string;
          quantity: number;
          price_at_purchase: number;
          product_id: string;
          products?:
            | {
                id: string;
                title: string;
                status: string;
                seller_id: string;
                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                  sort_order: number;
                }[];
              }
            | {
                id: string;
                title: string;
                status: string;
                seller_id: string;
                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                  sort_order: number;
                }[];
              }[];
        }[];
      }
    ).order_items ?? [];

  const commissionRaw = (
    order as {
      commissions?:
        | {
            id: string;
            commission_rate: number;
            commission_amount: number;
            seller_payout_status: string;
          }
        | {
            id: string;
            commission_rate: number;
            commission_amount: number;
            seller_payout_status: string;
          }[];
    }
  ).commissions;

  const commission = Array.isArray(commissionRaw)
    ? commissionRaw[0]
    : commissionRaw;

  const productSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.price_at_purchase),
    0,
  );
  const deliveryFee = Number(order.delivery_fee ?? 0);
  const total = productSubtotal + deliveryFee;

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href="/admin/orders"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mt-4 mb-6">
          <div>
            <p className="text-xs text-gray-500">Admin order inspection</p>

            <h1
              className="font-display text-2xl mt-1"
              style={{
                color: "var(--ink)",
              }}
            >
              Order #{order.id.slice(0, 8)}
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Created {new Date(order.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge value={order.status} />

            <PaymentBadge value={order.payment_status} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* BUYER */}

          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Buyer</h2>

            {buyer ? (
              <>
                <div className="flex items-center gap-3">
                  {buyer.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buyer.profile_photo_url}
                      alt={buyer.full_name ?? "Buyer"}
                      className="w-12 h-12 rounded-full object-cover border"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{
                        background: "var(--indigo)",
                      }}
                    >
                      {(buyer.full_name ?? "B").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <p className="font-medium">{buyer.full_name ?? "Buyer"}</p>

                    <p className="text-xs text-gray-500">
                      {buyer.phone_number ?? "No phone"}
                    </p>
                  </div>
                </div>

                <div className="text-sm space-y-2 mt-4">
                  <p>
                    <strong>City:</strong> {buyer.city ?? "Not provided"}
                  </p>

                  <p>
                    <strong>Account:</strong>{" "}
                    <span className="capitalize">{buyer.account_status}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <Link
                    href={`/admin/users/${buyer.id}`}
                    className="text-sm underline"
                  >
                    Manage user
                  </Link>

                  <Link
                    href={`/profile/${buyer.id}`}
                    className="text-sm underline"
                  >
                    Public profile
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Buyer information unavailable.
              </p>
            )}
          </section>

          {/* SELLER */}

          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Seller</h2>

            {seller ? (
              <>
                <p className="font-medium">
                  {seller.business_name ?? "Seller"}
                </p>

                <div className="text-sm space-y-2 mt-4">
                  <p>
                    <strong>Verification:</strong>{" "}
                    <span className="capitalize">
                      {seller.verification_status}
                    </span>
                  </p>

                  <p>
                    <strong>Seller status:</strong>{" "}
                    <span className="capitalize">{seller.account_status}</span>
                  </p>

                  <p>
                    <strong>Rating:</strong>{" "}
                    {Number(seller.rating_avg ?? 0).toFixed(1)}★
                  </p>

                  <p>
                    <strong>Sales:</strong> {seller.total_sales ?? 0}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <Link
                    href={`/admin/sellers/${seller.id}`}
                    className="text-sm underline"
                  >
                    Manage seller
                  </Link>

                  <Link
                    href={`/profile/${seller.id}`}
                    className="text-sm underline"
                  >
                    Public profile
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Seller information unavailable.
              </p>
            )}
          </section>
        </div>

        {/* ORDER ITEMS */}

        <section
          className="rounded-xl border bg-white mt-5 overflow-hidden"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold">Order items</h2>
          </div>

          {items.map((item) => {
            const productRaw = item.products;

            const product = Array.isArray(productRaw)
              ? productRaw[0]
              : productRaw;

            const photos = product?.product_photos ?? [];

            const cover =
              photos.find((photo) => photo.is_cover)?.photo_url ??
              [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
                ?.photo_url ??
              null;

            const lineTotal = item.quantity * Number(item.price_at_purchase);

            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={product?.title ?? "Product"}
                    className="w-16 h-16 rounded-lg object-cover border shrink-0"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center text-[10px] text-gray-400 shrink-0"
                    style={{
                      background: "var(--sand)",
                    }}
                  >
                    No photo
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {product ? (
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {product.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-sm">Product unavailable</p>
                  )}

                  <p className="text-xs text-gray-500 mt-1">
                    Quantity: {item.quantity}
                  </p>

                  <p className="text-xs text-gray-500">
                    Purchase price: GMD{" "}
                    {Number(item.price_at_purchase).toLocaleString()}
                  </p>
                </div>

                <p
                  className="font-semibold text-sm shrink-0"
                  style={{
                    color: "var(--clay)",
                  }}
                >
                  GMD {lineTotal.toLocaleString()}
                </p>
              </div>
            );
          })}

          <div className="flex justify-between px-5 pt-4 text-sm border-t" style={{ borderColor: "var(--sand)" }}>
            <span className="text-gray-600">Product subtotal</span>
            <span>GMD {productSubtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between px-5 py-2 text-sm">
            <span className="text-gray-600">Delivery</span>
            <span>GMD {deliveryFee.toLocaleString()}</span>
          </div>

          <div
            className="flex justify-between px-5 py-4 border-t font-semibold"
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
        </section>

        {/* PAYMENT + DELIVERY */}

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Payment</h2>

            <div className="text-sm space-y-2">
              <p>
                <strong>Method:</strong>{" "}
                {order.payment_method === "cod"
                  ? "Cash on delivery"
                  : "Digital payment"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <span className="capitalize">{order.payment_status}</span>
              </p>

              {paymentMethod && (
                <>
                  <p>
                    <strong>Provider:</strong> {paymentMethod.provider_name}
                  </p>

                  <p>
                    <strong>Type:</strong> {paymentMethod.method_type}
                  </p>

                  <p>
                    <strong>Account name:</strong> {paymentMethod.account_name}
                  </p>

                  <p>
                    <strong>Account number:</strong>{" "}
                    {paymentMethod.account_number}
                  </p>
                </>
              )}
            </div>
          </section>

          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Delivery</h2>

            <div className="text-sm space-y-2">
              <p>
                <strong>City:</strong> {order.delivery_city}
              </p>

              <p>
                <strong>Notes:</strong>{" "}
                {order.delivery_notes || "No delivery notes"}
              </p>
            </div>
          </section>
        </div>

        {/* COMMISSION */}

        {commission && (
          <section
            className="rounded-xl border bg-white p-5 mt-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Commission</h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <InfoBox
                label="Rate"
                value={`${Number(
                  commission.commission_rate,
                ).toLocaleString()}%`}
              />

              <InfoBox
                label="Commission"
                value={`GMD ${Number(
                  commission.commission_amount,
                ).toLocaleString()}`}
              />

              <InfoBox
                label="Seller payout"
                value={commission.seller_payout_status}
              />
            </div>
          </section>
        )}

        {/* ADMIN INFO */}

        <section
          className="rounded-xl border p-5 mt-5"
          style={{
            borderColor: "var(--sand)",
            background: "#fffdf8",
          }}
        >
          <h2 className="font-semibold">Admin inspection</h2>

          <p className="text-sm text-gray-500 mt-2">
            This page is currently inspection-only. Admins can review the
            transaction and open the buyer or seller management pages without
            directly overriding order/payment status from here.
          </p>

          <p className="text-xs text-gray-400 mt-3">
            Keeping direct order overrides disabled for now reduces the risk of
            accidentally changing inventory, payment or commission history.
          </p>
        </section>
      </main>
    </>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="text-xs text-gray-500">{label}</p>

      <p className="font-semibold text-sm mt-1 capitalize">{value}</p>
    </div>
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
      className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
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
      className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      Payment: {value}
    </span>
  );
}
