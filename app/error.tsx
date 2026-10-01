"use client";

import Link from "next/link";

export default function AppError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-4 py-12 text-center">
    <h1 className="font-display text-2xl">We couldn’t load this page</h1>
    <p className="mt-3 text-sm text-gray-500">Please check your connection and try again.</p>
    <div className="mt-5 flex justify-center gap-3"><button onClick={reset} className="primary-button">Try again</button><Link href="/" className="secondary-button">Go home</Link></div>
  </main>;
}
