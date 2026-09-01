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

/*
 * ============================================================
 * MESSAGE SELLER FROM ORDER
 * ============================================================
 */
export async function messageSellerFromOrder(orderId: string) {
  const { supabase } = await requireActiveBuyer();

  const { data: conversationId, error } = await supabase.rpc(
    "buyer_open_order_conversation",
    {
      p_order_id: orderId,
    },
  );

  if (error) {
    console.error("Could not open seller conversation:", error);

    throw new Error(
      error.message || "Couldn't open a conversation with this seller.",
    );
  }

  if (!conversationId) {
    throw new Error("Couldn't open a conversation with this seller.");
  }

  const { error: restoreError } = await supabase.rpc(
    "restore_my_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (restoreError) {
    throw new Error(restoreError.message || "Couldn't restore conversation.");
  }

  redirect(`/messages/${conversationId}`);
}

/*
 * ============================================================
 * REPORT ORDER NOT RECEIVED
 * ============================================================
 */
export async function reportOrderNotReceived(orderId: string) {
  const { supabase } = await requireActiveBuyer();

  const { error } = await supabase.rpc("report_order_not_received", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Delivery issue report failed:", error);

    throw new Error(error.message || "Couldn't report this delivery issue.");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  revalidatePath(`/seller/dashboard/orders/${orderId}`);
  revalidatePath("/seller/dashboard/orders");

  revalidatePath("/notifications");
}

/*
 * ============================================================
 * CANCEL ORDER
 * ============================================================
 */
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

/*
 * ============================================================
 * MARK ORDER RECEIVED
 * ============================================================
 */
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

  if (order.status !== "delivered") {
    throw new Error(
      "The seller must confirm delivery before you can mark this order received.",
    );
  }

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
    .eq("buyer_id", user.id)
    .eq("status", "delivered");

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

/*
 * ============================================================
 * SUBMIT PRODUCT REVIEW
 * ============================================================
 */
export async function submitReview(formData: FormData) {
  const { supabase, user } = await requireActiveBuyer();

  const orderId = String(formData.get("orderId") ?? "").trim();

  const productId = String(formData.get("productId") ?? "").trim();

  const rating = Number(formData.get("rating"));

  const comment = String(formData.get("comment") ?? "").trim();

  if (
    !orderId ||
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

  if (order.buyer_id !== user.id || order.status !== "completed") {
    throw new Error("You cannot review this order.");
  }

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

  const { data: existingReview, error: existingReviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingReviewError) {
    throw new Error("Couldn't verify whether this order was already reviewed.");
  }

  if (existingReview) {
    throw new Error("You already reviewed this product.");
  }

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    buyer_id: user.id,
    seller_id: order.seller_id,
    product_id: productId,
    rating,
    comment: comment || null,
  });

  if (error) {
    console.error("Review creation failed:", error);

    throw new Error(error.message || "Couldn't submit review.");
  }

  revalidateReviewPages(orderId, order.seller_id, productId);
}

/*
 * ============================================================
 * UPDATE PRODUCT REVIEW
 * ============================================================
 */
export async function updateReview(formData: FormData) {
  const { supabase, user } = await requireActiveBuyer();

  const reviewId = String(formData.get("reviewId") ?? "").trim();

  const rating = Number(formData.get("rating"));

  const comment = String(formData.get("comment") ?? "").trim();

  if (!reviewId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Choose a rating from 1 to 5 stars.");
  }

  if (comment.length > 1000) {
    throw new Error("Review comment is too long.");
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      order_id,
      product_id
      `,
    )
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError || !review) {
    throw new Error("Review not found.");
  }

  if (review.buyer_id !== user.id) {
    throw new Error("You cannot edit this review.");
  }

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
    .eq("id", review.order_id)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  if (
    order.buyer_id !== user.id ||
    order.seller_id !== review.seller_id ||
    order.status !== "completed"
  ) {
    throw new Error("This review can no longer be edited.");
  }

  const { error } = await supabase
    .from("reviews")
    .update({
      rating,
      comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .eq("buyer_id", user.id);

  if (error) {
    console.error("Review update failed:", error);

    throw new Error(error.message || "Couldn't update your review.");
  }

  revalidateReviewPages(review.order_id, review.seller_id, review.product_id);
}

/*
 * ============================================================
 * REVALIDATION
 * ============================================================
 */
function revalidateReviewPages(
  orderId: string,
  sellerId: string,
  productId: string,
) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/profile/${sellerId}`);
  revalidatePath("/seller/dashboard");
}
