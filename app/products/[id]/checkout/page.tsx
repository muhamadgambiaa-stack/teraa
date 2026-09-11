import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { gambianLocalNumberFromStored } from "@/lib/gambian-phone";
import { SiteHeader } from "@/components/SiteHeader";

import { createOrder } from "./actions";
import { PlaceOrderButton } from "./PlaceOrderButton";
import {
  CheckoutPricing,
  type DeliveryCoverageOption,
} from "./CheckoutPricing";

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
      available_sizes,
      available_colors,
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
      .select("region, area, delivery_fee, estimated_min_days, estimated_max_days")
      .eq("seller_id", product.seller_id)
      .order("region")
      .order("area"),
    supabase
      .from("users")
      .select("phone_number")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const deliveryCoverage: DeliveryCoverageOption[] = (coverageRows ?? []).map(
    (row) => ({
      region: row.region,
      area: row.area,
      deliveryFee: Number(row.delivery_fee ?? 0),
      estimatedMinDays: Number(row.estimated_min_days ?? 1),
      estimatedMaxDays: Number(row.estimated_max_days ?? 3),
    }),
  );
  const buyerPhone = gambianLocalNumberFromStored(buyer?.phone_number);

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

    invalid_phone: "Enter a valid 7-digit legacy or 9-digit Gambian phone number.",

    delivery_unavailable: "This seller does not deliver to that region.",

    missing_payment:
      "Cash on delivery is currently the only available payment method.",

    invalid_quantity: "Choose a valid quantity.",

    missing_option: "Choose the available size and colour for this item.",

    order_failed: "Something went wrong placing your order. Try again.",

    out_of_stock: "This item just went out of stock.",

    not_found: "This listing is no longer available.",

    seller_unavailable: "This seller is currently unavailable.",
  };

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-8">
        <div className="mb-4">
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
          className="flex gap-3 rounded-xl border p-3 mb-4 bg-white"
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
          <form action={createOrder} className="space-y-3 sm:space-y-4">
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

            <CheckoutPricing
              productPrice={Number(product.price)}
              stockQuantity={product.stock_quantity}
              availableSizes={product.available_sizes}
              availableColors={product.available_colors}
              deliveryCoverage={deliveryCoverage}
            />

            {/* DELIVERY ADDRESS */}

            <div>
              <label className="text-sm font-medium block mb-1">Full delivery address</label>
              <textarea
                name="deliveryAddress"
                required
                rows={2}
                maxLength={500}
                autoComplete="street-address"
                placeholder="Street, neighbourhood and a nearby landmark"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Delivery phone number</label>
              <div
                className="flex overflow-hidden rounded-lg border bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                <span
                  className="flex items-center border-r bg-gray-50 px-3 text-sm font-medium text-gray-600"
                  style={{ borderColor: "var(--sand)" }}
                >
                  +220
                </span>
                <input
                  name="deliveryPhone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={9}
                  pattern="(?:[1-9][0-9]{6}|(?:83|86|87)[1-9][0-9]{6})"
                  title="Enter 7 digits, or the new 9-digit number beginning with 83, 86 or 87."
                  inputMode="numeric"
                  autoComplete="tel-national"
                  defaultValue={buyerPhone}
                  placeholder="831234567"
                  className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </div>

            {/* SAFETY */}

            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: "var(--sand)",
                background: "#fbfaf7",
              }}
            >
              <div className="flex items-start gap-2.5">
                <ShieldIcon />

                <div>
                  <p className="text-xs font-semibold">Cash on delivery</p>

                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Inspect the product before paying the seller. For in-person
                    exchanges, use a safe public meeting place.
                  </p>
                </div>
              </div>
            </div>

            <PlaceOrderButton />

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Teraa does not currently process or hold customer payments.
            </p>
          </form>
        )}
      </main>
    </>
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
