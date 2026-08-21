"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function approveSeller(sellerId: string) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("sellers")
    .update({ verification_status: "approved" })
    .eq("id", sellerId);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin");
}

export async function rejectSeller(sellerId: string) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("sellers")
    .update({ verification_status: "rejected" })
    .eq("id", sellerId);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin");
}
