"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "teraa:guest-welcome-dismissed";

export function GuestWelcomeCard() {
  const [dismissed, setDismissed] = useState(false);
  const storedAsVisible = useSyncExternalStore(
    () => () => undefined,
    () => {
      try {
        return window.localStorage.getItem(DISMISSED_KEY) !== "1";
      } catch {
        return true;
      }
    },
    () => false,
  );
  const visible = storedAsVisible && !dismissed;

  function dismissWelcome() {
    setDismissed(true);

    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // The notice still closes when browser storage is unavailable.
    }
  }

  if (!visible) return null;

  return (
    <section
      className="relative mb-4 overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--sand)" }}
      aria-labelledby="guest-welcome-title"
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
        onClick={dismissWelcome}
        className="absolute right-2 top-2.5 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
        aria-label="Dismiss welcome message"
      >
        <svg
          width="17"
          height="17"
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

      <div className="p-3.5 pr-12 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-4 sm:pr-14">
        <div className="min-w-0">
          <p
            id="guest-welcome-title"
            className="text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            New to Teraa?
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-600 sm:text-sm">
            Browse local products freely. Join when you are ready to save items,
            contact sellers or place an order.
          </p>
        </div>

        <div className="mt-3 flex shrink-0 items-center gap-3 sm:mt-0">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 sm:text-sm"
            style={{ background: "var(--indigo)" }}
          >
            Join free
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold hover:underline sm:text-sm"
            style={{ color: "var(--indigo)" }}
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
