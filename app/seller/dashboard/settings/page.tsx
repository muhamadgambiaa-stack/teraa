"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { useRouter } from "next/navigation";

export default function SellerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [waveNumber, setWaveNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("sellers")
        .select("business_name, shop_description, wave_number")
        .eq("id", user.id)
        .single();

      if (data) {
        setBusinessName(data.business_name ?? "");
        setShopDescription(data.shop_description ?? "");
        setWaveNumber(data.wave_number ?? "");
      }
      setLoading(false);
    })();
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
        wave_number: waveNumber,
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
          <form onSubmit={handleSave} className="space-y-5">
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

            <div>
              <label className="text-sm font-medium block mb-1">Wave number</label>
              <input
                value={waveNumber}
                onChange={(e) => setWaveNumber(e.target.value)}
                placeholder="+220 7XX XXXX"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Shown to buyers after checkout so they can send you Wave payment directly.
              </p>
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
        )}
      </main>
    </>
  );
}
