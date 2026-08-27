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

  revalidatePath(`/seller/dashboard/orders/${orderId}`);

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
      seller_id,
      status,
      payment_method,
      payment_status
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
   * Buyer can confirm receipt after the
   * order has been shipped or marked
   * delivered by the seller.
   */
  if (!["shipped", "delivered"].includes(order.status)) {
    throw new Error("This order cannot be marked received yet.");
  }

  /*
   * TERAA COD V1
   *
   * Once the buyer confirms that the item
   * was actually received, the marketplace
   * considers:
   *
   * order = completed
   * COD payment = paid
   *
   * Digital orders from older tests are
   * completed without automatically
   * claiming their payment was verified.
   */
  const updateData =
    order.payment_method === "cod"
      ? {
          status: "completed",
          payment_status: "paid",
        }
      : {
          status: "completed",
        };

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .eq("buyer_id", user.id);

  if (error) {
    console.error("Order completion failed:", error);

    throw new Error(error.message || "Couldn't complete this order.");
  }

  revalidatePath(`/orders/${orderId}`);

  revalidatePath("/orders");

  revalidatePath("/seller/dashboard/orders");

  revalidatePath(`/seller/dashboard/orders/${orderId}`);

  revalidatePath(`/profile/${order.seller_id}`);

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
   * Confirm this is the buyer's completed
   * order and that it belongs to the
   * expected seller.
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
   * Confirm the product was actually part
   * of this order.
   */
  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .select(
      `
      order_id,
      product_id
      `,
    )
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (itemError || !orderItem) {
    throw new Error("This product was not part of the order.");
  }

  /*
   * Prevent duplicate product reviews for
   * the same order.
   */
  const { data: existingReview, error: existingReviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingReviewError) {
    console.error("Could not check existing review:", existingReviewError);

    throw new Error("Couldn't verify whether this order was already reviewed.");
  }

  if (existingReview) {
    throw new Error("You already reviewed this product.");
  }

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

  revalidatePath(`/orders/${orderId}`);

  revalidatePath(`/products/${productId}`);

  revalidatePath(`/profile/${sellerId}`);
}
