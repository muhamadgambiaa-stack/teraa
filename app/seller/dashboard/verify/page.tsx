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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You need to be logged in.");
      }

      /*
       * Keep verification uploads limited to images.
       */
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image of your ID document.");
      }

      /*
       * 8 MB is enough for normal phone photos while
       * preventing unnecessarily large uploads.
       */
      const maxFileSize = 8 * 1024 * 1024;

      if (file.size > maxFileSize) {
        throw new Error(
          "The image is too large. Please upload a file smaller than 8 MB.",
        );
      }

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

      /*
       * Reuse one verification path for the seller.
       *
       * The storage policy added in migration 015
       * allows the seller to replace their own file.
       */
      const path = `${user.id}/id-document.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("seller-documents")
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      /*
       * Do NOT directly update verification_status.
       *
       * The secure database function only permits
       * pending/rejected sellers to return to pending.
       */
      const { error: resubmitError } = await supabase.rpc(
        "resubmit_seller_verification",
        {
          p_document_path: path,
        },
      );

      if (resubmitError) {
        throw new Error(resubmitError.message);
      }

      router.push("/seller/dashboard");

      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't submit your verification.";

      setError(message);
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-md mx-auto px-4 py-10">
        <div className="mb-6">
          <h1
            className="font-display text-xl mb-2"
            style={{
              color: "var(--ink)",
            }}
          >
            Verify your identity
          </h1>

          <p className="text-sm text-gray-600 leading-6">
            Upload a clear photo of your Gambian national ID, passport, or
            business registration. Verification is reviewed manually by Teraa
            before your products can appear on the marketplace.
          </p>
        </div>

        <div
          className="rounded-xl border bg-white p-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">
                ID document photo
              </label>

              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => {
                  setError(null);

                  setFile(e.target.files?.[0] ?? null);
                }}
                className="w-full text-sm rounded-lg border px-3 py-2.5 bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              />

              <p className="text-xs text-gray-500 mt-2 leading-5">
                Make sure the document is clear, readable and not blurry.
                Maximum file size is 8 MB.
              </p>
            </div>

            {file && (
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "var(--sand)",
                  background: "#fbfaf7",
                }}
              >
                <p className="text-xs font-medium">📄 {file.name}</p>

                <p className="text-[11px] text-gray-500 mt-1">
                  Ready to submit for review.
                </p>
              </div>
            )}

            {error && (
              <div
                className="rounded-lg border p-3 text-sm text-red-600"
                style={{
                  borderColor: "#efb4b4",
                  background: "#fff5f5",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--indigo)",
              }}
            >
              {loading ? "Submitting..." : "Submit for review"}
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-500 mt-4 leading-5">
          🔒 Your verification document is stored privately and is only
          available to you and authorized Teraa administrators.
        </p>
      </main>
    </>
  );
}
