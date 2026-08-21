import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function ProductNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="font-display text-xl mb-2" style={{ color: "var(--ink)" }}>
          This listing isn&apos;t available
        </p>
        <p className="text-sm text-gray-500 mb-6">
          It may have sold out or been removed by the seller.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
          style={{ background: "var(--indigo)" }}
        >
          Back to listings
        </Link>
      </main>
    </>
  );
}
