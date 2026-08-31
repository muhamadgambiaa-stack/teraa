"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";

export default function AccountSettingsPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirect=/account/settings");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("users")
        .select("full_name, phone_number")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError || !data) {
        setError("Couldn't load your account settings.");
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");
      setFullName(data.full_name ?? "");
      setPhone(data.phone_number ?? "");
      setLoading(false);
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: fullName.trim(),
        phone_number: phone.trim(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "#fffdf8" }}
      >
        <div className="text-center">
          <img
            src="/branding/teraa-icon.svg"
            alt=""
            width="64"
            height="64"
            className="mx-auto"
          />
          <p
            className="mt-3 font-semibold"
            style={{ color: "var(--indigo)" }}
          >
            Teraa
          </p>
          <p className="text-sm text-gray-400 mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <Link
          href="/account"
          className="text-sm font-medium"
          style={{ color: "var(--indigo)" }}
        >
          ‹ Account
        </Link>

        <h1
          className="font-display text-2xl font-bold mt-4"
          style={{ color: "var(--ink)" }}
        >
          Settings
        </h1>

        <p className="text-sm text-gray-500 mt-1 mb-5">
          Manage your personal information.
        </p>

        <section
          className="rounded-xl border bg-white p-4"
          style={{ borderColor: "var(--sand)" }}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {email && (
              <div>
                <label className="text-sm font-medium block mb-1">
                  Email
                </label>

                <input
                  disabled
                  value={email}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
                  style={{ borderColor: "var(--sand)" }}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">
                Full name
              </label>

              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Phone number
              </label>

              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-full px-6 py-2.5 text-white text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            {saved && (
              <p className="text-sm" style={{ color: "var(--leaf)" }}>
                Saved
              </p>
            )}
          </form>
        </section>
      </main>
    </>
  );
}
