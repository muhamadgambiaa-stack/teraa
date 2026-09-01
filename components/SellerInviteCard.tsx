"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "teraa:seller-invite-dismissed";

export function SellerInviteCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismissInvite() {
    setVisible(false);

    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // The prompt still closes when browser storage is unavailable.
    }
  }

  if (!visible) return null;

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-2xl border bg-white sm:mb-7"
      style={{ borderColor: "var(--sand)" }}
      aria-labelledby="seller-invite-title"
    >
      <div
        className="h-1"
        style={{
          background:
            "linear-gradient(90deg, var(--indigo), var(--leaf), var(--clay))",
        }}
      />

      <button
        type="button"
        onClick={dismissInvite}
        className="absolute right-2 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
        aria-label="Dismiss seller invitation"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      </button>

      <div className="p-4 pr-12 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5 sm:pr-14">
        <div className="min-w-0">
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--clay)" }}
          >
            Sell on Teraa
          </p>

          <h2
            id="seller-invite-title"
            className="font-display text-xl font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Have something to sell?
          </h2>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-gray-600">
            Create your seller profile and list your products for free. Reach
            buyers across The Gambia.
          </p>
        </div>

        <Link
          href="/seller/register"
          className="mt-4 inline-flex w-full shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:mt-0 sm:w-auto"
          style={{ background: "var(--indigo)" }}
        >
          Apply to sell
        </Link>
      </div>
    </section>
  );
}
