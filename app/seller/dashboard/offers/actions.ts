"use server";

import { revalidatePath } from "next/cache";
import { requireOfferSeller } from "@/lib/seller-offer-access";
import { normalizeVoucherCode } from "@/lib/offer-pricing";

export type OfferResult = { error?: string; saved?: boolean };

function refreshOffers(id: string) {
  for (const path of ["/deals", "/", "/search", "/favorites", "/seller/dashboard/offers", `/products/${id}`, `/products/${id}/checkout`]) revalidatePath(path);
}

export async function saveOffer(_previous: OfferResult, form: FormData): Promise<OfferResult> {
  const { supabase, user } = await requireOfferSeller();
  const productId = String(form.get("product_id") ?? "");
  const kind = String(form.get("kind") ?? "");
  const percent = Number(form.get("percent_off"));
  const days = Number(form.get("days"));
  const code = normalizeVoucherCode(String(form.get("voucher_code") ?? ""));
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) return { error: "Enter a discount from 1% to 90%." };
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Choose a duration from 1 to 90 days." };
  if (kind !== "discount" && kind !== "voucher") return { error: "Choose an offer type." };
  if (kind === "voucher" && !/^[A-Z0-9]{3,20}$/.test(code)) return { error: "Use 3–20 letters or numbers for your voucher code." };
  const { data: product } = await supabase.from("products").select("id, price")
    .eq("id", productId).eq("seller_id", user.id).eq("status", "active").gt("stock_quantity", 0).is("seller_deleted_at", null).maybeSingle();
  if (!product || Number(product.price) <= 0) return { error: "Choose one of your active, in-stock products with a price above zero." };
  const { error } = await supabase.from("product_offers").upsert({
    product_id: productId, seller_id: user.id, kind, percent_off: percent,
    voucher_code: kind === "voucher" ? code : null,
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
  }, { onConflict: "product_id" });
  if (error) {
    console.error("Offer save failed:", error);
    return { error: "Couldn't save this offer. Please try again." };
  }
  refreshOffers(productId);
  return { saved: true };
}

export async function removeOffer(form: FormData) {
  const { supabase, user } = await requireOfferSeller();
  const productId = String(form.get("product_id") ?? "");
  const { error } = await supabase.from("product_offers").delete().eq("product_id", productId).eq("seller_id", user.id);
  if (error) throw new Error("Couldn't end this offer. Please try again.");
  refreshOffers(productId);
}
