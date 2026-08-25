"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

function refreshSellerAdmin(sellerId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${sellerId}`);

  revalidatePath("/seller/dashboard");
  revalidatePath("/");

  revalidatePath("/search");
}

export async function approveSeller(sellerId: string) {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("sellers")
    .update({
      verification_status: "approved",

      verification_request_reason: null,

      account_status: "active",

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (error) {
    throw new Error(error.message || "Couldn't approve seller.");
  }

  refreshSellerAdmin(sellerId);
}

export async function rejectSeller(sellerId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a rejection reason.");
  }

  const { error } = await supabase
    .from("sellers")
    .update({
      verification_status: "rejected",

      verification_request_reason: reason,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (error) {
    throw new Error(error.message || "Couldn't reject seller.");
  }

  refreshSellerAdmin(sellerId);
}

export async function requestAdditionalVerification(
  sellerId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error(
      "Tell the seller what additional verification is required.",
    );
  }

  /*
   * Return the seller to pending verification.
   *
   * We keep the old ID document reference so admin
   * can retain context until the seller replaces it.
   */
  const { error } = await supabase
    .from("sellers")
    .update({
      verification_status: "pending",

      verification_request_reason: reason,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (error) {
    throw new Error(
      error.message || "Couldn't request additional verification.",
    );
  }

  refreshSellerAdmin(sellerId);
}

export async function suspendSeller(sellerId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a suspension reason.");
  }

  const { error: sellerError } = await supabase
    .from("sellers")
    .update({
      account_status: "suspended",

      admin_note: reason,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (sellerError) {
    throw new Error(sellerError.message || "Couldn't suspend seller.");
  }

  /*
   * Remove currently-public listings.
   *
   * We do NOT delete anything.
   */
  const { error: listingsError } = await supabase
    .from("products")
    .update({
      status: "admin_hidden",

      moderation_reason: `Seller account suspended: ${reason}`,

      moderated_at: new Date().toISOString(),

      moderated_by: user.id,
    })
    .eq("seller_id", sellerId)
    .in("status", ["active", "out_of_stock"]);

  if (listingsError) {
    throw new Error(
      listingsError.message ||
        "Seller was suspended but listings could not be hidden.",
    );
  }

  refreshSellerAdmin(sellerId);
}

export async function banSeller(sellerId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a ban reason.");
  }

  const { error: sellerError } = await supabase
    .from("sellers")
    .update({
      account_status: "banned",

      admin_note: reason,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (sellerError) {
    throw new Error(sellerError.message || "Couldn't ban seller.");
  }

  const { error: listingsError } = await supabase
    .from("products")
    .update({
      status: "admin_hidden",

      moderation_reason: `Seller account banned: ${reason}`,

      moderated_at: new Date().toISOString(),

      moderated_by: user.id,
    })
    .eq("seller_id", sellerId)
    .neq("status", "admin_hidden");

  if (listingsError) {
    throw new Error(
      listingsError.message ||
        "Seller was banned but listings could not be hidden.",
    );
  }

  refreshSellerAdmin(sellerId);
}

export async function reinstateSeller(sellerId: string) {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("sellers")
    .update({
      account_status: "active",

      admin_note: null,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (error) {
    throw new Error(error.message || "Couldn't reinstate seller.");
  }

  /*
   * Listings are intentionally NOT restored automatically.
   *
   * Admin should review previously-hidden listings individually.
   */
  refreshSellerAdmin(sellerId);
}

export async function saveAdminSellerNote(
  sellerId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireAdmin();

  const note = String(formData.get("note") ?? "").trim();

  const { error } = await supabase
    .from("sellers")
    .update({
      admin_note: note || null,

      status_updated_at: new Date().toISOString(),

      status_updated_by: user.id,
    })
    .eq("id", sellerId);

  if (error) {
    throw new Error(error.message || "Couldn't save admin note.");
  }

  refreshSellerAdmin(sellerId);
}
