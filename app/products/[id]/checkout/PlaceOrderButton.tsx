"use client";

import { useFormStatus } from "react-dom";

export function PlaceOrderButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full min-h-12 rounded-full py-3 text-white text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "var(--indigo)" }}
    >
      {pending ? "Placing order…" : "Place COD order"}
    </button>
  );
}
