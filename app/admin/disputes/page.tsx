import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/require-admin";

type Issue = {
  order_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  reported_at: string;
  response_deadline: string | null;
  seller_response: string | null;
  seller_responded_at: string | null;
  auto_restricted_at: string | null;
};

export default async function AdminDisputesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("order_delivery_issues")
    .select(
      "order_id, buyer_id, seller_id, status, reported_at, response_deadline, seller_response, seller_responded_at, auto_restricted_at",
    )
    .order("reported_at", { ascending: false })
    .limit(200);

  const issues = (data ?? []) as Issue[];
  const now = Date.now();

  return (
    <>
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-xs text-gray-500 hover:underline">
          ← Admin
        </Link>

        <div className="mt-4 mb-6">
          <p className="text-xs text-gray-500">Admin</p>
          <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>
            Delivery disputes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review buyer reports, seller responses and missed deadlines.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border p-5 text-sm bg-red-50 border-red-200">
            Couldn&apos;t load delivery disputes.
          </div>
        )}

        {!error && issues.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500" style={{ borderColor: "var(--sand)" }}>
            No delivery disputes have been reported.
          </div>
        )}

        <div className="space-y-3">
          {issues.map((issue) => {
            const deadline = issue.response_deadline
              ? new Date(issue.response_deadline)
              : null;
            const overdue =
              issue.status === "open" &&
              !issue.seller_responded_at &&
              deadline !== null &&
              deadline.getTime() <= now;
            const label = issue.auto_restricted_at
              ? "Seller restricted"
              : issue.seller_responded_at
                ? "Seller responded"
                : overdue
                  ? "Restriction pending"
                  : issue.status === "open"
                    ? "Awaiting seller"
                    : "Resolved";

            return (
              <section
                key={issue.order_id}
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: issue.status === "open" ? "var(--clay)" : "var(--sand)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Order #{issue.order_id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Reported {new Date(issue.reported_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold" style={{ color: "var(--clay)" }}>
                    {label}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 mt-4 text-sm">
                  <p><strong>Seller:</strong> {issue.seller_id.slice(0, 8)}</p>
                  <p><strong>Buyer:</strong> {issue.buyer_id.slice(0, 8)}</p>
                  <p className="sm:col-span-2">
                    <strong>Response deadline:</strong>{" "}
                    {deadline ? deadline.toLocaleString() : "Not recorded"}
                  </p>
                  {issue.auto_restricted_at && (
                    <p className="sm:col-span-2 text-red-700">
                      <strong>Automatically restricted:</strong>{" "}
                      {new Date(issue.auto_restricted_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {issue.seller_response && (
                  <div className="rounded-lg border p-3 mt-4 text-sm whitespace-pre-wrap" style={{ borderColor: "var(--sand)", background: "var(--cream)" }}>
                    <strong>Seller response:</strong> {issue.seller_response}
                  </div>
                )}

                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  <Link href={`/admin/orders/${issue.order_id}`} className="underline">
                    Inspect order
                  </Link>
                  <Link href={`/admin/users/${issue.seller_id}`} className="underline">
                    Manage seller account
                  </Link>
                  <Link href={`/admin/users/${issue.buyer_id}`} className="underline">
                    View buyer
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
