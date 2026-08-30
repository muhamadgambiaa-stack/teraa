"use client";

import { useState, useTransition } from "react";

import {
  requestPaymentDetails,
  submitCommissionProof,
  type CommissionActionResult,
} from "./actions";

export function CommissionPaymentActions({
  commissionId,
  status,
}: {
  commissionId: string;
  status: string;
}) {
  const [result, setResult] =
    useState<CommissionActionResult | null>(null);

  const [pending, startTransition] = useTransition();

  const canAct =
    status === "awaiting_payment" || status === "rejected";

  if (!canAct) {
    return null;
  }

  function requestDetails() {
    setResult(null);

    startTransition(async () => {
      setResult(await requestPaymentDetails(commissionId));
    });
  }

  function submitProof(formData: FormData) {
    setResult(null);

    startTransition(async () => {
      setResult(await submitCommissionProof(formData));
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={requestDetails}
        className="rounded-full border px-4 py-2 text-xs font-medium disabled:opacity-50"
        style={{
          borderColor: "var(--indigo)",
          color: "var(--indigo)",
        }}
      >
        Request payment details
      </button>

      <form action={submitProof} className="space-y-2">
        <input
          type="hidden"
          name="commissionId"
          value={commissionId}
        />

        <input
          type="file"
          name="proof"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          className="block w-full rounded-lg border p-2 text-xs"
          style={{ borderColor: "var(--sand)" }}
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "var(--indigo)" }}
        >
          {pending ? "Processing..." : "Upload payment proof"}
        </button>
      </form>

      {result?.success && (
        <p className="text-xs text-green-700">{result.success}</p>
      )}

      {result?.error && (
        <p className="text-xs text-red-700">{result.error}</p>
      )}
    </div>
  );
}