import Link from "next/link";

export function TrustBanner() {
  return (
    <div
      className="rounded-xl p-5 sm:p-6 text-white"
      style={{ background: "linear-gradient(135deg, var(--indigo), #2a4d70)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl mb-1">
            Know who you&apos;re buying from
          </h2>
          <p className="text-sm opacity-90 max-w-md">
            Sellers with a green checkmark have submitted a Gambian ID for review.
            Pay with Wave or arrange cash on delivery. Always inspect items before you pay cash.
          </p>
        </div>
        <Link
          href="/safety"
          className="shrink-0 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-4 py-2 text-xs font-medium text-center"
        >
          How verification &amp; safety works →
        </Link>
      </div>
    </div>
  );
}
