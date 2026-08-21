import Link from "next/link";

export function SellerNav({ active }: { active: "listings" | "orders" | "settings" }) {
  const tabs = [
    { key: "listings", label: "Listings", href: "/seller/dashboard" },
    { key: "orders", label: "Orders", href: "/seller/dashboard/orders" },
    { key: "settings", label: "Settings", href: "/seller/dashboard/settings" },
  ] as const;

  return (
    <div className="flex gap-1 border-b mb-6" style={{ borderColor: "var(--sand)" }}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className="px-3 py-2 text-sm font-medium -mb-px border-b-2"
          style={{
            borderColor: active === t.key ? "var(--indigo)" : "transparent",
            color: active === t.key ? "var(--indigo)" : "#6b6b63",
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
