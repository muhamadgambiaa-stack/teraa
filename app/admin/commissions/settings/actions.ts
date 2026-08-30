"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";

export async function updateCommissionSettings(formData: FormData) {
  const ratePercent = Number(formData.get("ratePercent"));
  const paymentWindowHours = Number(formData.get("paymentWindowHours"));

  if (
    !Number.isFinite(ratePercent) ||
    ratePercent < 0.1 ||
    ratePercent > 25
  ) {
    throw new Error("Commission rate must be between 0.1% and 25%.");
  }

  if (
    !Number.isInteger(paymentWindowHours) ||
    paymentWindowHours < 1 ||
    paymentWindowHours > 168
  ) {
    throw new Error("Payment deadline must be between 1 and 168 hours.");
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc(
    "admin_update_commission_settings",
    {
      p_commission_rate: ratePercent / 100,
      p_payment_window_hours: paymentWindowHours,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/commissions/settings");
  redirect("/admin/commissions/settings?saved=true");
}
