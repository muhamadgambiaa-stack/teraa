"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireOwnProduct(productId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      `
      id,
      account_status
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Could not load your Teraa account.");
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select(
      `
      id,
      verification_status,
      account_status
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (sellerError || !seller) {
    throw new Error("Seller account could not be found.");
  }

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      seller_id,
      status,
      stock_quantity,
      moderation_reason
      `,
    )
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    throw new Error("Product not found.");
  }

  if (product.seller_id !== user.id) {
    throw new Error("You are not allowed to manage this listing.");
  }

  return {
    supabase,
    product,
    user,
    profile,
    seller,
  };
}

function ensureSellerCanOperate({
  profileStatus,
  sellerStatus,
  verificationStatus,
}: {
  profileStatus: string;
  sellerStatus: string;
  verificationStatus: string;
}) {
  if (profileStatus !== "active") {
    redirect("/account/status");
  }

  if (sellerStatus !== "active") {
    throw new Error("Your seller account is not currently active.");
  }

  if (verificationStatus !== "approved") {
    throw new Error(
      "Your seller account must be verified before managing live listings.",
    );
  }
}

export async function updateListing(productId: string, formData: FormData) {
  const { supabase, product, profile, seller } =
    await requireOwnProduct(productId);

  /*
   * Allow a seller to correct an admin-hidden
   * listing so they can later submit an appeal.
   *
   * Normal listings require an active and
   * verified seller account.
   */
  if (product.status !== "admin_hidden") {
    ensureSellerCanOperate({
      profileStatus: profile.account_status,
      sellerStatus: seller.account_status,
      verificationStatus: seller.verification_status,
    });
  }

  /*
   * Banned accounts cannot modify anything,
   * including admin-hidden listings.
   */
  if (
    profile.account_status === "banned" ||
    seller.account_status === "banned"
  ) {
    redirect("/account/status");
  }

  /*
   * FORM VALUES
   */

  const title = String(formData.get("title") ?? "").trim();

  const description = String(formData.get("description") ?? "").trim();

  const categoryId = String(formData.get("category_id") ?? "").trim();

  const locationCity = String(formData.get("location_city") ?? "").trim();

  const condition = String(formData.get("condition") ?? "").trim();

  const price = Number(formData.get("price"));

  const stockQuantity = Number(formData.get("stock_quantity"));

  /*
   * VALIDATION
   */

  if (!title) {
    throw new Error("Product title is required.");
  }

  if (!description) {
    throw new Error("Product description is required.");
  }

  if (!categoryId) {
    throw new Error("Choose a product category.");
  }

  if (!locationCity) {
    throw new Error("Location is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Enter a valid price.");
  }

  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new Error("Stock quantity must be 0 or more.");
  }

  if (!["new", "used"].includes(condition)) {
    throw new Error("Invalid product condition.");
  }

  /*
   * CATEGORY SECURITY CHECK
   *
   * Never trust the category UUID submitted
   * by the browser. Confirm that it exists.
   */
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select(
      `
      id,
      name
      `,
    )
    .eq("id", categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    throw new Error("The selected product category is invalid.");
  }

  /*
   * DETERMINE NEXT LISTING STATUS
   *
   * admin_hidden:
   * Editing must never restore it.
   *
   * hidden:
   * Editing must never automatically make
   * the seller-hidden product visible.
   *
   * Everything else:
   * Stock controls whether it is active or
   * out of stock.
   */
  let nextStatus = product.status;

  if (product.status !== "admin_hidden" && product.status !== "hidden") {
    nextStatus = stockQuantity > 0 ? "active" : "out_of_stock";
  }

  /*
   * UPDATE PRODUCT
   */

  const { error } = await supabase
    .from("products")
    .update({
      title,

      description,

      category_id: categoryId,

      location_city: locationCity,

      condition,

      price,

      stock_quantity: stockQuantity,

      status: nextStatus,
    })
    .eq("id", productId);

  if (error) {
    console.error("Listing update failed:", error);

    throw new Error(error.message || "Couldn't update listing.");
  }

  /*
   * REFRESH AFFECTED PAGES
   */

  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath(`/products/${productId}`);

  revalidatePath("/");

  revalidatePath("/search");

  redirect(`/seller/dashboard/products/${productId}`);
}

export async function hideListing(productId: string) {
  const { supabase, product, profile, seller } =
    await requireOwnProduct(productId);

  ensureSellerCanOperate({
    profileStatus: profile.account_status,
    sellerStatus: seller.account_status,
    verificationStatus: seller.verification_status,
  });

  if (product.status === "admin_hidden") {
    throw new Error(
      "This listing was removed by Teraa and cannot be changed by the seller.",
    );
  }

  const { error } = await supabase
    .from("products")
    .update({
      status: "hidden",
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't hide listing.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/");

  revalidatePath("/search");

  redirect("/seller/dashboard");
}

export async function reactivateListing(productId: string) {
  const { supabase, product, profile, seller } =
    await requireOwnProduct(productId);

  ensureSellerCanOperate({
    profileStatus: profile.account_status,
    sellerStatus: seller.account_status,
    verificationStatus: seller.verification_status,
  });

  if (product.status === "admin_hidden") {
    throw new Error(
      "This listing was removed by Teraa. Only an administrator can restore it.",
    );
  }

  if (product.status !== "hidden") {
    throw new Error("This listing is not seller-hidden.");
  }

  const nextStatus = product.stock_quantity > 0 ? "active" : "out_of_stock";

  const { error } = await supabase
    .from("products")
    .update({
      status: nextStatus,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't reactivate listing.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/");

  revalidatePath("/search");

  redirect("/seller/dashboard");
}

export async function requestListingReview(
  productId: string,
  formData: FormData,
) {
  const { supabase, product, user, profile, seller } =
    await requireOwnProduct(productId);

  if (product.status !== "admin_hidden") {
    throw new Error(
      "Only listings removed by Teraa can be submitted for review.",
    );
  }

  /*
   * Banned accounts cannot appeal.
   *
   * Restricted or suspended accounts may
   * still appeal admin-hidden listings.
   */
  if (
    profile.account_status === "banned" ||
    seller.account_status === "banned"
  ) {
    redirect("/account/status");
  }

  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 10) {
    throw new Error(
      "Please briefly explain what you changed before requesting a review.",
    );
  }

  if (message.length > 2000) {
    throw new Error("Review request is too long.");
  }

  const { data: existingAppeal, error: appealLookupError } = await supabase
    .from("listing_appeals")
    .select(
      `
      id,
      status
      `,
    )
    .eq("product_id", productId)
    .eq("status", "pending")
    .maybeSingle();

  if (appealLookupError) {
    throw new Error(appealLookupError.message);
  }

  if (existingAppeal) {
    throw new Error("A review request is already pending for this listing.");
  }

  const { error } = await supabase.from("listing_appeals").insert({
    product_id: productId,

    seller_id: user.id,

    message,
  });

  if (error) {
    throw new Error(error.message || "Couldn't submit review request.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/admin/appeals");

  revalidatePath("/notifications");
}
