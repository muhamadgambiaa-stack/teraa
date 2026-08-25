"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function markReportReviewed(reportId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("reports")
    .update({
      status: "reviewed",
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function markReportResolved(reportId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("reports")
    .update({
      status: "resolved",
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function hideReportedListing(reportId: string, productId: string) {
  const { supabase } = await requireAdmin();

  /*
   * Keep the listing in the database for:
   * - order history
   * - investigation
   * - appeals
   * - reports
   *
   * but remove it from the public marketplace.
   */
  const { error: productError } = await supabase
    .from("products")
    .update({
      status: "hidden",
    })
    .eq("id", productId);

  if (productError) {
    throw new Error(productError.message);
  }

  /*
   * Once an admin takes moderation action,
   * mark the report resolved.
   */
  const { error: reportError } = await supabase
    .from("reports")
    .update({
      status: "resolved",
    })
    .eq("id", reportId);

  if (reportError) {
    throw new Error(reportError.message);
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/products/${productId}`);
}
