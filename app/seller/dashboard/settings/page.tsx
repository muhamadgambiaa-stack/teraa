"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { useRouter } from "next/navigation";
import {
  GAMBIA_DELIVERY_REGIONS,
  type PaymentMethodType,
  type SellerPaymentMethod,
} from "@/types/database";

type DeliveryArea = {
  area: string;
  deliveryFee: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
};

type AreaDraft = {
  area: string;
  deliveryFee: string;
  deliverySpeed: string;
};

const DEFAULT_AREA_DRAFT: AreaDraft = {
  area: "",
  deliveryFee: "0",
  deliverySpeed: "1-2",
};

const DELIVERY_SPEED_OPTIONS = [
  { value: "0-0", label: "Same day" },
  { value: "1-2", label: "1–2 days" },
  { value: "3-5", label: "3–5 days" },
  { value: "5-7", label: "5–7 days" },
] as const;

export default function SellerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [deliveryRegions, setDeliveryRegions] = useState<string[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<Record<string, DeliveryArea[]>>({});
  const [areaDrafts, setAreaDrafts] = useState<Record<string, AreaDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [methods, setMethods] = useState<SellerPaymentMethod[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [methodType, setMethodType] = useState<PaymentMethodType>("mobile_money");
  const [providerName, setProviderName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);

  async function loadMethods(id: string) {
    const { data } = await supabase
      .from("seller_payment_methods")
      .select("*")
      .eq("seller_id", id)
      .order("created_at", { ascending: true });
    setMethods((data as SellerPaymentMethod[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setSellerId(user.id);
      const [{ data }, { data: areaRows }] = await Promise.all([
        supabase
          .from("sellers")
          .select("business_name, shop_description, delivery_regions")
          .eq("id", user.id)
          .single(),
        supabase
          .from("seller_delivery_areas")
          .select("region, area, delivery_fee, estimated_min_days, estimated_max_days")
          .eq("seller_id", user.id)
          .order("region")
          .order("area"),
      ]);

      if (data) {
        setBusinessName(data.business_name ?? "");
        setShopDescription(data.shop_description ?? "");
        setDeliveryRegions(data.delivery_regions ?? []);
      }

      const groupedAreas: Record<string, DeliveryArea[]> = {};
      for (const row of areaRows ?? []) {
        groupedAreas[row.region] = [
          ...(groupedAreas[row.region] ?? []),
          {
            area: row.area,
            deliveryFee: Number(row.delivery_fee ?? 0),
            estimatedMinDays: Number(row.estimated_min_days ?? 1),
            estimatedMaxDays: Number(row.estimated_max_days ?? 3),
          },
        ];
      }
      setDeliveryAreas(groupedAreas);
      await loadMethods(user.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    if (deliveryRegions.length === 0) {
      setSaving(false);
      setError("Choose at least one region where you can deliver.");
      return;
    }

    const areasToSave = { ...deliveryAreas };

    for (const region of deliveryRegions) {
      const draft = areaDrafts[region] ?? DEFAULT_AREA_DRAFT;
      const areaName = draft.area.trim();
      const savedAreas = areasToSave[region] ?? [];

      const deliveryFee = Number(draft.deliveryFee);
      const [estimatedMinDays, estimatedMaxDays] = draft.deliverySpeed
        .split("-")
        .map(Number);

      if (
        areaName.length >= 2 &&
        Number.isFinite(deliveryFee) &&
        deliveryFee >= 0 &&
        !savedAreas.some(
          (item) => item.area.toLowerCase() === areaName.toLowerCase(),
        )
      ) {
        areasToSave[region] = [
          ...savedAreas,
          { area: areaName, deliveryFee, estimatedMinDays, estimatedMaxDays },
        ];
      }
    }

    const regionWithoutAreas = deliveryRegions.find(
      (region) => !(areasToSave[region]?.length),
    );

    if (regionWithoutAreas) {
      setSaving(false);
      setError(`Add at least one town or area inside ${regionWithoutAreas}.`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("sellers")
      .update({
        business_name: businessName,
        shop_description: shopDescription,
      })
      .eq("id", user.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const coverage = deliveryRegions.flatMap((region) =>
      (areasToSave[region] ?? []).map((item) => ({
        region,
        area: item.area,
        delivery_fee: item.deliveryFee,
        estimated_min_days: item.estimatedMinDays,
        estimated_max_days: item.estimatedMaxDays,
      })),
    );

    const { error: coverageError } = await supabase.rpc(
      "set_seller_delivery_areas",
      { p_coverage: coverage },
    );

    setSaving(false);

    if (coverageError) {
      setError(coverageError.message);
      return;
    }

    setDeliveryAreas(areasToSave);
    setAreaDrafts({});

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addDeliveryArea(region: string) {
    const draft = areaDrafts[region] ?? DEFAULT_AREA_DRAFT;
    const area = draft.area.trim();
    const deliveryFee = Number(draft.deliveryFee);
    const [estimatedMinDays, estimatedMaxDays] = draft.deliverySpeed
      .split("-")
      .map(Number);

    if (area.length < 2) {
      setError(`Enter a town or area inside ${region}.`);
      return;
    }

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      setError(`Enter a valid delivery fee for ${area}.`);
      return;
    }

    if ((deliveryAreas[region] ?? []).some(
      (item) => item.area.toLowerCase() === area.toLowerCase(),
    )) {
      setError(`${area} is already added under ${region}.`);
      return;
    }

    setDeliveryAreas((current) => ({
      ...current,
      [region]: [
        ...(current[region] ?? []),
        { area, deliveryFee, estimatedMinDays, estimatedMaxDays },
      ],
    }));
    setAreaDrafts((current) => ({
      ...current,
      [region]: DEFAULT_AREA_DRAFT,
    }));
    setError(null);
  }

  function removeDeliveryArea(region: string, area: string) {
    setDeliveryAreas((current) => ({
      ...current,
      [region]: (current[region] ?? []).filter((item) => item.area !== area),
    }));
  }

  function updateDeliveryArea(
    region: string,
    areaName: string,
    changes: Partial<DeliveryArea>,
  ) {
    setDeliveryAreas((current) => ({
      ...current,
      [region]: (current[region] ?? []).map((item) =>
        item.area === areaName ? { ...item, ...changes } : item,
      ),
    }));
  }

  async function handleAddMethod(e: React.FormEvent) {
    e.preventDefault();
    if (!sellerId) return;
    setAddingMethod(true);
    setMethodError(null);

    const { error: insertError } = await supabase.from("seller_payment_methods").insert({
      seller_id: sellerId,
      method_type: methodType,
      provider_name: providerName,
      account_name: accountName,
      account_number: accountNumber,
    });

    setAddingMethod(false);

    if (insertError) {
      setMethodError(insertError.message);
      return;
    }

    setProviderName("");
    setAccountName("");
    setAccountNumber("");
    setShowAddForm(false);
    await loadMethods(sellerId);
  }

  async function handleRemoveMethod(id: string) {
    if (!sellerId) return;
    await supabase.from("seller_payment_methods").delete().eq("id", id);
    await loadMethods(sellerId);
  }

  return (
    <>
      <SiteHeader />
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-6" style={{ color: "var(--ink)" }}>
          Seller settings
        </h1>
        <SellerNav active="settings" />

        {loading ? (
          <div
  className="fixed inset-0 z-[100] flex items-center justify-center px-6"
  style={{ background: "#fffdf8" }}
  role="status"
  aria-live="polite"
  aria-label="Loading Teraa"
>
  <div className="flex flex-col items-center">
    <img
      src="/branding/teraa-icon.svg"
      alt=""
      width="72"
      height="72"
      className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
    />

    <p
      className="mt-3 text-lg font-semibold"
      style={{ color: "var(--indigo)" }}
    >
      Teraa
    </p>

    <p className="mt-1 text-sm text-gray-400">Loading...</p>

    <div className="mt-5 flex items-center gap-2" aria-hidden="true">
      <span
        className="h-2 w-2 rounded-full animate-pulse"
        style={{ background: "var(--indigo)" }}
      />

      <span
        className="h-2 w-2 rounded-full animate-pulse"
        style={{
          background: "var(--leaf)",
          animationDelay: "150ms",
        }}
      />

      <span
        className="h-2 w-2 rounded-full animate-pulse"
        style={{
          background: "var(--indigo)",
          animationDelay: "300ms",
        }}
      />
    </div>
  </div>
</div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-5 mb-10">
              <div>
                <label className="text-sm font-medium block mb-1">Business name</label>
                <input
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "var(--sand)" }}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Shop description</label>
                <textarea
                  value={shopDescription}
                  onChange={(e) => setShopDescription(e.target.value)}
                  rows={3}
                  placeholder="What do you sell? What makes your shop trustworthy?"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "var(--sand)" }}
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium mb-1">
                  Where can you deliver?
                </legend>
                <p className="text-xs text-gray-500 mb-3">
                  Choose a region, then add the towns or areas you can serve inside it.
                </p>
                <div className="space-y-3">
                  {GAMBIA_DELIVERY_REGIONS.map((region) => {
                    const selected = deliveryRegions.includes(region);

                    return (
                      <div
                        key={region}
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--sand)" }}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setDeliveryRegions((current) => [...current, region]);
                              } else {
                                setDeliveryRegions((current) =>
                                  current.filter((item) => item !== region),
                                );
                                setDeliveryAreas((current) => {
                                  const next = { ...current };
                                  delete next[region];
                                  return next;
                                });
                              }
                            }}
                          />
                          <span className="text-sm font-medium">{region}</span>
                        </label>

                        {selected && (
                          <div className="mt-3 pl-7">
                            <div className="space-y-2 mb-3">
                              {(deliveryAreas[region] ?? []).map((item) => (
                                <div
                                  key={item.area}
                                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] items-center gap-2 rounded-lg p-2"
                                  style={{ background: "#eef1f5" }}
                                >
                                  <strong className="text-sm">{item.area}</strong>
                                  <label className="text-xs text-gray-500">
                                    Fee (GMD)
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={item.deliveryFee}
                                      onChange={(event) => updateDeliveryArea(
                                        region,
                                        item.area,
                                        { deliveryFee: Number(event.target.value) },
                                      )}
                                      className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-sm text-gray-900 outline-none"
                                      style={{ borderColor: "var(--sand)" }}
                                    />
                                  </label>
                                  <label className="text-xs text-gray-500">
                                    Delivery time
                                    <select
                                      value={`${item.estimatedMinDays}-${item.estimatedMaxDays}`}
                                      onChange={(event) => {
                                        const [estimatedMinDays, estimatedMaxDays] = event.target.value
                                          .split("-")
                                          .map(Number);
                                        updateDeliveryArea(region, item.area, {
                                          estimatedMinDays,
                                          estimatedMaxDays,
                                        });
                                      }}
                                      className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-sm text-gray-900 outline-none"
                                      style={{ borderColor: "var(--sand)" }}
                                    >
                                      {DELIVERY_SPEED_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => removeDeliveryArea(region, item.area)}
                                    aria-label={`Remove ${item.area}`}
                                    className="justify-self-start sm:justify-self-center rounded-full px-2 py-1 text-sm font-bold text-red-600"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2">
                              <input
                                value={(areaDrafts[region] ?? DEFAULT_AREA_DRAFT).area}
                                onChange={(event) => setAreaDrafts((current) => ({
                                  ...current,
                                  [region]: {
                                    ...(current[region] ?? DEFAULT_AREA_DRAFT),
                                    area: event.target.value,
                                  },
                                }))}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addDeliveryArea(region);
                                  }
                                }}
                                maxLength={100}
                                placeholder="Town or area"
                                className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--sand)" }}
                              />
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={(areaDrafts[region] ?? DEFAULT_AREA_DRAFT).deliveryFee}
                                onChange={(event) => setAreaDrafts((current) => ({
                                  ...current,
                                  [region]: {
                                    ...(current[region] ?? DEFAULT_AREA_DRAFT),
                                    deliveryFee: event.target.value,
                                  },
                                }))}
                                aria-label={`Delivery fee for ${region}`}
                                placeholder="Fee (GMD)"
                                className="rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--sand)" }}
                              />
                              <select
                                value={(areaDrafts[region] ?? DEFAULT_AREA_DRAFT).deliverySpeed}
                                onChange={(event) => setAreaDrafts((current) => ({
                                  ...current,
                                  [region]: {
                                    ...(current[region] ?? DEFAULT_AREA_DRAFT),
                                    deliverySpeed: event.target.value,
                                  },
                                }))}
                                aria-label={`Delivery time for ${region}`}
                                className="rounded-lg border px-3 py-2 text-sm bg-white outline-none"
                                style={{ borderColor: "var(--sand)" }}
                              >
                                {DELIVERY_SPEED_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => addDeliveryArea(region)}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-white"
                                style={{ background: "var(--indigo)" }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full px-6 py-2.5 text-white text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--indigo)" }}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saved && <span className="ml-3 text-sm" style={{ color: "var(--leaf)" }}>Saved</span>}
            </form>

            <div>
              <h2 className="text-sm font-semibold mb-1">Payment methods <span className="text-xs font-normal text-gray-400">(coming soon)</span></h2>
              <p className="text-xs text-gray-500 mb-3">
                You can save a bank or mobile money account for future use.
                Digital payments are not active yet and these details are not shown to buyers.
                Cash on delivery is currently the only checkout method.
              </p>

              {methods.length === 0 && !showAddForm && (
                <p className="text-sm text-gray-500 mb-3">No payment methods added yet.</p>
              )}

              <div className="space-y-2 mb-3">
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3 bg-white"
                    style={{ borderColor: "var(--sand)" }}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {m.provider_name}
                        <span className="text-xs text-gray-400 ml-2">
                          {m.method_type === "bank" ? "Bank" : "Mobile money"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">{m.account_name}, {m.account_number}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMethod(m.id)}
                      className="text-xs text-gray-400 hover:underline shrink-0 ml-3"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="rounded-full px-4 py-2 text-sm font-medium border"
                  style={{ borderColor: "var(--indigo)", color: "var(--indigo)" }}
                >
                  + Add payment method
                </button>
              ) : (
                <form onSubmit={handleAddMethod} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--sand)" }}>
                  <div>
                    <label className="text-xs font-medium block mb-1">Type</label>
                    <div className="flex gap-2">
                      {(["mobile_money", "bank"] as PaymentMethodType[]).map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setMethodType(t)}
                          className="flex-1 rounded-lg border py-2 text-xs"
                          style={{
                            borderColor: methodType === t ? "var(--indigo)" : "var(--sand)",
                            background: methodType === t ? "var(--indigo)" : "white",
                            color: methodType === t ? "white" : "var(--ink)",
                          }}
                        >
                          {t === "mobile_money" ? "Mobile money" : "Bank account"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {methodType === "mobile_money" ? "Provider (e.g. Wave, QMoney)" : "Bank name"}
                    </label>
                    <input
                      required
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Account holder name</label>
                    <input
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {methodType === "mobile_money" ? "Mobile money number" : "Account number"}
                    </label>
                    <input
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--sand)" }}
                    />
                  </div>

                  {methodError && <p className="text-xs text-red-600">{methodError}</p>}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={addingMethod}
                      className="rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--indigo)" }}
                    >
                      {addingMethod ? "Addingâ€¦" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-full px-4 py-1.5 text-xs font-medium border"
                      style={{ borderColor: "var(--sand)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
