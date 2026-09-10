"use client";

import { useState } from "react";

export function ShareShopButton({
  sellerId,
  businessName,
}: {
  sellerId: string;
  businessName: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function shareShop() {
    const shopUrl = `${window.location.origin}/profile/${sellerId}`;
    const shareData = {
      title: `${businessName} on Teraa`,
      text: `See products from ${businessName} on Teraa.`,
      url: shopUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setFeedback("Shop shared");
        return;
      }

      await navigator.clipboard.writeText(shopUrl);
      setFeedback("Shop link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFeedback("Could not copy the link");
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={shareShop}
        className="rounded-full px-4 py-2 text-white text-sm font-medium"
        style={{ background: "var(--indigo)" }}
      >
        Share your shop
      </button>

      {feedback && (
        <span className="text-xs text-gray-500" role="status">
          {feedback}
        </span>
      )}
    </div>
  );
}
