import Link from "next/link";

export function SellerNav({ active }: { active: "listings" | "orders" | "offers" | "commissions" | "settings" }) {
  const tabs = [
    { key: "listings", label: "Listings", href: "/seller/dashboard" },
    { key: "orders", label: "Orders", href: "/seller/dashboard/orders" },
    { key: "offers", label: "Offers", href: "/seller/dashboard/offers" },
    {
      key: "commissions",
      label: "Commissions",
      href: "/seller/dashboard/commissions",
    },
    { key: "settings", label: "Settings", href: "/seller/dashboard/settings" },
  ] as const;

  return (
    <div className="seller-tabs flex gap-1 mb-6 overflow-x-auto" style={{ borderColor: "var(--sand)" }}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className="flex flex-1 shrink-0 items-center justify-center px-3 py-2 text-sm font-semibold whitespace-nowrap"
          style={{
            borderColor: active === t.key ? "var(--indigo)" : "transparent",
            color: active === t.key ? "white" : "var(--muted)",
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
