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
 *
 * Lets a buyer contact the seller directly from an order.
 *
 * The buyer does not need to return to the product page.
 * Existing conversations are reused.
 */
export async function messageSellerFromOrder(orderId: string) {
  const { supabase, user } = await requireActiveBuyer();

  /*
   * Load the order directly.
   */
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      buyer_id,
      seller_id
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  /*
   * Only the buyer who placed this order can use
   * this buyer-side action.
   */
  if (order.buyer_id !== user.id) {
    throw new Error("You are not allowed to message this seller.");
  }

  /*
   * Teraa currently creates an order from one listing.
   * Load the product attached to the order so the
   * marketplace conversation stays attached to that product.
   */
  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .select(
      `
      product_id
      `,
    )
    .eq("order_id", order.id)
    .limit(1)
    .maybeSingle();

  if (itemError || !orderItem) {
    throw new Error("Could not find the product for this order.");
  }

  /*
   * Reuse an existing conversation for the same
   * buyer + seller + product.
   */
  const { data: existingConversation, error: lookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_id", order.seller_id)
    .eq("product_id", orderItem.product_id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Couldn't open the conversation.");
  }

  if (existingConversation) {
    redirect(`/messages/${existingConversation.id}`);
  }

  /*
   * Check seller marketplace availability through
   * the secure database helper.
   */
  const { data: sellerAvailable, error: sellerAvailabilityError } =
    await supabase.rpc("marketplace_seller_is_available", {
      p_seller_id: order.seller_id,
    });

  if (sellerAvailabilityError) {
    console.error("Seller availability check failed:", sellerAvailabilityError);

    throw new Error("Couldn't check whether this seller is available.");
  }

  if (!sellerAvailable) {
    throw new Error("This seller account is currently unavailable.");
  }

  /*
   * Create a new conversation.
   *
   * Messaging RLS still independently validates the
   * buyer, seller and product.
   */
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      buyer_id: user.id,
      seller_id: order.seller_id,
      product_id: orderItem.product_id,
    })
    .select("id")
    .single();

  /*
   * In the unlikely event that two requests created
   * the same conversation at almost the same time,
   * recover by loading the existing one.
   */
  if (conversationError?.code === "23505") {
    const { data: duplicateConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("seller_id", order.seller_id)
      .eq("product_id", orderItem.product_id)
      .maybeSingle();

    if (duplicateConversation) {
      redirect(`/messages/${duplicateConversation.id}`);
    }
  }

  if (conversationError || !conversation) {
    console.error("Conversation creation failed:", conversationError);

    throw new Error(
      conversationError?.message || "Couldn't start conversation.",
    );
  }

  redirect(`/messages/${conversation.id}`);
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

  if (!["shipped", "delivered"].includes(order.status)) {
    throw new Error("This order cannot be marked received yet.");
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

/*
 * ============================================================
 * SUBMIT PRODUCT REVIEW
 * ============================================================
 *
 * Important:
 * seller_id is no longer trusted from a hidden browser field.
 * It is taken directly from the real order instead.
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

  /*
   * Load the real order.
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

  /*
   * Buyer must own the completed order.
   */
  if (order.buyer_id !== user.id || order.status !== "completed") {
    throw new Error("You cannot review this order.");
  }

  /*
   * Confirm this product was genuinely purchased
   * in this order.
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
   * Prevent duplicate reviews.
   */
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

  /*
   * Use seller_id from the real order.
   *
   * The browser is never trusted to tell us who
   * the seller was.
   */
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

  /*
   * Load the existing review.
   *
   * Do not trust order/product/seller IDs coming
   * from the browser when editing.
   */
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

  /*
   * The associated order must still genuinely
   * belong to this buyer and remain completed.
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
