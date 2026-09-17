"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SearchBar } from "./SearchBar";
import { HeaderAuthActions } from "./HeaderAuthActions";

export function SiteHeader({ searchQuery }: { searchQuery?: string }) {
  const pathname = usePathname();

  const showSearch = pathname === "/";

  return (
    <header
      className="border-b bg-white sticky top-0 z-40"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      {/* TABLET HEADER */}
      <div className="hidden sm:flex lg:hidden max-w-6xl mx-auto px-4 py-3 items-center gap-4">
        <Link
          href="/"
          aria-label="Teraa home"
          className="shrink-0 flex items-center"
        >
          <Image
            src="/branding/teraa-logo.svg"
            alt="Teraa"
            width={760}
            height={180}
            className="h-8 w-auto"
          />
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

      {/* DESKTOP SEARCH: the logo and account navigation live in the sidebar. */}
      {showSearch && (
        <div className="mx-auto hidden w-full max-w-[1460px] items-center px-6 py-3 lg:flex">
          <div className="w-full max-w-3xl">
            <SearchBar initialQuery={searchQuery} />
          </div>
        </div>
      )}

      {/* MOBILE HEADER */}
      <div className="sm:hidden">
        <div
          className={
            showSearch ? "px-4 pt-3 pb-2.5" : "h-14 px-4 flex items-center"
          }
        >
          <Link
            href="/"
            aria-label="Teraa home"
            className="flex items-center"
          >
            <Image
              src="/branding/teraa-logo.svg"
              alt="Teraa"
              width={760}
              height={180}
              className="h-7 w-auto"
            />
          </Link>
        </div>

        {showSearch && (
          <div className="px-4 pb-3">
            <SearchBar initialQuery={searchQuery} />
          </div>
        )}
      </div>
    </header>
  );
}
