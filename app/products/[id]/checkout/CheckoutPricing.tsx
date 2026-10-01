"use client";

import { useEffect, useMemo, useState } from "react";
import { currentOffer, normalizeVoucherCode, offerPrice, type ProductOffer } from "@/lib/offer-pricing";

export type DeliveryCoverageOption = {
  region: string;
  area: string;
  deliveryFee: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
};

function deliveryTimeLabel(minDays: number, maxDays: number) {
  if (minDays === 0 && maxDays === 0) return "Same day";
  if (minDays === maxDays) return `${minDays} day${minDays === 1 ? "" : "s"}`;
  return `${minDays}–${maxDays} days`;
}

function money(value: number) {
  return `GMD ${value.toLocaleString()}`;
}

export function CheckoutPricing({
  productPrice,
  stockQuantity,
  availableSizes,
  availableColors,
  deliveryCoverage,
  offer,
  quoteTime,
  initialVoucher,
}: {
  productPrice: number;
  stockQuantity: number;
  availableSizes: string[];
  availableColors: string[];
  deliveryCoverage: DeliveryCoverageOption[];
  offer: ProductOffer | null;
  quoteTime: number;
  initialVoucher: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedValue, setSelectedValue] = useState("");
  const [now, setNow] = useState(quoteTime);
  const [code, setCode] = useState(initialVoucher);
  const [appliedCode, setAppliedCode] = useState(
    offer?.kind === "voucher" && normalizeVoucherCode(initialVoucher) === offer.voucher_code ? offer.voucher_code : "",
  );
  const [voucherError, setVoucherError] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const activeOffer = currentOffer(offer, now);
  const discountApplied = activeOffer?.kind === "discount" || (activeOffer?.kind === "voucher" && appliedCode === activeOffer.voucher_code);
  const unitPrice = discountApplied && activeOffer ? offerPrice(productPrice, activeOffer.percent_off) : productPrice;

  function applyVoucher() {
    if (activeOffer?.kind === "voucher" && normalizeVoucherCode(code) === activeOffer.voucher_code) {
      setAppliedCode(activeOffer.voucher_code ?? "");
      setVoucherError("");
    } else {
      setAppliedCode("");
      setVoucherError("This voucher is invalid or expired for this product.");
    }
  }

  const selectedCoverage = useMemo(
    () => deliveryCoverage.find((option) => (
      JSON.stringify({ region: option.region, area: option.area }) === selectedValue
    )),
    [deliveryCoverage, selectedValue],
  );

  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const savings = Math.round((productPrice - unitPrice) * quantity * 100) / 100;
  const deliveryFee = selectedCoverage?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const regions = Array.from(
    new Set(deliveryCoverage.map((option) => option.region)),
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <input type="hidden" name="voucherCode" value={activeOffer?.kind === "voucher" ? appliedCode : ""} />
      <input type="hidden" name="expectedUnitPrice" value={unitPrice.toFixed(2)} />
      {offer?.kind === "voucher" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <label htmlFor="checkout-voucher" className="block text-sm font-medium mb-2">Voucher code</label>
        <div className="flex gap-2"><input id="checkout-voucher" maxLength={20} value={code} onChange={(e) => { setCode(e.target.value); setAppliedCode(""); setVoucherError(""); }} placeholder="Enter code" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 uppercase" />
          <button type="button" onClick={applyVoucher} className="secondary-button">Apply</button></div>
        {voucherError && <p role="alert" className="mt-2 text-xs text-red-700">{voucherError}</p>}
        {discountApplied && <p role="status" className="mt-2 text-xs text-emerald-800">{activeOffer?.percent_off}% voucher applied.</p>}
        {!activeOffer && <p role="status" className="mt-2 text-xs text-gray-600">This offer has expired.</p>}
      </div>}
      {(availableSizes.length > 0 || availableColors.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {availableSizes.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">Size</label>
              <select
                name="selectedSize"
                required
                defaultValue=""
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                <option value="">Choose a size</option>
                {availableSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableColors.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">Colour</label>
              <select
                name="selectedColor"
                required
                defaultValue=""
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                <option value="">Choose a colour</option>
                {availableColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-1">Quantity</label>
        <select
          name="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="w-24 rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
          style={{ borderColor: "var(--sand)" }}
        >
          {Array.from(
            { length: Math.min(stockQuantity, 10) },
            (_, index) => index + 1,
          ).map((itemQuantity) => (
            <option key={itemQuantity} value={itemQuantity}>
              {itemQuantity}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Delivery area</label>
        <select
          name="deliveryCoverage"
          required
          value={selectedValue}
          onChange={(event) => setSelectedValue(event.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
          style={{ borderColor: "var(--sand)" }}
        >
          <option value="">Select where you want delivery</option>
          {regions.map((region) => (
            <optgroup key={region} label={region}>
              {deliveryCoverage
                .filter((option) => option.region === region)
                .map((option) => {
                  const value = JSON.stringify({
                    region: option.region,
                    area: option.area,
                  });
                  const feeLabel = option.deliveryFee === 0
                    ? "Free delivery"
                    : money(option.deliveryFee);

                  return (
                    <option key={value} value={value}>
                      {option.area} · {feeLabel} · {deliveryTimeLabel(
                        option.estimatedMinDays,
                        option.estimatedMaxDays,
                      )}
                    </option>
                  );
                })}
            </optgroup>
          ))}
        </select>
      </div>

      <div
        className="rounded-xl border p-3 space-y-2 text-sm"
        style={{ borderColor: "var(--sand)", background: "#fbfaf7" }}
      >
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Product subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {savings > 0 && <div className="flex justify-between gap-4 text-emerald-800"><span>You save ({activeOffer?.percent_off}%)</span><span>{money(savings)}</span></div>}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Delivery</span>
          <span>{selectedCoverage ? money(deliveryFee) : "Choose an area"}</span>
        </div>
        <div
          className="flex justify-between gap-4 border-t pt-2 font-bold"
          style={{ borderColor: "var(--sand)" }}
        >
          <span>Total payable</span>
          <span style={{ color: "var(--clay)" }}>
            {selectedCoverage ? money(total) : "Select area"}
          </span>
        </div>
        {selectedCoverage && (
          <p className="text-xs text-gray-500 pt-1">
            Estimated delivery: {deliveryTimeLabel(
              selectedCoverage.estimatedMinDays,
              selectedCoverage.estimatedMaxDays,
            )}
          </p>
        )}
      </div>
    </div>
  );
}
