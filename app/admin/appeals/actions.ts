"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

function refreshAppealPaths(appealId: string, productId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/appeals");
  revalidatePath(`/admin/appeals/${appealId}`);

  revalidatePath("/admin/listings");
  revalidatePath("/admin/reports");

  revalidatePath("/seller/dashboard");
  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/search");
}

export async function approveListingAppeal(
  appealId: string,
  productId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireAdmin();

  const response = String(formData.get("admin_response") ?? "").trim();

  if (!response) {
    throw new Error("Please provide a response to the seller.");
  }

  const { data: appeal, error: appealError } = await supabase
    .from("listing_appeals")
    .select("id, product_id, seller_id, status")
    .eq("id", appealId)
    .maybeSingle();

  if (appealError || !appeal) {
    throw new Error("Appeal not found.");
  }

  if (appeal.status !== "pending") {
    throw new Error("This appeal has already been reviewed.");
  }

  if (appeal.product_id !== productId) {
    throw new Error("Appeal does not match this listing.");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, status, stock_quantity")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    throw new Error("Listing not found.");
  }

  if (product.status !== "admin_hidden") {
    throw new Error("This listing is no longer awaiting restoration.");
  }

  const nextStatus = product.stock_quantity > 0 ? "active" : "out_of_stock";

  const { error: restoreError } = await supabase
    .from("products")
    .update({
      status: nextStatus,
      moderation_reason: null,
      moderated_at: null,
      moderated_by: null,
    })
    .eq("id", productId);

  if (restoreError) {
    throw new Error(restoreError.message || "Couldn't restore listing.");
  }

  const { error: updateAppealError } = await supabase
    .from("listing_appeals")
    .update({
      status: "approved",
      admin_response: response,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", appealId);

  if (updateAppealError) {
    throw new Error(
      updateAppealError.message ||
        "Listing was restored, but the appeal could not be updated.",
    );
  }

  refreshAppealPaths(appealId, productId);
}

export async function rejectListingAppeal(
  appealId: string,
  productId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireAdmin();

  const response = String(formData.get("admin_response") ?? "").trim();

  if (!response) {
    throw new Error("Please explain why the listing is staying removed.");
  }

  const { data: appeal, error: appealError } = await supabase
    .from("listing_appeals")
    .select("id, product_id, status")
    .eq("id", appealId)
    .maybeSingle();

  if (appealError || !appeal) {
    throw new Error("Appeal not found.");
  }

  if (appeal.status !== "pending") {
    throw new Error("This appeal has already been reviewed.");
  }

  if (appeal.product_id !== productId) {
    throw new Error("Appeal does not match this listing.");
  }

  const { error } = await supabase
    .from("listing_appeals")
    .update({
      status: "rejected",
      admin_response: response,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", appealId);

  if (error) {
    throw new Error(error.message || "Couldn't reject appeal.");
  }

  /*
   * Product intentionally remains admin_hidden.
   */
  refreshAppealPaths(appealId, productId);
}
