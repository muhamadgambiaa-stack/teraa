"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { useRouter } from "next/navigation";
import type { PaymentMethodType, SellerPaymentMethod } from "@/types/database";

export default function SellerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
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
      const { data } = await supabase
        .from("sellers")
        .select("business_name, shop_description")
        .eq("id", user.id)
        .single();

      if (data) {
        setBusinessName(data.business_name ?? "");
        setShopDescription(data.shop_description ?? "");
      }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("sellers")
      .update({
        business_name: businessName,
        shop_description: shopDescription,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
          <p className="text-sm text-gray-500">Loading…</p>
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full px-6 py-2.5 text-white text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--indigo)" }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && <span className="ml-3 text-sm" style={{ color: "var(--leaf)" }}>Saved ✓</span>}
            </form>

            <div>
              <h2 className="text-sm font-semibold mb-1">Payment methods</h2>
              <p className="text-xs text-gray-500 mb-3">
                Add a bank account or mobile money account (Wave, or any other provider).
                Buyers choosing digital payment at checkout will see these options and pay
                you directly. Cash on delivery is always available with no setup needed.
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
                      {addingMethod ? "Adding…" : "Add"}
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
