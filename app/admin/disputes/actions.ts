"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/require-admin";

export async function resolveDeliveryDispute(
  orderId: string,
  formData: FormData,
) {
  const { supabase } = await requireAdmin();
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const restoreSeller = formData.get("restoreSeller") === "on";

  if (!["complete_order", "cancel_order", "dismiss_report"].includes(decision)) {
    throw new Error("Choose a valid dispute decision.");
  }

  if (note.length < 10 || note.length > 500) {
    throw new Error("The decision note must be between 10 and 500 characters.");
  }

  const { error } = await supabase.rpc("admin_resolve_delivery_dispute", {
    p_order_id: orderId,
    p_decision: decision,
    p_note: note,
    p_restore_seller: restoreSeller,
  });

  if (error) {
    console.error("Could not resolve delivery dispute:", error);
    throw new Error(error.message || "Couldn't resolve this dispute.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/disputes");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/sellers");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath("/seller/dashboard/orders");
  revalidatePath(`/seller/dashboard/orders/${orderId}`);
  revalidatePath("/notifications");
}
