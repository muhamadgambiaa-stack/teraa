"use client";

import { useMemo, useState } from "react";

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
  deliveryCoverage,
}: {
  productPrice: number;
  stockQuantity: number;
  deliveryCoverage: DeliveryCoverageOption[];
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedValue, setSelectedValue] = useState("");

  const selectedCoverage = useMemo(
    () => deliveryCoverage.find((option) => (
      JSON.stringify({ region: option.region, area: option.area }) === selectedValue
    )),
    [deliveryCoverage, selectedValue],
  );

  const subtotal = productPrice * quantity;
  const deliveryFee = selectedCoverage?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const regions = Array.from(
    new Set(deliveryCoverage.map((option) => option.region)),
  );

  return (
    <div className="space-y-5">
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
                      {option.area} — {feeLabel} — {deliveryTimeLabel(
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
        className="rounded-xl border p-4 space-y-2 text-sm"
        style={{ borderColor: "var(--sand)", background: "#fbfaf7" }}
      >
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Product subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
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
            {selectedCoverage ? money(total) : "—"}
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
