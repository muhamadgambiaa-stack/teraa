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
  };
}

export async function updateListing(productId: string, formData: FormData) {
  const { supabase, product } = await requireOwnProduct(productId);

  const title = String(formData.get("title") ?? "").trim();

  const description = String(formData.get("description") ?? "").trim();

  const locationCity = String(formData.get("location_city") ?? "").trim();

  const condition = String(formData.get("condition") ?? "");

  const price = Number(formData.get("price"));

  const stockQuantity = Number(formData.get("stock_quantity"));

  if (!title) {
    throw new Error("Product title is required.");
  }

  if (!description) {
    throw new Error("Product description is required.");
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

  let nextStatus = product.status;

  if (product.status !== "admin_hidden" && product.status !== "hidden") {
    nextStatus = stockQuantity > 0 ? "active" : "out_of_stock";
  }

  const { error } = await supabase
    .from("products")
    .update({
      title,
      description,
      location_city: locationCity,
      condition,
      price,
      stock_quantity: stockQuantity,
      status: nextStatus,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't update listing.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/search");

  redirect(`/seller/dashboard/products/${productId}`);
}

export async function hideListing(productId: string) {
  const { supabase, product } = await requireOwnProduct(productId);

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
  const { supabase, product } = await requireOwnProduct(productId);

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
  const { supabase, product, user } = await requireOwnProduct(productId);

  if (product.status !== "admin_hidden") {
    throw new Error(
      "Only listings removed by Teraa can be submitted for review.",
    );
  }

  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 10) {
    throw new Error(
      "Please briefly explain what you changed before requesting a review.",
    );
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (sellerError || !seller) {
    throw new Error("Seller account could not be found.");
  }

  if (seller.account_status === "banned") {
    throw new Error("Banned seller accounts cannot request listing reviews.");
  }

  const { data: existingAppeal, error: appealLookupError } = await supabase
    .from("listing_appeals")
    .select("id, status")
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
}
