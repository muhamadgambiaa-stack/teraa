import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();

  const [
    { count: pendingSellers },
    { count: openReports },
    { count: totalProducts },
    { count: totalOrders },
    { count: pendingAppeals },
    { count: suspendedSellers },
    { count: commissionRequests },
    { count: proofsToReview },
    { count: overdueCommissions },
  ] = await Promise.all([
    supabase
      .from("sellers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("verification_status", "pending")
      .not("application_submitted_at", "is", null),

    supabase
      .from("reports")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "open"),

    supabase
      .from("products")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active"),

    supabase.from("orders").select("id", {
      count: "exact",
      head: true,
    }),

    supabase
      .from("listing_appeals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),

    supabase
      .from("sellers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("account_status", "suspended"),

    supabase
      .from("commissions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "instructions_requested"),

    supabase
      .from("commissions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "proof_submitted"),

    supabase
      .from("commissions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "overdue"),
  ]);

  const stats = [
    {
      label: "Payment detail requests",
      value: commissionRequests ?? 0,
      href: "/admin/commissions?status=instructions_requested",
      urgent: (commissionRequests ?? 0) > 0,
    },

    {
      label: "Commission proofs to review",
      value: proofsToReview ?? 0,
      href: "/admin/commissions?status=proof_submitted",
      urgent: (proofsToReview ?? 0) > 0,
    },

    {
      label: "Overdue commissions",
      value: overdueCommissions ?? 0,
      href: "/admin/commissions?status=overdue",
      urgent: (overdueCommissions ?? 0) > 0,
    },

    {
      label: "Sellers awaiting review",
      value: pendingSellers ?? 0,
      href: "/admin/sellers?verification=pending",
      urgent: (pendingSellers ?? 0) > 0,
    },

    {
      label: "Open reports",
      value: openReports ?? 0,
      href: "/admin/reports",
      urgent: (openReports ?? 0) > 0,
    },

    {
      label: "Pending appeals",
      value: pendingAppeals ?? 0,
      href: "/admin/appeals",
      urgent: (pendingAppeals ?? 0) > 0,
    },

    {
      label: "Suspended sellers",
      value: suspendedSellers ?? 0,
      href: "/admin/sellers?account=suspended",
      urgent: (suspendedSellers ?? 0) > 0,
    },

    {
      label: "Active listings",
      value: totalProducts ?? 0,
      href: "/admin/listings",
      urgent: false,
    },

    {
      label: "Total orders",
      value: totalOrders ?? 0,
      href: "/admin/orders",
      urgent: false,
    },
  ];

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Teraa administration</p>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Admin
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Review marketplace activity, moderation and account issues.
          </p>
        </div>

        {/* Dashboard statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border p-4 bg-white hover:shadow-sm transition-shadow"
              style={{
                borderColor: stat.urgent ? "var(--clay)" : "var(--sand)",
              }}
            >
              <p
                className="text-2xl font-bold"
                style={{
                  color: stat.urgent ? "var(--clay)" : "var(--ink)",
                }}
              >
                {stat.value}
              </p>

              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Link>
          ))}
        </div>

        {/* Management */}
        <section className="mt-8">
          <h2 className="font-semibold mb-3">Management</h2>

          <div
            className="rounded-xl border bg-white overflow-hidden"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <AdminLink
              href="/admin/sellers"
              title="Sellers"
              description="Verification, suspension, bans and seller history"
            />

            <AdminLink
              href="/admin/listings"
              title="Listings"
              description="Search and moderate all marketplace listings"
            />

            <AdminLink
              href="/admin/categories"
              title="Categories"
              description="Manage the categories sellers use for product listings"
            />

            <AdminLink
              href="/admin/reports"
              title="Reports"
              description="Investigate open and closed user reports"
            />

            <AdminLink
              href="/admin/appeals"
              title="Listing appeals"
              description="Review requests to restore removed listings"
            />

            <AdminLink
              href="/admin/orders"
              title="Orders"
              description="Inspect marketplace orders and payment issues"
            />

            <AdminLink
              href="/admin/commissions"
              title="Commissions"
              description="Payment instructions, proof review and overdue balances"
            />

            <AdminLink
              href="/admin/users"
              title="Users"
              description="Manage buyers and general user accounts"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function AdminLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 px-4 py-4 border-b last:border-b-0 hover:bg-gray-50 transition"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <div>
        <p className="font-medium text-sm">{title}</p>

        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <span className="text-gray-400">â†’</span>
    </Link>
  );
}

