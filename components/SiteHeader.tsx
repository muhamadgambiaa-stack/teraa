"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SearchBar } from "./SearchBar";
import { HeaderAuthActions } from "./HeaderAuthActions";
import { BackButton } from "./BackButton";

type BackDestination = {
  href: string;
  label: string;
};

const PRIMARY_ROUTES = new Set([
  "/",
  "/search",
  "/orders",
  "/messages",
  "/favorites",
  "/notifications",
  "/account",
  "/seller/dashboard",
  "/admin",
]);

const ROUTES_WITH_OWN_BACK_CONTROL = [
  /^\/messages\/[^/]+$/,
  /^\/account\/support\/(?:new|[^/]+)$/,
  /^\/seller\/register$/,
  /^\/seller\/dashboard\/orders\/[^/]+$/,
  /^\/seller\/dashboard\/products\/[^/]+$/,
  /^\/admin\/commissions(?:\/settings|\/[^/]+)?$/,
  /^\/admin\/support\/(?!answers(?:\/|$))[^/]+$/,
  /^\/admin\/users\/[^/]+$/,
];

function getBackDestination(pathname: string): BackDestination | null {
  if (
    PRIMARY_ROUTES.has(pathname) ||
    ROUTES_WITH_OWN_BACK_CONTROL.some((pattern) => pattern.test(pathname))
  ) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "products" && segments[1]) {
    if (segments[2] === "checkout") {
      return {
        href: `/products/${segments[1]}`,
        label: "Back to listing",
      };
    }

    return { href: "/", label: "Back to listings" };
  }

  if (segments[0] === "profile") {
    return { href: "/", label: "Back to listings" };
  }

  if (segments[0] === "orders") {
    return { href: "/orders", label: "Back to orders" };
  }

  if (segments[0] === "account") {
    if (segments[1] === "support" && segments.length > 2) {
      return { href: "/account/support", label: "Back to support" };
    }

    return { href: "/account", label: "Back to account" };
  }

  if (segments[0] === "seller") {
    if (segments[1] === "dashboard" && segments[2] === "orders") {
      return {
        href: "/seller/dashboard",
        label: "Back to seller dashboard",
      };
    }

    return {
      href: "/seller/dashboard",
      label: "Back to seller dashboard",
    };
  }

  if (segments[0] === "admin") {
    if (segments[1] === "support" && segments[2] === "answers") {
      return segments.length > 3
        ? {
            href: "/admin/support/answers",
            label: "Back to support answers",
          }
        : { href: "/admin/support", label: "Back to support" };
    }

    if (segments.length > 2) {
      return {
        href: `/admin/${segments[1]}`,
        label: `Back to ${segments[1].replaceAll("-", " ")}`,
      };
    }

    return { href: "/admin", label: "Back to admin" };
  }

  return { href: "/", label: "Back to home" };
}

export function SiteHeader({ searchQuery }: { searchQuery?: string }) {
  const pathname = usePathname();

  const showSearch = pathname === "/";
  const backDestination = getBackDestination(pathname);

  return (
    <header
      className="border-b bg-white sticky top-0 z-40"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      {/* TABLET HEADER */}
      <div className="hidden sm:flex lg:hidden max-w-6xl mx-auto px-4 py-3 items-center gap-4">
        {backDestination ? (
          <BackButton
            href={backDestination.href}
            label={backDestination.label}
          />
        ) : null}

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
      {showSearch ? (
        <div className="mx-auto hidden w-full max-w-[1460px] items-center px-6 py-3 lg:flex">
          <div className="w-full max-w-3xl">
            <SearchBar initialQuery={searchQuery} />
          </div>
        </div>
      ) : backDestination ? (
        <div className="mx-auto hidden w-full max-w-[1460px] items-center px-4 py-1.5 lg:flex">
          <BackButton
            href={backDestination.href}
            label={backDestination.label}
          />
        </div>
      ) : null}

      {/* MOBILE HEADER */}
      <div className="sm:hidden">
        {backDestination ? (
          <div className="relative flex h-14 items-center px-2">
            <BackButton
              href={backDestination.href}
              label={backDestination.label}
              iconOnly
            />

            <Link
              href="/"
              aria-label="Teraa home"
              className="absolute left-1/2 flex -translate-x-1/2 items-center"
            >
              <Image
                src="/branding/teraa-logo.svg"
                alt="Teraa"
                width={760}
                height={180}
                className="h-6 w-auto"
              />
            </Link>
          </div>
        ) : (
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
        )}

        {showSearch && (
          <div className="px-4 pb-3">
            <SearchBar initialQuery={searchQuery} />
          </div>
        )}
      </div>
    </header>
  );
}
