"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { GAMBIA_CITIES } from "@/types/database";

export default function AccountSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/account");
        return;
      }
      setEmail(user.email ?? null);

      const { data } = await supabase
        .from("users")
        .select("full_name, phone_number, city")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone_number ?? "");
        setCity(data.city ?? "");
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
      .from("users")
      .update({
        full_name: fullName,
        phone_number: phone,
        city,
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
        <h1 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Account settings
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Selling on Teraa? Business info and payment methods live in your{" "}
          <a href="/seller/dashboard/settings" className="underline">seller settings</a> instead.
        </p>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {email && (
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <input
                  disabled
                  value={email}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  style={{ borderColor: "var(--sand)" }}
                />
                <p className="text-xs text-gray-500 mt-1">Used to log in, can&apos;t be changed here.</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Phone number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
              <p className="text-xs text-gray-500 mt-1">Used for delivery contact and payment coordination.</p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">City</label>
              <select
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
                style={{ borderColor: "var(--sand)" }}
              >
                <option value="">Select your city</option>
                {GAMBIA_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
