"use client";

import { useFormStatus } from "react-dom";

export function MessageSellerButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full rounded-full border py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: "var(--indigo)",
        color: "var(--indigo)",
      }}
    >
      {pending ? (
        <>
          <span
            className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
          Opening chat...
        </>
      ) : (
        <>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
          Message seller
        </>
      )}
    </button>
  );
}
