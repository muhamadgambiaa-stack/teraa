import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentOffer, offerPrice, type ProductOffer } from "@/lib/offer-pricing";

export async function getProductOffers(ids: string[]) {
  if (!ids.length) return new Map<string, ProductOffer>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_offers")
    .select("product_id, kind, percent_off, voucher_code, expires_at")
    .in("product_id", ids).gt("expires_at", new Date().toISOString());
  if (error) {
    console.error("Could not load product offers:", error);
    return new Map<string, ProductOffer>();
  }
  return new Map((data ?? []).map((row) => [row.product_id, row as ProductOffer]));
}

export async function withProductOffers<T extends { id: string; price: number }>(products: T[]) {
  const offers = await getProductOffers(products.map((product) => product.id));
  const now = Date.now();
  return products.map((product) => {
    const offer = currentOffer(offers.get(product.id), now);
    return {
      ...product,
      originalPrice: Number(product.price),
      price: offer?.kind === "discount" ? offerPrice(Number(product.price), offer.percent_off) : Number(product.price),
      offer,
    };
  });
}
