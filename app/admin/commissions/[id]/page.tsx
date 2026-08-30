import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import {
  provideCommissionInstructions,
  reviewCommissionPayment,
} from "../actions";

type Params = Promise<{
  id: string;
}>;

export default async function AdminCommissionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: commission } = await supabase
    .from("commissions")
    .select(`
      id,
      seller_id,
      order_id,
      order_total,
      commission_rate,
      commission_amount,
      status,
      due_at,
      deadline_paused_at,
      instructions_requested_at,
      instructions_provided_at,
      payment_instructions,
      proof_path,
      proof_submitted_at,
      reviewed_at,
      admin_note,
      paid_at,
      created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (!commission) {
    notFound();
  }

  const [{ data: seller }, { data: order }] = await Promise.all([
    supabase
      .from("sellers")
      .select("business_name, legal_name, account_status")
      .eq("id", commission.seller_id)
      .maybeSingle(),

    supabase
      .from("orders")
      .select("id, status, created_at")
      .eq("id", commission.order_id)
      .maybeSingle(),
  ]);

  let proofUrl: string | null = null;

  if (commission.proof_path) {
    const { data } = await supabase.storage
      .from("commission-proofs")
      .createSignedUrl(commission.proof_path, 600);

    proofUrl = data?.signedUrl ?? null;
  }

  const isClosed = ["paid", "waived"].includes(commission.status);

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href="/admin/commissions"
          className="text-sm"
          style={{ color: "var(--indigo)" }}
        >
          Back to commissions
        </Link>

        <h1 className="font-display text-2xl mt-4">
          Commission review
        </h1>

        <div
          className="rounded-xl border bg-white p-5 mt-6"
          style={{ borderColor: "var(--sand)" }}
        >
          <p className="font-semibold">
            {seller?.business_name ?? "Seller"}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {seller?.legal_name}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <Detail
              label="Order"
              value={`#${commission.order_id.slice(0, 8)}`}
            />

            <Detail label="Status" value={commission.status} />

            <Detail
              label="Order total"
              value={`GMD ${Number(
                commission.order_total,
              ).toLocaleString()}`}
            />

            <Detail
              label="Commission"
              value={`GMD ${Number(
                commission.commission_amount,
              ).toLocaleString()}`}
            />

            <Detail
              label="Rate"
              value={`${Number(commission.commission_rate) * 100}%`}
            />

            <Detail
              label="Deadline"
              value={
                commission.deadline_paused_at
                  ? "Paused"
                  : commission.due_at
                    ? new Date(commission.due_at).toLocaleString()
                    : "None"
              }
            />
          </div>
        </div>

        {commission.status === "instructions_requested" && (
          <form
            action={provideCommissionInstructions}
            className="rounded-xl border bg-white p-5 mt-4"
            style={{ borderColor: "var(--gold)" }}
          >
            <input
              type="hidden"
              name="commissionId"
              value={commission.id}
            />

            <label className="text-sm font-semibold">
              Payment instructions
            </label>

            <textarea
              name="instructions"
              required
              minLength={5}
              maxLength={5000}
              rows={5}
              placeholder="Enter the Wave number, account name and payment reference instructions."
              className="w-full rounded-lg border p-3 text-sm mt-2"
              style={{ borderColor: "var(--sand)" }}
            />

            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm text-white mt-3"
              style={{ background: "var(--indigo)" }}
            >
              Send instructions
            </button>
          </form>
        )}

        {commission.proof_path && (
          <section
            className="rounded-xl border bg-white p-5 mt-4"
            style={{ borderColor: "var(--sand)" }}
          >
            <p className="font-semibold text-sm">Payment proof</p>

            {proofUrl ? (
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm underline mt-2"
                style={{ color: "var(--indigo)" }}
              >
                Open submitted proof
              </a>
            ) : (
              <p className="text-xs text-red-700 mt-2">
                Proof could not be opened.
              </p>
            )}
          </section>
        )}

        {commission.status === "proof_submitted" && (
          <section className="grid sm:grid-cols-2 gap-4 mt-4">
            <form
              action={reviewCommissionPayment}
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--leaf)" }}
            >
              <input
                type="hidden"
                name="commissionId"
                value={commission.id}
              />

              <input type="hidden" name="decision" value="approve" />

              <label className="text-sm font-semibold">
                Approve payment
              </label>

              <textarea
                name="note"
                maxLength={1000}
                rows={3}
                placeholder="Optional admin note"
                className="w-full rounded-lg border p-3 text-sm mt-2"
                style={{ borderColor: "var(--sand)" }}
              />

              <button
                type="submit"
                className="rounded-full px-5 py-2 text-sm text-white mt-3"
                style={{ background: "var(--leaf)" }}
              >
                Confirm payment
              </button>
            </form>

            <form
              action={reviewCommissionPayment}
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--clay)" }}
            >
              <input
                type="hidden"
                name="commissionId"
                value={commission.id}
              />

              <input type="hidden" name="decision" value="reject" />

              <label className="text-sm font-semibold">
                Reject proof
              </label>

              <textarea
                name="note"
                required
                maxLength={1000}
                rows={3}
                placeholder="Explain why the proof was rejected"
                className="w-full rounded-lg border p-3 text-sm mt-2"
                style={{ borderColor: "var(--sand)" }}
              />

              <button
                type="submit"
                className="rounded-full px-5 py-2 text-sm text-white mt-3"
                style={{ background: "var(--clay)" }}
              >
                Reject proof
              </button>
            </form>
          </section>
        )}

        {!isClosed && (
          <form
            action={reviewCommissionPayment}
            className="rounded-xl border bg-white p-5 mt-4"
            style={{ borderColor: "var(--sand)" }}
          >
            <input
              type="hidden"
              name="commissionId"
              value={commission.id}
            />

            <input type="hidden" name="decision" value="waive" />

            <label className="text-sm font-semibold">
              Waive commission
            </label>

            <textarea
              name="note"
              maxLength={1000}
              rows={2}
              placeholder="Optional reason"
              className="w-full rounded-lg border p-3 text-sm mt-2"
              style={{ borderColor: "var(--sand)" }}
            />

            <button
              type="submit"
              className="rounded-full border px-5 py-2 text-sm mt-3"
              style={{
                borderColor: "var(--indigo)",
                color: "var(--indigo)",
              }}
            >
              Waive payment
            </button>
          </form>
        )}
      </main>
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium mt-0.5 capitalize">{value}</p>
    </div>
  );
}