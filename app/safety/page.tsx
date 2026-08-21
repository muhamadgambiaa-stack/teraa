import { SiteHeader } from "@/components/SiteHeader";

export default function SafetyPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="font-display text-2xl mb-6" style={{ color: "var(--ink)" }}>
          How verification &amp; safety work on Teraa
        </h1>

        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <span style={{ color: "var(--leaf)" }}>✓</span> What the verified badge means
          </h2>
          <p className="text-sm text-gray-700">
            A seller with a green checkmark has submitted a Gambian ID or business
            registration, which was reviewed and approved by the Teraa team before
            they could list products. It confirms the seller is a real, identifiable
            person. It does not guarantee the quality or condition of any specific item.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2">How payments work</h2>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>
              <strong>Wave:</strong> you send payment directly to the seller&apos;s Wave
              number. Teraa does not hold or process this payment. It&apos;s a direct
              transfer between you and the seller.
            </li>
            <li>
              <strong>Cash on delivery:</strong> you pay in person when the item is
              handed over. Always inspect the item before paying.
            </li>
          </ul>
          <p className="text-sm text-gray-700 mt-3">
            Teraa does not currently offer escrow or buyer protection refunds. Treat
            transactions the way you would meeting someone from a classified ad.
            verify what you&apos;re getting before you pay.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2">Staying safe</h2>
          <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
            <li>Meet in a public, well-lit place for in-person exchanges</li>
            <li>Inspect items before paying, especially for cash on delivery</li>
            <li>Be cautious of prices that seem far below market value</li>
            <li>Keep payment confirmations and chat records until the sale is complete</li>
            <li>Report suspicious listings or sellers using the report link on any product page</li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">Reporting a problem</h2>
          <p className="text-sm text-gray-700">
            Use the &ldquo;Report this listing&rdquo; link on any product page, or contact
            us directly. Reports are reviewed by the Teraa team, and sellers with
            verified violations can be suspended.
          </p>
        </section>
      </main>
    </>
  );
}
