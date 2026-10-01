import Link from "next/link";

export function MarketplaceIntro() {
  return (
    <section className="marketplace-intro" aria-labelledby="marketplace-title">
      <div className="relative z-10">
        <p className="eyebrow mb-3">Your marketplace. The Gambia.</p>
        <h1 id="marketplace-title" className="font-display">Find your next favourite.</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">Discover local finds and connect with sellers across The Gambia.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/search" className="primary-button">Explore items <span aria-hidden="true">→</span></Link>
          <Link href="/seller/dashboard/new" className="secondary-button">Sell an item</Link>
        </div>
      </div>
      <svg className="intro-art" viewBox="0 0 180 180" fill="none" aria-hidden="true">
        <circle cx="90" cy="90" r="78" fill="#e0e9e9" />
        <rect x="42" y="39" width="103" height="112" rx="18" transform="rotate(9 42 39)" fill="#d3ddde" />
        <rect x="36" y="29" width="103" height="112" rx="18" transform="rotate(-8 36 29)" fill="white" />
        <path d="M68 76h49l-4 42H72l-4-42Z" fill="#173e56" />
        <path d="M80 79V67a13 13 0 0 1 26 0v12" stroke="#173e56" strokeWidth="5" strokeLinecap="round" />
        <circle cx="136" cy="122" r="22" fill="#e6b56e" />
        <path d="m127 122 6 6 12-13" stroke="#173e56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </section>
  );
}
