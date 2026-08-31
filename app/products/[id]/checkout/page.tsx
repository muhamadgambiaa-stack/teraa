import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { createOrder } from "./actions";

async function getProduct(id: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      `
      id,
      title,
      price,
      stock_quantity,
      status,
      location_city,
      seller_id,

      product_photos(
        photo_url,
        is_cover
      )
      `,
    )
    .eq("id", id)
    .single();

  return data;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/products/${id}/checkout`);
  }

  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const [{ data: coverageRows }, { data: buyer }] = await Promise.all([
    supabase
      .from("seller_delivery_areas")
      .select("region, area")
      .eq("seller_id", product.seller_id)
      .order("region")
      .order("area"),
    supabase
      .from("users")
      .select("phone_number")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const deliveryCoverage = (coverageRows ?? []) as {
    region: string;
    area: string;
  }[];
  const buyerPhone = buyer?.phone_number ?? "";

  const photos =
    (
      product as {
        product_photos?: {
          photo_url: string;
          is_cover: boolean;
        }[];
      }
    ).product_photos ?? [];

  const cover =
    photos.find((photo) => photo.is_cover)?.photo_url ??
    photos[0]?.photo_url ??
    null;

  const outOfStock =
    product.status !== "active" || product.stock_quantity === 0;

  const errorMessages: Record<string, string> = {
    missing_area: "Choose a delivery area to continue.",

    missing_address: "Enter the full delivery address.",

    missing_phone: "Enter a phone number for delivery coordination.",

    delivery_unavailable: "This seller does not deliver to that region.",

    missing_payment:
      "Cash on delivery is currently the only available payment method.",

    invalid_quantity: "Choose a valid quantity.",

    order_failed: "Something went wrong placing your order. Try again.",

    out_of_stock: "This item just went out of stock.",

    not_found: "This listing is no longer available.",

    seller_unavailable: "This seller is currently unavailable.",
  };

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 sm:pb-8">
        <div className="mb-5">
          <h1
            className="font-display text-xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Checkout
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Review your order and delivery information.
          </p>
        </div>

        {/* PRODUCT */}

        <div
          className="flex gap-3 rounded-xl border p-3 mb-6 bg-white"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div
            className="w-16 h-16 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              background: "var(--sand)",
            }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">{product.title}</p>

            <p
              className="text-base font-bold mt-1"
              style={{
                color: "var(--clay)",
              }}
            >
              GMD {Number(product.price).toLocaleString()}
            </p>
          </div>
        </div>

        {outOfStock ? (
          <div
            className="rounded-xl border p-6 text-center text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium mb-2">This item is out of stock.</p>

            <Link
              href={`/products/${product.id}`}
              className="text-sm underline"
              style={{
                color: "var(--indigo)",
              }}
            >
              Back to listing
            </Link>
          </div>
        ) : deliveryCoverage.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-center text-sm bg-white"
            style={{ borderColor: "var(--sand)" }}
          >
            <p className="font-medium mb-2">Delivery is not available for this item yet.</p>
            <p className="text-gray-500 mb-3">The seller has not added their delivery regions.</p>
            <Link
              href={`/products/${product.id}`}
              className="text-sm underline"
              style={{ color: "var(--indigo)" }}
            >
              Back to listing
            </Link>
          </div>
        ) : (
          <form action={createOrder} className="space-y-5">
            <input type="hidden" name="productId" value={product.id} />

            <input type="hidden" name="paymentMethod" value="cod" />

            {error && errorMessages[error] && (
              <div
                className="rounded-lg border p-3 text-sm text-red-700"
                style={{
                  borderColor: "#e0a0a0",
                  background: "#fdf0f0",
                }}
              >
                {errorMessages[error]}
              </div>
            )}

            {/* QUANTITY */}

            <div>
              <label className="text-sm font-medium block mb-1">Quantity</label>

              <select
                name="quantity"
                defaultValue="1"
                className="w-24 rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                {Array.from(
                  {
                    length: Math.min(product.stock_quantity, 10),
                  },
                  (_, index) => index + 1,
                ).map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>

            {/* PAYMENT */}

            <div>
              <label className="text-sm font-medium block mb-2">
                Payment method
              </label>

              <div className="space-y-3">
                <div
                  className="rounded-xl border p-4 bg-white"
                  style={{
                    borderColor: "var(--indigo)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: "#e6edf3",
                        color: "var(--indigo)",
                      }}
                    >
                      <CashIcon />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          Cash on delivery
                        </p>

                        <span
                          className="rounded-full px-2 py-1 text-[10px] font-semibold"
                          style={{
                            background: "#e3f0e8",
                            color: "var(--leaf)",
                          }}
                        >
                          Available
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Pay when you receive the item. Inspect the product
                        before handing over the cash.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ONLINE PAYMENT DISABLED */}

                <div
                  className="rounded-xl border p-4 opacity-60"
                  style={{
                    borderColor: "var(--sand)",
                    background: "#f7f7f5",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: "#eeeeee",
                        color: "#777",
                      }}
                    >
                      <CardIcon />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Online payment</p>

                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold bg-white text-gray-500">
                          Coming soon
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Mobile money and bank transfer payments will be
                        introduced in a future Teraa update.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DELIVERY ADDRESS */}

            <div>
              <label className="text-sm font-medium block mb-1">
                Delivery area
              </label>

              <select
                name="deliveryCoverage"
                required
                defaultValue=""
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <option value="">Select where you want delivery</option>

                {Array.from(new Set(deliveryCoverage.map((item) => item.region))).map(
                  (region) => (
                    <optgroup key={region} label={region}>
                      {deliveryCoverage
                        .filter((item) => item.region === region)
                        .map((item) => (
                          <option
                            key={`${item.region}:${item.area}`}
                            value={JSON.stringify(item)}
                          >
                            {item.area}
                          </option>
                        ))}
                    </optgroup>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Full delivery address</label>
              <textarea
                name="deliveryAddress"
                required
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                placeholder="Street, neighbourhood, compound or building details"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Delivery phone number</label>
              <input
                name="deliveryPhone"
                type="tel"
                required
                maxLength={40}
                autoComplete="tel"
                defaultValue={buyerPhone}
                placeholder="+220 7XX XXXX"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Nearby landmark <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                name="deliveryLandmark"
                maxLength={200}
                placeholder="A school, mosque, shop or other easy-to-find place"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            {/* NOTES */}

            <div>
              <label className="text-sm font-medium block mb-1">
                Delivery notes{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>

              <textarea
                name="deliveryNotes"
                rows={3}
                maxLength={500}
                placeholder="Preferred time or other delivery instructions"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            {/* SAFETY */}

            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: "var(--sand)",
                background: "#fbfaf7",
              }}
            >
              <div className="flex items-start gap-2.5">
                <ShieldIcon />

                <div>
                  <p className="text-xs font-semibold">
                    Pay only after receiving the item
                  </p>

                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Inspect the product before paying. For in-person exchanges,
                    use a safe public meeting place.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full py-3 text-white text-sm font-semibold"
              style={{
                background: "var(--indigo)",
              }}
            >
              Place COD order
            </button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Teraa does not currently process or hold customer payments.
            </p>
          </form>
        )}
      </main>
    </>
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

function CardIcon() {
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

      <path d="M3 10h18" />
    </svg>
  );
}

function ShieldIcon() {
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

function ImageIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />

      <circle cx="8.5" cy="8.5" r="1.5" />

      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
