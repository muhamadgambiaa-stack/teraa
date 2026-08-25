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
    throw new Error(error.message || "Couldn't mark report as reviewed.");
  }

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
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
    throw new Error(error.message || "Couldn't resolve report.");
  }

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
  revalidatePath("/admin");
}

export async function reopenReport(reportId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("reports")
    .update({
      status: "open",
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message || "Couldn't reopen report.");
  }

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
  revalidatePath("/admin");
}

export async function hideReportedListing(
  reportId: string,
  productId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireAdmin();

  const reason = String(formData.get("moderation_reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a reason for removing the listing.");
  }

  const { data: product, error: productLookupError } = await supabase
    .from("products")
    .select(
      `
      id,
      status
      `,
    )
    .eq("id", productId)
    .maybeSingle();

  if (productLookupError || !product) {
    throw new Error("The reported listing could not be found.");
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      status: "admin_hidden",

      moderation_reason: reason,

      moderated_at: new Date().toISOString(),

      moderated_by: user.id,
    })
    .eq("id", productId);

  if (productError) {
    throw new Error(productError.message || "Couldn't remove listing.");
  }

  /*
   * If admin removes the reported listing,
   * the report is considered resolved.
   */
  const { error: reportError } = await supabase
    .from("reports")
    .update({
      status: "resolved",
    })
    .eq("id", reportId);

  if (reportError) {
    throw new Error(
      reportError.message ||
        "Listing was removed, but the report could not be resolved.",
    );
  }

  revalidatePath("/admin/reports");

  revalidatePath(`/admin/reports/${reportId}`);

  revalidatePath("/admin/listings");

  revalidatePath("/admin/sellers");

  revalidatePath("/admin");

  revalidatePath(`/products/${productId}`);

  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/");
  revalidatePath("/search");
}
