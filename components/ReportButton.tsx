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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Log in to submit a report.");
      setLoading(false);
      return;
    }

    /*
     * Check the user's moderation status.
     *
     * Restricted, suspended and banned users
     * cannot submit new marketplace reports.
     */
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        `
        id,
        account_status
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      setError("Couldn't verify your account.");
      setLoading(false);
      return;
    }

    if (profile.account_status !== "active") {
      setError("Your account cannot submit reports while it is restricted.");

      setLoading(false);
      return;
    }

    const cleanReason = reason.trim();

    if (cleanReason.length < 5) {
      setError("Please provide a little more information.");
      setLoading(false);
      return;
    }

    if (cleanReason.length > 1000) {
      setError("Report reason is too long.");
      setLoading(false);
      return;
    }

    /*
     * Prevent duplicate open reports from
     * the same user for the same target.
     */
    const { data: existingReport, error: existingError } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("status", "open")
      .maybeSingle();

    if (existingError) {
      console.error("Could not check existing report:", existingError);
    }

    if (existingReport) {
      setError("You already have an open report for this item.");

      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,

      target_type: targetType,

      target_id: targetId,

      reason: cleanReason,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message || "Couldn't submit your report.");
      return;
    }

    setSubmitted(true);
    setReason("");
  }

  if (submitted) {
    return (
      <div
        className="rounded-lg border p-3 text-xs"
        style={{
          borderColor: "#cde4d5",
          background: "#f1f8f3",
          color: "var(--leaf)",
        }}
      >
        Thanks. Our team will review your report.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="text-xs text-gray-400 hover:underline"
      >
        {targetType === "seller" ? "Report this seller" : "Report this listing"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-3 text-xs space-y-2"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <label className="block font-medium">
        {targetType === "seller"
          ? "What's wrong with this seller?"
          : "What's wrong with this listing?"}
      </label>

      <textarea
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={
          targetType === "seller"
            ? "Describe the issue with this seller..."
            : "e.g. fake item, misleading description, suspicious payment request, prohibited product..."
        }
        className="w-full rounded-md border px-2 py-1.5 outline-none resize-none"
        style={{
          borderColor: "var(--sand)",
        }}
      />

      <div className="flex justify-between text-[10px] text-gray-400">
        <span>Minimum 5 characters</span>

        <span>{reason.length}/1000</span>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full px-3 py-1.5 font-medium text-white disabled:opacity-50"
          style={{
            background: "var(--clay)",
          }}
        >
          {loading ? "Sending…" : "Submit report"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-full px-3 py-1.5 font-medium border disabled:opacity-50"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
