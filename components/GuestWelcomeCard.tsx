import Link from "next/link";

const benefits = [
  "Browse before joining",
  "Verified seller badges",
  "Orders recorded in Teraa",
];

export function GuestWelcomeCard() {
  return (
    <section
      className="mb-5 overflow-hidden rounded-2xl border bg-white sm:mb-7"
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

      <div className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div className="min-w-0">
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--clay)" }}
          >
            Made for The Gambia
          </p>

          <h1
            id="guest-welcome-title"
            className="font-display text-2xl font-semibold leading-tight sm:text-3xl"
            style={{ color: "var(--ink)" }}
          >
            Find local products. Buy with more confidence.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Browse freely, then create a free account when you are ready to
            save products, contact sellers or place an order.
          </p>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-1.5 text-xs text-gray-600"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--leaf)" }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 sm:mt-0 sm:flex sm:w-44 sm:flex-col">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--indigo)" }}
          >
            Join Teraa free
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition hover:bg-gray-50"
            style={{ borderColor: "var(--sand)", color: "var(--indigo)" }}
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
