"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/require-admin";

export async function provideCommissionInstructions(formData: FormData) {
  const commissionId = String(
    formData.get("commissionId") ?? "",
  ).trim();

  const instructions = String(
    formData.get("instructions") ?? "",
  ).trim();

  if (!commissionId || instructions.length < 5) {
    throw new Error("Enter valid payment instructions.");
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc(
    "admin_provide_commission_instructions",
    {
      p_commission_id: commissionId,
      p_instructions: instructions,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateCommissionPages(commissionId);
}

export async function reviewCommissionPayment(formData: FormData) {
  const commissionId = String(
    formData.get("commissionId") ?? "",
  ).trim();

  const decision = String(
    formData.get("decision") ?? "",
  ).trim();

  const note = String(formData.get("note") ?? "").trim();

  if (!commissionId || !["approve", "reject", "waive"].includes(decision)) {
    throw new Error("Invalid commission decision.");
  }

  if (decision === "reject" && !note) {
    throw new Error("A rejection reason is required.");
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc(
    "admin_review_commission_payment",
    {
      p_commission_id: commissionId,
      p_decision: decision,
      p_note: note || null,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateCommissionPages(commissionId);
}

function revalidateCommissionPages(commissionId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/commissions");
  revalidatePath(`/admin/commissions/${commissionId}`);
  revalidatePath("/seller/dashboard/commissions");
  revalidatePath("/notifications");
}