import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();

  const [{ count: pendingSellers }, { count: openReports }, { count: totalProducts }, { count: totalOrders }] =
    await Promise.all([
      supabase.from("sellers").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("orders").select("id", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Sellers awaiting review", value: pendingSellers ?? 0, href: "/admin/sellers", urgent: (pendingSellers ?? 0) > 0 },
    { label: "Open reports", value: openReports ?? 0, href: "/admin/reports", urgent: (openReports ?? 0) > 0 },
    { label: "Active listings", value: totalProducts ?? 0, href: "/" },
    { label: "Total orders", value: totalOrders ?? 0, href: "#" },
  ];

  return (
    <>
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-6" style={{ color: "var(--ink)" }}>
          Admin
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl border p-4 bg-white hover:shadow-sm transition-shadow"
              style={{ borderColor: s.urgent ? "var(--clay)" : "var(--sand)" }}
            >
              <p className="text-2xl font-bold" style={{ color: s.urgent ? "var(--clay)" : "var(--ink)" }}>
                {s.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
