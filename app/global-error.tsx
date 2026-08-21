"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "var(--paper, #faf7f0)" }}>
        <main className="min-h-screen flex items-center justify-center px-4 text-center">
          <div>
            <p className="font-bold text-xl mb-2" style={{ color: "var(--indigo, #1f3d5c)" }}>
              Something went wrong
            </p>
            <p className="text-sm text-gray-600 mb-6 max-w-sm">
              This wasn&apos;t supposed to happen. Try again, or head back to the homepage.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="rounded-full px-5 py-2 text-white text-sm font-medium"
                style={{ background: "var(--indigo, #1f3d5c)" }}
              >
                Try again
              </button>
              <Link
                href="/"
                className="rounded-full px-5 py-2 text-sm font-medium border"
                style={{ borderColor: "var(--sand, #e8dfc8)" }}
              >
                Go home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
