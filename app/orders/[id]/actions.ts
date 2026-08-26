"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireActiveBuyer() {
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

  if (profile.account_status !== "active") {
    redirect("/account/status");
  }

  return {
    supabase,
    user,
  };
}

export async function cancelOrder(orderId: string) {
  const { supabase, user } = await requireActiveBuyer();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      status
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  if (order.buyer_id !== user.id) {
    throw new Error("You are not allowed to cancel this order.");
  }

  if (!["placed", "confirmed"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Order cancellation failed:", error);

    throw new Error(error.message || "Couldn't cancel the order.");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/seller/dashboard");
  revalidatePath("/seller/dashboard/orders");
  revalidatePath("/notifications");
}

export async function markOrderReceived(orderId: string) {
  const { supabase, user } = await requireActiveBuyer();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      status
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  if (order.buyer_id !== user.id) {
    throw new Error("Not authorized to update this order.");
  }

  /*
   * Buyer should only confirm receipt after
   * the seller has shipped / marked delivery.
   */
  if (!["shipped", "delivered"].includes(order.status)) {
    throw new Error("This order cannot be marked received yet.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "completed",
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message || "Couldn't complete this order.");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/seller/dashboard/orders");
  revalidatePath("/notifications");
}

export async function submitReview(formData: FormData) {
  const { supabase, user } = await requireActiveBuyer();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const sellerId = String(formData.get("sellerId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();

  const rating = Number(formData.get("rating"));

  const comment = String(formData.get("comment") ?? "").trim();

  if (
    !orderId ||
    !sellerId ||
    !productId ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new Error("Invalid review.");
  }

  if (comment.length > 1000) {
    throw new Error("Review comment is too long.");
  }

  /*
   * Verify:
   *
   * - current user owns the order
   * - seller matches the order
   * - order is completed
   */
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      status
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  if (
    order.buyer_id !== user.id ||
    order.seller_id !== sellerId ||
    order.status !== "completed"
  ) {
    throw new Error("You cannot review this order.");
  }

  /*
   * IMPORTANT SECURITY CHECK:
   *
   * Never trust productId from the browser.
   *
   * Verify that the product being reviewed
   * actually belongs to this order.
   */
  const { data: orderItem, error: orderItemError } = await supabase
    .from("order_items")
    .select(
      `
      product_id
      `,
    )
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (orderItemError || !orderItem) {
    throw new Error("This product does not belong to this order.");
  }

  /*
   * Prevent duplicate reviews for the
   * same product in the same order.
   */
  const { data: existingReview, error: existingReviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingReviewError) {
    console.error("Could not check existing review:", existingReviewError);

    throw new Error("Could not verify review status.");
  }

  if (existingReview) {
    throw new Error("You already reviewed this product.");
  }

  /*
   * Create the product review.
   */
  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    buyer_id: user.id,
    seller_id: sellerId,
    product_id: productId,
    rating,
    comment: comment || null,
  });

  if (error) {
    console.error("Review creation failed:", error);

    throw new Error(error.message || "Couldn't submit review.");
  }

  /*
   * Refresh every page affected by the review.
   */
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/profile/${sellerId}`);
  revalidatePath("/");
  revalidatePath("/search");
}
