"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

function cleanReason(formData: FormData) {
  const reason = String(formData.get("moderation_reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a reason for removing this listing.");
  }

  return reason;
}

export async function adminHideListing(productId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const moderationReason = cleanReason(formData);

  const { error } = await supabase
    .from("products")
    .update({
      status: "admin_hidden",
      moderation_reason: moderationReason,
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't remove listing.");
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath(`/seller/dashboard/products/${productId}`);
}

export async function adminRestoreListing(productId: string) {
  const { supabase } = await requireAdmin();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error("Listing not found.");
  }

  const nextStatus = product.stock_quantity > 0 ? "active" : "out_of_stock";

  const { error } = await supabase
    .from("products")
    .update({
      status: nextStatus,
      moderation_reason: null,
      moderated_at: null,
      moderated_by: null,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't restore listing.");
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin/reports");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath(`/seller/dashboard/products/${productId}`);
}
