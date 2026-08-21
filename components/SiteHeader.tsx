import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { HeaderAuthActions } from "./HeaderAuthActions";

export function SiteHeader({ searchQuery }: { searchQuery?: string }) {
  return (
    <header className="border-b bg-white sticky top-0 z-10" style={{ borderColor: "var(--sand)" }}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-display text-2xl font-bold shrink-0" style={{ color: "var(--indigo)" }}>
          Teraa
        </Link>

        <div className="hidden sm:block flex-1">
          <SearchBar initialQuery={searchQuery} />
        </div>

        <nav className="flex items-center gap-3 text-sm ml-auto shrink-0">
          <HeaderAuthActions />
        </nav>
      </div>

      {/* Mobile search, full width below the logo row */}
      <div className="sm:hidden px-4 pb-3">
        <SearchBar initialQuery={searchQuery} />
      </div>
    </header>
  );
}
