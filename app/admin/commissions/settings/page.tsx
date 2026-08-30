import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/require-admin";

import { updateCommissionSettings } from "./actions";

type SearchParams = Promise<{
  saved?: string;
}>;

export default async function CommissionSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: settings, error } = await supabase
    .from("commission_settings")
    .select("commission_rate, payment_window_hours, updated_at")
    .eq("id", true)
    .single();

  if (error || !settings) {
    throw new Error("Could not load commission settings.");
  }

  const ratePercent = Number(settings.commission_rate) * 100;

  return (
    <>
      <SiteHeader />

      <main className="max-w-xl mx-auto px-4 py-6">
        <Link
          href="/admin/commissions"
          className="text-sm"
          style={{ color: "var(--indigo)" }}
        >
          Back to commissions
        </Link>

        <div className="mt-4 mb-6">
          <p className="text-xs text-gray-500">Administration</p>
          <h1 className="font-display text-2xl">Commission settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Changes apply only to commissions created after saving.
          </p>
        </div>

        {params.saved === "true" && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Commission settings updated successfully.
          </div>
        )}

        <form
          action={updateCommissionSettings}
          className="rounded-xl border bg-white p-5 space-y-5"
          style={{ borderColor: "var(--sand)" }}
        >
          <label className="block">
            <span className="text-sm font-semibold">Commission rate</span>
            <span className="block text-xs text-gray-500 mt-1">
              Percentage charged when an order is completed.
            </span>

            <div className="flex items-center gap-2 mt-2">
              <input
                name="ratePercent"
                type="number"
                min="0.1"
                max="25"
                step="0.1"
                required
                defaultValue={ratePercent}
                className="w-full rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--sand)" }}
              />
              <span className="font-semibold">%</span>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Payment deadline</span>
            <span className="block text-xs text-gray-500 mt-1">
              Time sellers have before automatic suspension.
            </span>

            <div className="flex items-center gap-2 mt-2">
              <input
                name="paymentWindowHours"
                type="number"
                min="1"
                max="168"
                step="1"
                required
                defaultValue={settings.payment_window_hours}
                className="w-full rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--sand)" }}
              />
              <span className="font-semibold">hours</span>
            </div>
          </label>

          <button
            type="submit"
            className="w-full rounded-full px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--indigo)" }}
          >
            Save commission settings
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500">
          Current rate: {ratePercent}% · Current deadline:{" "}
          {settings.payment_window_hours} hours
        </p>
      </main>
    </>
  );
}
