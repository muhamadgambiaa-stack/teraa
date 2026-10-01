export type ProductOffer = {
  product_id: string;
  kind: "discount" | "voucher";
  percent_off: number;
  voucher_code: string | null;
  expires_at: string;
};

export function normalizeVoucherCode(code: string) {
  return code.trim().toUpperCase();
}

export function offerPrice(price: number, percent: number) {
  const cents = Math.round(price * 100);
  return Math.round(cents * (100 - percent) / 100) / 100;
}

export function currentOffer(offer: ProductOffer | null | undefined, now: number) {
  return offer && Date.parse(offer.expires_at) > now ? offer : null;
}
