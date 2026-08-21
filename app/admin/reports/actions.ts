"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function markReportReviewed(reportId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("reports").update({ status: "reviewed" }).eq("id", reportId);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function markReportResolved(reportId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}
