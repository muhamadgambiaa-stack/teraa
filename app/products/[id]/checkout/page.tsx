import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { GAMBIA_CITIES } from "@/types/database";
import { createOrder } from "./actions";
import { notFound } from "next/navigation";
import Link from "next/link";

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, title, price, stock_quantity, status, location_city, seller_id, product_photos(photo_url, is_cover)")
    .eq("id", id)
    .single();
  return data;
}

async function getSellerPaymentMethods(sellerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_payment_methods")
    .select("id, method_type, provider_name")
    .eq("seller_id", sellerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  // Buyers must have a Teraa account to check out. Checking this at page
  // load, not just on submit, so someone without an account never sees a
  // form they can't actually use, and doesn't lose what they typed.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/products/${id}/checkout`);

  const product = await getProduct(id);
  if (!product) notFound();

  const paymentMethods = await getSellerPaymentMethods(product.seller_id);

  const photos = (product as { product_photos?: { photo_url: string; is_cover: boolean }[] }).product_photos;
  const cover = photos?.find((p) => p.is_cover)?.photo_url ?? photos?.[0]?.photo_url;
  const outOfStock = product.status !== "active" || product.stock_quantity === 0;

  const errorMessages: Record<string, string> = {
    missing_city: "Choose a delivery city to continue.",
    missing_payment: "Choose how you'd like to pay.",
    order_failed: "Something went wrong placing your order. Try again.",
    out_of_stock: "This item just went out of stock.",
    not_found: "This listing is no longer available.",
  };

  return (
    <>
      <SiteHeader />
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="font-display text-xl mb-4" style={{ color: "var(--ink)" }}>
          Checkout
        </h1>

        <div className="flex gap-3 rounded-lg border p-3 mb-6 bg-white" style={{ borderColor: "var(--sand)" }}>
          <div className="w-16 h-16 rounded-md shrink-0 overflow-hidden" style={{ background: "var(--sand)" }}>
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{product.title}</p>
            <p className="text-sm font-bold" style={{ color: "var(--clay)" }}>
              GMD {Number(product.price).toLocaleString()}
            </p>
          </div>
        </div>

        {outOfStock ? (
          <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--sand)" }}>
            <p className="font-medium mb-2">This item is out of stock.</p>
            <Link href={`/products/${product.id}`} className="text-sm underline" style={{ color: "var(--indigo)" }}>
              Back to listing
            </Link>
          </div>
        ) : (
          <form action={createOrder} className="space-y-5">
            <input type="hidden" name="productId" value={product.id} />

            {error && errorMessages[error] && (
              <p className="text-sm text-red-600">{errorMessages[error]}</p>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">Quantity</label>
              <select
                name="quantity"
                defaultValue="1"
                className="w-24 rounded-lg border px-3 py-2 text-sm outline-none bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                {Array.from({ length: Math.min(product.stock_quantity, 10) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Payment method</label>
              <div className="space-y-2">
                {paymentMethods.map((m, i) => (
                  <label
                    key={m.id}
                    className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer text-sm"
                    style={{ borderColor: "var(--sand)" }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.id}
                      defaultChecked={i === 0}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium block">
                        Pay with {m.provider_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {m.method_type === "bank" ? "Bank transfer" : "Mobile money"},
                        you&apos;ll get the account details after checkout to send payment directly.
                      </span>
                    </span>
                  </label>
                ))}

                {paymentMethods.length === 0 && (
                  <p className="text-xs text-gray-500 rounded-lg border p-3" style={{ borderColor: "var(--sand)" }}>
                    This seller hasn&apos;t added a digital payment method yet, cash on
                    delivery is your only option for now.
                  </p>
                )}

                <label
                  className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer text-sm"
                  style={{ borderColor: "var(--sand)" }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    defaultChecked={paymentMethods.length === 0}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium block">Cash on delivery</span>
                    <span className="text-xs text-gray-500">
                      Pay in person when you receive the item. Inspect it before paying.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Delivery city</label>
              <select
                name="deliveryCity"
                required
                defaultValue={product.location_city ?? ""}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                <option value="">Select your city</option>
                {GAMBIA_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Delivery notes (optional)</label>
              <textarea
                name="deliveryNotes"
                rows={2}
                placeholder="Landmark, preferred meeting time, etc."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <p className="text-xs text-gray-500">
              Teraa doesn&apos;t hold payment in escrow. For digital payments, you pay
              the seller directly, for cash on delivery, inspect the item before paying.
            </p>

            <button
              type="submit"
              className="w-full rounded-full py-3 text-white text-sm font-semibold"
              style={{ background: "var(--indigo)" }}
            >
              Place order
            </button>
          </form>
        )}
      </main>
    </>
  );
}
