import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

type SearchParams = Promise<{
  status?: string;
}>;

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Payment required",
  instructions_requested: "Instructions requested",
  proof_submitted: "Proof submitted",
  paid: "Paid",
  overdue: "Overdue",
  rejected: "Rejected",
  waived: "Waived",
};

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";

  const { supabase } = await requireAdmin();

  let request = supabase
    .from("commissions")
    .select(`
      id,
      seller_id,
      order_id,
      order_total,
      commission_amount,
      status,
      due_at,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    request = request.eq("status", status);
  }

  const { data: commissions, error } = await request;

  const sellerIds = [
    ...new Set((commissions ?? []).map((entry) => entry.seller_id)),
  ];

  const { data: sellers } =
    sellerIds.length > 0
      ? await supabase
          .from("sellers")
          .select("id, business_name, legal_name")
          .in("id", sellerIds)
      : { data: [] };

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href="/admin"
          className="text-sm"
          style={{ color: "var(--indigo)" }}
        >
          Back to admin
        </Link>

        <div className="mt-4 mb-6">
          <p className="text-xs text-gray-500">Administration</p>

          <h1 className="font-display text-2xl">Commissions</h1>

          <p className="text-sm text-gray-500 mt-1">
            Review commission balances, payment requests and submitted proof.
          </p>
        </div>

        <form method="GET" className="mb-6">
          <select
            name="status"
            defaultValue={status}
            className="rounded-full border bg-white px-4 py-2 text-sm"
            style={{ borderColor: "var(--sand)" }}
          >
            <option value="all">All commissions</option>
            <option value="instructions_requested">
              Instructions requested
            </option>
            <option value="proof_submitted">Proof submitted</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="overdue">Overdue</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>

          <button
            type="submit"
            className="ml-2 rounded-full px-5 py-2 text-sm text-white"
            style={{ background: "var(--indigo)" }}
          >
            Filter
          </button>
        </form>

        {error && (
          <p className="rounded-xl border p-4 text-sm text-red-700">
            Couldn&apos;t load commissions.
          </p>
        )}

        {!error && (!commissions || commissions.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{ borderColor: "var(--sand)" }}
          >
            No commissions found.
          </div>
        )}

        <div className="space-y-3">
          {(commissions ?? []).map((commission) => {
            const seller = (sellers ?? []).find(
              (entry) => entry.id === commission.seller_id,
            );

            return (
              <Link
                key={commission.id}
                href={`/admin/commissions/${commission.id}`}
                className="block rounded-xl border bg-white p-4"
                style={{
                  borderColor:
                    commission.status === "overdue" ||
                    commission.status === "proof_submitted"
                      ? "var(--clay)"
                      : "var(--sand)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {seller?.business_name ?? "Seller"}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Order #{commission.order_id.slice(0, 8)}
                    </p>

                    <p className="text-sm font-bold mt-2">
                      GMD{" "}
                      {Number(
                        commission.commission_amount,
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold">
                      {STATUS_LABELS[commission.status] ??
                        commission.status}
                    </p>

                    {commission.due_at && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Due{" "}
                        {new Date(
                          commission.due_at,
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}