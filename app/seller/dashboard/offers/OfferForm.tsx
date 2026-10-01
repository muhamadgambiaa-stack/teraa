"use client";

import { useActionState, useState } from "react";
import { saveOffer } from "./actions";
import { offerPrice } from "@/lib/offer-pricing";

export function OfferForm({ products, initialProduct }: { products: { id: string; title: string; price: number }[]; initialProduct?: string }) {
  const [result, action, pending] = useActionState(saveOffer, {});
  const [kind, setKind] = useState("discount");
  const [productId, setProductId] = useState(initialProduct ?? "");
  const [percent, setPercent] = useState(10);
  const product = products.find((row) => row.id === productId);
  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "var(--sand)" }}>
      <h2 className="font-display text-lg">Create or replace an offer</h2>
      <div><label htmlFor="offer-product" className="block text-sm font-medium mb-1">Product</label>
        <select id="offer-product" name="product_id" required value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-gray-300 p-3">
          <option value="">Choose a product</option>
          {products.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </div>
      <div><label htmlFor="offer-kind" className="block text-sm font-medium mb-1">Offer type</label>
        <select id="offer-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border border-gray-300 p-3">
          <option value="discount">Automatic discount</option><option value="voucher">Voucher code</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="offer-percent" className="block text-sm font-medium mb-1">Discount (%)</label>
          <input id="offer-percent" name="percent_off" type="number" inputMode="numeric" min="1" max="90" step="1" required value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 p-3" />
        </div>
        <div><label htmlFor="offer-days" className="block text-sm font-medium mb-1">Duration (days)</label>
          <input id="offer-days" name="days" type="number" inputMode="numeric" min="1" max="90" step="1" defaultValue={7} required className="w-full rounded-lg border border-gray-300 p-3" />
        </div>
      </div>
      {kind === "voucher" && <div><label htmlFor="offer-code" className="block text-sm font-medium mb-1">Voucher code</label>
        <input id="offer-code" name="voucher_code" required minLength={3} maxLength={20} pattern="[A-Za-z0-9]{3,20}" placeholder="e.g. TERAA10" className="w-full rounded-lg border border-gray-300 p-3 uppercase" />
      </div>}
      {product && percent >= 1 && percent <= 90 && <p className="text-sm text-emerald-800">GMD {Number(product.price).toLocaleString()} → GMD {offerPrice(Number(product.price), percent).toLocaleString()}{kind === "voucher" ? " with the code" : " automatically"}</p>}
      <p className="text-xs text-gray-500">One offer per product. Vouchers are public, reusable until expiry, and apply to this product only. Delivery is excluded.</p>
      {result.error && <p role="alert" className="text-sm text-red-700">{result.error}</p>}
      {result.saved && <p role="status" className="text-sm text-emerald-700">Offer saved. It is now available in Deals.</p>}
      <button disabled={pending} className="primary-button w-full justify-center disabled:opacity-60">{pending ? "Saving…" : "Save offer"}</button>
    </form>
  );
}
