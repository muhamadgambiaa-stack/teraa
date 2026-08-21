"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export default function VerifyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be logged in.");
      setLoading(false);
      return;
    }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/id-document.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("seller-documents")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("sellers")
      .update({
        id_document_url: path,
        verification_status: "pending",
      })
      .eq("id", user.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/seller/dashboard");
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-10">
        <h1 className="font-display text-xl mb-2" style={{ color: "var(--ink)" }}>
          Verify your identity
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Upload a clear photo of your Gambian national ID, passport, or business
          registration. This is reviewed manually, approval usually takes less than
          a day, and your listings won&apos;t be visible until you&apos;re approved.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">ID document photo</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--sand)" }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Make sure all text is legible and the photo isn&apos;t blurry.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Uploading…" : "Submit for review"}
          </button>
        </form>
      </main>
    </>
  );
}
