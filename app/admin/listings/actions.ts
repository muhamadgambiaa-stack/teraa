"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function adminHideListing(productId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("products")
    .update({
      status: "hidden",
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/products/${productId}`);
}

export async function adminReactivateListing(productId: string) {
  const { supabase } = await requireAdmin();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error("Listing not found.");
  }

  const status = product.stock_quantity > 0 ? "active" : "out_of_stock";

  const { error } = await supabase
    .from("products")
    .update({
      status,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/listings");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/products/${productId}`);
}
