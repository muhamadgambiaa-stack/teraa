"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Role = "buyer" | "seller" | "admin" | null;
type IconName =
  | "home"
  | "browse"
  | "sell"
  | "orders"
  | "messages"
  | "heart"
  | "bell"
  | "account"
  | "dashboard"
  | "products"
  | "users"
  | "support"
  | "disputes";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  activePrefixes?: string[];
  exact?: boolean;
};

const SHOPPING_LINKS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  {
    label: "Browse",
    href: "/search",
    icon: "browse",
    activePrefixes: ["/search", "/products"],
  },
];

const BUYER_LINKS: NavItem[] = [
  { label: "Orders", href: "/orders", icon: "orders" },
  { label: "Messages", href: "/messages", icon: "messages" },
  { label: "Favourites", href: "/favorites", icon: "heart" },
  { label: "Notifications", href: "/notifications", icon: "bell" },
];

const BUYER_SELL_LINKS: NavItem[] = [
  { label: "Start selling", href: "/seller/register", icon: "sell" },
];

const SELLER_LINKS: NavItem[] = [
  {
    label: "Seller dashboard",
    href: "/seller/dashboard",
    icon: "dashboard",
    exact: true,
  },
  { label: "Add a product", href: "/seller/dashboard/new", icon: "sell" },
  {
    label: "Seller orders",
    href: "/seller/dashboard/orders",
    icon: "orders",
  },
  {
    label: "Shop settings",
    href: "/seller/dashboard/settings",
    icon: "products",
  },
  {
    label: "Commissions",
    href: "/seller/dashboard/commissions",
    icon: "dashboard",
  },
];

const ADMIN_LINKS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "dashboard", exact: true },
  { label: "Sellers", href: "/admin/sellers", icon: "users" },
  { label: "Listings", href: "/admin/listings", icon: "products" },
  { label: "Categories", href: "/admin/categories", icon: "browse" },
  { label: "Orders", href: "/admin/orders", icon: "orders" },
  { label: "Disputes", href: "/admin/disputes", icon: "disputes" },
  { label: "Commissions", href: "/admin/commissions", icon: "dashboard" },
  { label: "Reports", href: "/admin/reports", icon: "bell" },
  { label: "Appeals", href: "/admin/appeals", icon: "disputes" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Support", href: "/admin/support", icon: "support" },
];

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" />,
  browse: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  sell: <><path d="M12 5v14M5 12h14" /><rect x="3" y="3" width="18" height="18" rx="5" /></>,
  orders: <><path d="M6 7h12l1 14H5L6 7Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  messages: <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 2 15V7a2 2 0 0 1 2-2Z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8Z" />,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4.5a4 4 0 0 1 0 7.5M17 15a6 6 0 0 1 5 6" /></>,
  support: <><circle cx="12" cy="12" r="9" /><path d="M8 14v-3a4 4 0 0 1 8 0v3M8 14H6v-3h2M16 14h2v-3h-2M16 14c0 2-1 3-3 3" /></>,
  disputes: <><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" /><path d="M12 8v5M12 17h.01" /></>,
};

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<Role>(null);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setRole(null);
        setName(null);
        setEmail(null);
        setChecked(true);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      const profileRole = profile?.role;
      setRole(
        profileRole === "admin" ||
          profileRole === "seller" ||
          profileRole === "buyer"
          ? profileRole
          : "buyer",
      );
      setName(profile?.full_name?.trim() || null);
      setEmail(user.email ?? null);
      setChecked(true);
    }

    loadAccount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAccount();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function logOut() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const accountLabel = name || email || "Your account";

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r bg-white lg:flex lg:flex-col"
      style={{ borderColor: "var(--sand)" }}
      aria-label="Desktop navigation"
    >
      <div className="px-4 pb-4 pt-5">
        <Link href="/" aria-label="Teraa home" className="inline-flex">
          <Image
            src="/branding/teraa-logo.svg"
            alt="Teraa"
            width={760}
            height={180}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <p className="mt-2 text-[11px] font-medium tracking-wide text-gray-500">
          Buy. Sell. Closer together.
        </p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <NavGroup items={SHOPPING_LINKS} pathname={pathname} />

        {checked && role === null && (
          <div className="mt-5 rounded-2xl border p-3" style={{ borderColor: "var(--sand)" }}>
            <p className="text-sm font-semibold">Join Teraa free</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Save products, contact sellers and place orders.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                className="rounded-full border px-3 py-2 text-center text-xs font-semibold"
                style={{ borderColor: "var(--sand)", color: "var(--indigo)" }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full px-3 py-2 text-center text-xs font-semibold text-white"
                style={{ background: "var(--indigo)" }}
              >
                Sign up
              </Link>
            </div>
          </div>
        )}

        {role === "buyer" && (
          <>
            <NavGroup label="Shopping" items={BUYER_LINKS} pathname={pathname} />
            <NavGroup
              label="Selling"
              items={BUYER_SELL_LINKS}
              pathname={pathname}
            />
          </>
        )}

        {role === "seller" && (
          <>
            <NavGroup label="Shopping" items={BUYER_LINKS} pathname={pathname} />
            <NavGroup label="Selling" items={SELLER_LINKS} pathname={pathname} />
          </>
        )}

        {role === "admin" && (
          <NavGroup label="Administration" items={ADMIN_LINKS} pathname={pathname} />
        )}
      </nav>

      {checked && role !== null && (
        <div className="border-t p-3" style={{ borderColor: "var(--sand)" }}>
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[#faf7f0]"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--indigo)" }}
            >
              {accountLabel.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{accountLabel}</span>
              <span className="block text-[11px] capitalize text-gray-500">{role} account</span>
            </span>
            <SidebarIcon name="account" />
          </Link>
          <button
            type="button"
            onClick={logOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
          >
            Log out
          </button>
        </div>
      )}
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className={label ? "mt-4" : ""}>
      {label && (
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const prefixes = item.activePrefixes ?? [item.href];
          const isActive =
            item.href === "/" || item.exact
              ? pathname === item.href
              : prefixes.some(
                  (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
                );

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition"
              style={{
                color: isActive ? "var(--indigo)" : "#4b5563",
                background: isActive ? "#f5efe4" : "transparent",
              }}
            >
              <SidebarIcon name={item.icon} active={isActive} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SidebarIcon({ name, active = false }: { name: IconName; active?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={active && name === "home" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
