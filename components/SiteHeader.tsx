"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SearchBar } from "./SearchBar";
import { HeaderAuthActions } from "./HeaderAuthActions";

export function SiteHeader({ searchQuery }: { searchQuery?: string }) {
  const pathname = usePathname();

  // Search should only appear on the homepage.
  const showSearch = pathname === "/";

  return (
    <header
      className="border-b bg-white sticky top-0 z-40"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      {/* DESKTOP HEADER */}
      <div className="hidden sm:flex max-w-6xl mx-auto px-4 py-3 items-center gap-4">
        <Link
          href="/"
          className="font-display text-2xl font-bold shrink-0"
          style={{
            color: "var(--indigo)",
          }}
        >
          Teraa
        </Link>

        {showSearch && (
          <div className="flex-1">
            <SearchBar initialQuery={searchQuery} />
          </div>
        )}

        <nav className="flex items-center gap-3 text-sm ml-auto shrink-0">
          <HeaderAuthActions />
        </nav>
      </div>

      {/* MOBILE HEADER */}
      <div className="sm:hidden">
        <div className={showSearch ? "px-4 pt-4 pb-3" : "px-4 py-4"}>
          <Link
            href="/"
            className="font-display text-3xl font-bold"
            style={{
              color: "var(--indigo)",
            }}
          >
            Teraa
          </Link>
        </div>

        {showSearch && (
          <div className="px-4 pb-4">
            <SearchBar initialQuery={searchQuery} />
          </div>
        )}
      </div>
    </header>
  );
}
