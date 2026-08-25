"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function cancelOrder(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buyer_id, status")
    .eq("id", orderId)
    .single();

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
}

export async function markOrderReceived(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== user.id) {
    throw new Error("Not authorized to update this order.");
  }

  /*
   * IMPORTANT:
   *
   * Previously the app allowed a buyer to mark an order
   * received while it was still "placed" or "confirmed".
   *
   * A buyer should only confirm receipt after the seller
   * has actually shipped / marked delivery.
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
    throw new Error("Couldn't complete this order.");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/seller/dashboard/orders");
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("orderId") ?? "");

  const sellerId = String(formData.get("sellerId") ?? "");

  const rating = Number(formData.get("rating"));

  const comment = String(formData.get("comment") ?? "").trim();

  if (!orderId || !sellerId || rating < 1 || rating > 5) {
    throw new Error("Invalid review.");
  }

  /*
   * Verify that:
   *
   * - this user owns the order
   * - the order is actually completed
   *
   * Don't rely only on the fact that the form was visible.
   */
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (
    !order ||
    order.buyer_id !== user.id ||
    order.seller_id !== sellerId ||
    order.status !== "completed"
  ) {
    throw new Error("You cannot review this order.");
  }

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    buyer_id: user.id,
    seller_id: sellerId,
    rating,
    comment: comment || null,
  });

  if (error) {
    throw new Error(error.message || "Couldn't submit review.");
  }

  revalidatePath(`/orders/${orderId}`);
}
