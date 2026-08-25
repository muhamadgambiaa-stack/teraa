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
    .select("id, seller_id, status, stock_quantity")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    throw new Error("Product not found.");
  }

  if (product.seller_id !== user.id) {
    throw new Error("You are not allowed to manage this listing.");
  }

  return { supabase, product };
}

export async function updateListing(productId: string, formData: FormData) {
  const { supabase } = await requireOwnProduct(productId);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locationCity = String(formData.get("location_city") ?? "").trim();
  const condition = String(formData.get("condition") ?? "");
  const price = Number(formData.get("price"));
  const stockQuantity = Number(formData.get("stock_quantity"));

  if (!title) throw new Error("Product title is required.");
  if (!description) throw new Error("Product description is required.");
  if (!locationCity) throw new Error("Location is required.");

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Enter a valid price.");
  }

  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new Error("Stock quantity must be 0 or more.");
  }

  if (!["new", "used"].includes(condition)) {
    throw new Error("Invalid product condition.");
  }

  const { data: current } = await supabase
    .from("products")
    .select("status")
    .eq("id", productId)
    .single();

  let nextStatus = current?.status ?? "active";

  if (nextStatus !== "hidden") {
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

  redirect("/seller/dashboard");
}

export async function hideListing(productId: string) {
  const { supabase } = await requireOwnProduct(productId);

  const { error } = await supabase
    .from("products")
    .update({ status: "hidden" })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't hide listing.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/search");

  redirect("/seller/dashboard");
}

export async function reactivateListing(productId: string) {
  const { supabase, product } = await requireOwnProduct(productId);

  const nextStatus = product.stock_quantity > 0 ? "active" : "out_of_stock";

  const { error } = await supabase
    .from("products")
    .update({ status: nextStatus })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message || "Couldn't reactivate listing.");
  }

  revalidatePath(`/seller/dashboard/products/${productId}`);
  revalidatePath("/seller/dashboard");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/search");

  redirect("/seller/dashboard");
}
