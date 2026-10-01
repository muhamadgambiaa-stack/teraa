"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "teraa:marketplace-intro-dismissed";

export function MarketplaceIntro() {
  const [dismissed, setDismissed] = useState(false);
  const showFloat = useSyncExternalStore(() => () => undefined, () => {
    try {
      return window.localStorage.getItem(DISMISSED_KEY) !== "1";
    } catch {
      return true;
    }
  }, () => false) && !dismissed;

  function dismissFloat() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // The prompt still closes for this visit.
    }
  }

  return (
    <>
    {showFloat && (
      <aside className="marketplace-float" aria-label="Explore Teraa">
        <button type="button" onClick={dismissFloat} className="marketplace-float-close" aria-label="Close explore prompt">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <p className="eyebrow">Teraa finds</p>
        <p className="mt-1 pr-5 font-display text-lg" style={{ color: "var(--ink)" }}>Find your next favourite.</p>
        <Link href="/search" onClick={dismissFloat} className="primary-button mt-3 inline-flex">Explore items</Link>
      </aside>
    )}
    </>
  );
}
