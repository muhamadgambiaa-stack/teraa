import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";

import { CommissionPaymentActions } from "./CommissionPaymentActions";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Payment required",
  instructions_requested: "Waiting for Teraa",
  proof_submitted: "Proof under review",
  paid: "Paid",
  overdue: "Overdue",
  rejected: "Proof rejected",
  waived: "Waived",
};

export default async function SellerCommissionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) {
    redirect("/account");
  }

  const { data: commissions, error } = await supabase
    .from("commissions")
    .select(`
      id,
      order_id,
      order_total,
      commission_rate,
      commission_amount,
      status,
      due_at,
      deadline_paused_at,
      payment_instructions,
      admin_note,
      proof_submitted_at,
      paid_at,
      created_at
    `)
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  const outstanding = (commissions ?? [])
    .filter((commission) =>
      [
        "awaiting_payment",
        "instructions_requested",
        "proof_submitted",
        "overdue",
        "rejected",
      ].includes(commission.status),
    )
    .reduce(
      (sum, commission) =>
        sum + Number(commission.commission_amount),
      0,
    );

  return (
    <>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <h1
          className="font-display text-2xl"
          style={{ color: "var(--ink)" }}
        >
          Commissions
        </h1>

        <p className="text-sm text-gray-500 mt-1 mb-6">
          Teraa charges 5% only when an order is successfully completed.
        </p>

        <SellerNav active="commissions" />

        <div
          className="rounded-xl border p-4 mb-6"
          style={{
            borderColor: outstanding > 0 ? "var(--gold)" : "var(--sand)",
            background: outstanding > 0 ? "#fbf3df" : "white",
          }}
        >
          <p className="text-xs text-gray-500">Outstanding commission</p>

          <p className="text-2xl font-bold mt-1">
            GMD {outstanding.toLocaleString()}
          </p>
        </div>

        {error && (
          <p className="rounded-xl border p-4 text-sm text-red-700">
            Couldn&apos;t load your commission history.
          </p>
        )}

        {!error && (!commissions || commissions.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{ borderColor: "var(--sand)" }}
          >
            You do not have any commission charges.
          </div>
        )}

        <div className="space-y-3">
          {(commissions ?? []).map((commission) => {
            const paused =
              commission.status === "instructions_requested" ||
              commission.status === "proof_submitted";

            return (
              <article
                key={commission.id}
                className="rounded-xl border bg-white p-4"
                style={{
                  borderColor:
                    commission.status === "overdue" ||
                    commission.status === "rejected"
                      ? "var(--clay)"
                      : "var(--sand)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400">
                      Order #{commission.order_id.slice(0, 8)}
                    </p>

                    <p className="font-bold mt-1">
                      GMD {Number(commission.commission_amount).toLocaleString()}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      5% of GMD{" "}
                      {Number(commission.order_total).toLocaleString()}
                    </p>
                  </div>

                  <span className="text-xs font-semibold">
                    {STATUS_LABELS[commission.status] ?? commission.status}
                  </span>
                </div>

                {commission.due_at &&
                  !["paid", "waived"].includes(commission.status) && (
                    <p className="text-xs text-gray-500 mt-3">
                      {paused
                        ? "Deadline paused"
                        : `Due: ${new Date(
                            commission.due_at,
                          ).toLocaleString()}`}
                    </p>
                  )}

                {commission.payment_instructions && (
                  <div
                    className="rounded-lg p-3 mt-3 text-sm whitespace-pre-wrap"
                    style={{ background: "#f5f3ed" }}
                  >
                    <p className="text-xs font-semibold mb-1">
                      Payment instructions
                    </p>

                    {commission.payment_instructions}
                  </div>
                )}

                {commission.admin_note && (
                  <p className="text-xs text-red-700 mt-3">
                    Teraa: {commission.admin_note}
                  </p>
                )}

                <CommissionPaymentActions
                  commissionId={commission.id}
                  status={commission.status}
                />
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}