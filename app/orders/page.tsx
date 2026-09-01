import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import type { OrderStatus } from "@/types/database";

const STATUS_STYLES: Record<OrderStatus, { bg: string; color: string; label: string }> = {
  placed: { bg: "#fbf3df", color: "var(--gold)", label: "Placed" },
  confirmed: { bg: "#e6edf3", color: "var(--indigo)", label: "Confirmed" },
  shipped: { bg: "#e6edf3", color: "var(--indigo)", label: "Shipped" },
  delivered: { bg: "#e3f0e8", color: "var(--leaf)", label: "Delivered" },
  completed: { bg: "#e3f0e8", color: "var(--leaf)", label: "Completed" },
  cancelled: { bg: "#eee", color: "#888", label: "Cancelled" },
};

export default async function MyOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/orders");

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, payment_method, delivery_fee, created_at, order_items(quantity, price_at_purchase, products(title)), sellers(business_name)"
    )
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 sm:pb-8">
        <div className="mb-4">
          <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>
            My orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track purchases and confirm when deliveries arrive.
          </p>
        </div>

        {(!orders || orders.length === 0) && (
          <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--sand)" }}>
            <p className="font-medium mb-1">No orders yet</p>
            <p className="text-sm text-gray-500 mb-4">When you buy something, it will show up here.</p>
            <Link
              href="/"
              className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
              style={{ background: "var(--indigo)" }}
            >
              Browse listings
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {(orders ?? []).map((o) => {
            const items = (o as { order_items?: { quantity: number; price_at_purchase: number; products?: { title: string } | { title: string }[] }[] }).order_items ?? [];
            const sellerRaw = (o as { sellers?: { business_name: string } | { business_name: string }[] }).sellers;
            const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;
            const total = items.reduce((sum, i) => sum + i.quantity * Number(i.price_at_purchase), 0) + Number(o.delivery_fee ?? 0);
            const style = STATUS_STYLES[o.status as OrderStatus];

            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-xl border border-l-[3px] p-3.5 bg-white hover:shadow-sm transition-shadow"
                style={{
                  borderColor: "var(--sand)",
                  borderLeftColor: style.color,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.color }}>
                    {style.label}
                  </span>
                </div>
                {items.map((item, i) => {
                  const title = Array.isArray(item.products) ? item.products[0]?.title : item.products?.title;
                  return (
                    <p key={i} className="text-sm">
                      {item.quantity} × {title}
                    </p>
                  );
                })}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{seller?.business_name}</span>
                  <span className="text-sm font-bold" style={{ color: "var(--clay)" }}>
                    GMD {total.toLocaleString()}
                  </span>
                </div>

                <div
                  className="flex items-center justify-end gap-1 mt-3 pt-2 border-t text-xs font-medium"
                  style={{ borderColor: "var(--sand)", color: "var(--indigo)" }}
                >
                  View order
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
