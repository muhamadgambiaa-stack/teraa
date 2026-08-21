"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "product" | "seller";
  targetId: string;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Log in to report a listing.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return <p className="text-xs" style={{ color: "var(--leaf)" }}>Thanks, our team will review this.</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:underline"
      >
        Report this listing
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-3 text-xs space-y-2" style={{ borderColor: "var(--sand)" }}>
      <label className="block font-medium">What&apos;s wrong with this listing?</label>
      <textarea
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. price seems fake, seller asked for payment outside the app, item looks counterfeit…"
        className="w-full rounded-md border px-2 py-1.5 outline-none resize-none"
        style={{ borderColor: "var(--sand)" }}
      />
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full px-3 py-1.5 font-medium text-white disabled:opacity-50"
          style={{ background: "var(--clay)" }}
        >
          {loading ? "Sending…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 font-medium border"
          style={{ borderColor: "var(--sand)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
