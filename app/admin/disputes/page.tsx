import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/require-admin";
import { resolveDeliveryDispute } from "./actions";

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
  resolved_at: string | null;
  resolution_reason: string | null;
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const selectedStatus = ["open", "resolved", "all"].includes(
    params.status ?? "",
  )
    ? (params.status as "open" | "resolved" | "all")
    : "open";
  const { supabase } = await requireAdmin();
  let request = supabase
    .from("order_delivery_issues")
    .select(
      "order_id, buyer_id, seller_id, status, reported_at, response_deadline, seller_response, seller_responded_at, auto_restricted_at, resolved_at, resolution_reason",
    )
    .order("reported_at", { ascending: false })
    .limit(200);

  if (selectedStatus !== "all") {
    request = request.eq("status", selectedStatus);
  }

  const [
    { data, error },
    { count: openCount },
    { count: resolvedCount },
  ] = await Promise.all([
    request,
    supabase
      .from("order_delivery_issues")
      .select("order_id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("order_delivery_issues")
      .select("order_id", { count: "exact", head: true })
      .eq("status", "resolved"),
  ]);

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

        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Dispute status">
          <FilterLink
            href="/admin/disputes?status=open"
            active={selectedStatus === "open"}
            label={`Open (${openCount ?? 0})`}
          />
          <FilterLink
            href="/admin/disputes?status=resolved"
            active={selectedStatus === "resolved"}
            label={`Resolved (${resolvedCount ?? 0})`}
          />
          <FilterLink
            href="/admin/disputes?status=all"
            active={selectedStatus === "all"}
            label={`All (${(openCount ?? 0) + (resolvedCount ?? 0)})`}
          />
        </nav>

        {error && (
          <div className="rounded-xl border p-5 text-sm bg-red-50 border-red-200">
            Couldn&apos;t load delivery disputes.
          </div>
        )}

        {!error && issues.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500" style={{ borderColor: "var(--sand)" }}>
            No {selectedStatus === "all" ? "" : selectedStatus} delivery disputes found.
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
                  {issue.status === "resolved" && (
                    <>
                      <p className="sm:col-span-2 text-green-800">
                        <strong>Resolution:</strong>{" "}
                        {issue.resolution_reason ?? "Reason not recorded."}
                      </p>
                      <p className="sm:col-span-2 text-gray-500">
                        <strong>Resolved:</strong>{" "}
                        {issue.resolved_at
                          ? new Date(issue.resolved_at).toLocaleString()
                          : "Date was not recorded for this older dispute"}
                      </p>
                    </>
                  )}
                </div>

                {issue.seller_response && (
                  <div className="rounded-lg border p-3 mt-4 text-sm whitespace-pre-wrap" style={{ borderColor: "var(--sand)", background: "var(--cream)" }}>
                    <strong>Seller response:</strong> {issue.seller_response}
                  </div>
                )}

                {issue.status === "open" && (
                  <details className="rounded-xl border p-4 mt-4" style={{ borderColor: "var(--sand)" }}>
                    <summary className="cursor-pointer text-sm font-semibold">
                      Resolve this dispute
                    </summary>
                    <form
                      action={resolveDeliveryDispute.bind(null, issue.order_id)}
                      className="mt-4 space-y-3"
                    >
                      <label className="block text-sm font-medium">
                        Decision
                        <select
                          name="decision"
                          required
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5"
                          style={{ borderColor: "var(--sand)" }}
                        >
                          <option value="" disabled>Select a decision</option>
                          <option value="complete_order">Confirm delivery and complete order</option>
                          <option value="cancel_order">Confirm non-delivery and cancel order</option>
                          <option value="dismiss_report">Dismiss report without changing order</option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium">
                        Decision note
                        <textarea
                          name="note"
                          required
                          minLength={10}
                          maxLength={500}
                          rows={4}
                          placeholder="Explain the evidence and why this decision was made..."
                          className="mt-1 w-full rounded-lg border px-3 py-2.5"
                          style={{ borderColor: "var(--sand)" }}
                        />
                      </label>

                      {issue.auto_restricted_at && (
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="restoreSeller" className="mt-1" />
                          <span>
                            Restore the seller only if this dispute was their sole automatic restriction.
                          </span>
                        </label>
                      )}

                      <button
                        type="submit"
                        className="rounded-full px-5 py-2.5 text-sm font-medium text-white"
                        style={{ background: "var(--indigo)" }}
                      >
                        Save final decision
                      </button>
                    </form>
                  </details>
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

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border px-4 py-2 text-sm font-medium"
      style={{
        borderColor: active ? "var(--indigo)" : "var(--sand)",
        background: active ? "var(--indigo)" : "white",
        color: active ? "white" : "var(--ink)",
      }}
    >
      {label}
    </Link>
  );
}
