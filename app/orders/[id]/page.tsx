import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { markOrderReceived, submitReview } from "./actions";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/orders/${id}`);

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, payment_method, payment_status, delivery_city, delivery_notes, created_at, buyer_id, order_items(quantity, price_at_purchase, products(title)), sellers(id, business_name, wave_number, verification_status)"
    )
    .eq("id", id)
    .single();

  if (!order) notFound();

  const items = (order as { order_items?: { quantity: number; price_at_purchase: number; products?: { title: string } | { title: string }[] }[] }).order_items ?? [];
  const sellerRaw = (order as { sellers?: { id: string; business_name: string; wave_number: string | null } | { id: string; business_name: string; wave_number: string | null }[] }).sellers;
  const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;
  const total = items.reduce((sum, i) => sum + i.quantity * Number(i.price_at_purchase), 0);

  const isBuyer = order.buyer_id === user.id;
  const canMarkReceived = isBuyer && !["completed", "cancelled"].includes(order.status);

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
            style={{ background: "var(--leaf)" }}
          >
            ✓
          </div>
          <h1 className="font-display text-xl" style={{ color: "var(--ink)" }}>
            Order placed
          </h1>
          <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}</p>
        </div>

        <div className="rounded-lg border p-4 mb-4 bg-white" style={{ borderColor: "var(--sand)" }}>
          {items.map((item, i) => {
            const productTitle = Array.isArray(item.products) ? item.products[0]?.title : item.products?.title;
            return (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>{item.quantity} × {productTitle}</span>
                <span>GMD {(item.quantity * Number(item.price_at_purchase)).toLocaleString()}</span>
              </div>
            );
          })}
          <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t" style={{ borderColor: "var(--sand)" }}>
            <span>Total</span>
            <span style={{ color: "var(--clay)" }}>GMD {total.toLocaleString()}</span>
          </div>
        </div>

        {order.payment_method === "wave" && seller && (
          <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--gold)", background: "#fbf3df" }}>
            <p className="text-sm font-medium mb-1">Complete your Wave payment</p>
            {seller.wave_number ? (
              <p className="text-sm">
                Send GMD {total.toLocaleString()} to <strong>{seller.wave_number}</strong> via Wave,
                then message the seller to confirm.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                The seller hasn&apos;t added a Wave number yet. Contact them directly to arrange payment.
              </p>
            )}
          </div>
        )}

        {order.payment_method === "cod" && (
          <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--sand)" }}>
            <p className="text-sm font-medium mb-1">Cash on delivery</p>
            <p className="text-sm text-gray-600">
              Pay when your item arrives in {order.delivery_city}. Inspect it before paying.
            </p>
          </div>
        )}

        <div className="rounded-lg border p-4 mb-6 text-sm" style={{ borderColor: "var(--sand)" }}>
          <p className="font-medium mb-1">Delivery</p>
          <p className="text-gray-600">{order.delivery_city}</p>
          {order.delivery_notes && <p className="text-gray-600 mt-1">{order.delivery_notes}</p>}
        </div>

        {canMarkReceived && (
          <form action={markOrderReceived.bind(null, order.id)} className="mb-4">
            <button
              type="submit"
              className="w-full rounded-full py-2.5 text-white text-sm font-semibold"
              style={{ background: "var(--leaf)" }}
            >
              I&apos;ve received this order
            </button>
            <p className="text-xs text-gray-500 text-center mt-1.5">
              Only confirm once you have the item. This lets you leave a review.
            </p>
          </form>
        )}

        {order.status === "completed" && seller && !existingReview && (
          <form action={submitReview} className="rounded-lg border p-4 mb-4 space-y-3" style={{ borderColor: "var(--sand)" }}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="sellerId" value={seller.id} />
            <p className="text-sm font-medium">Rate your experience with {seller.business_name}</p>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center text-xs cursor-pointer">
                  <input type="radio" name="rating" value={n} required className="mb-1" defaultChecked={n === 5} />
                  {n}★
                </label>
              ))}
            </div>
            <textarea
              name="comment"
              rows={2}
              placeholder="Optional: how was the item, communication, delivery?"
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none resize-none"
              style={{ borderColor: "var(--sand)" }}
            />
            <button
              type="submit"
              className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
              style={{ background: "var(--indigo)" }}
            >
              Submit review
            </button>
          </form>
        )}

        {existingReview && (
          <div className="rounded-lg border p-4 mb-4 text-sm" style={{ borderColor: "var(--sand)" }}>
            <p className="font-medium mb-1">You rated this order {existingReview.rating}★</p>
            {existingReview.comment && <p className="text-gray-600">{existingReview.comment}</p>}
          </div>
        )}

        <Link
          href="/"
          className="block text-center rounded-full py-2.5 text-sm font-medium border"
          style={{ borderColor: "var(--sand)" }}
        >
          Continue browsing
        </Link>
      </main>
    </>
  );
}
