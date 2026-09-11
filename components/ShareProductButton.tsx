"use client";

import { useState } from "react";

export function ShareProductButton({
  productId,
  productTitle,
  price,
}: {
  productId: string;
  productTitle: string;
  price: number;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function shareProduct() {
    const productUrl = `${window.location.origin}/products/${productId}`;
    const shareData = {
      title: `${productTitle} on Teraa`,
      text: `${productTitle} for GMD ${price.toLocaleString()} on Teraa.`,
      url: productUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setFeedback("Product shared");
        return;
      }

      await navigator.clipboard.writeText(productUrl);
      setFeedback("Product link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFeedback("Could not share the product");
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={shareProduct}
        className="flex w-full items-center justify-center gap-2 rounded-full border bg-white py-3 text-sm font-semibold transition hover:bg-gray-50"
        style={{ borderColor: "var(--sand)", color: "var(--indigo)" }}
      >
        <ShareIcon />
        Share product
      </button>

      {feedback ? (
        <p
          className={`mt-1.5 text-center text-xs ${
            feedback.startsWith("Could not") ? "text-red-600" : "text-gray-500"
          }`}
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4" />
      <path d="m8.6 13.5 6.8 4" />
    </svg>
  );
}
