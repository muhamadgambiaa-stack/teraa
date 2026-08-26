"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

async function requireSellerOwnsOrder(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * General marketplace account moderation.
   */
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

  /*
   * Seller-specific moderation and verification.
   */
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
    throw new Error("Seller account not found.");
  }

  if (seller.account_status !== "active") {
    throw new Error("Your seller account is not currently active.");
  }

  if (seller.verification_status !== "approved") {
    throw new Error("Your seller account is not verified.");
  }

  /*
   * Verify ownership of the order.
   */
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      seller_id,
      buyer_id,
      status
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  if (order.seller_id !== user.id) {
    throw new Error("Not authorized to update this order.");
  }

  return {
    supabase,
    order,
    seller,
    profile,
    user,
  };
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed"],

  confirmed: ["shipped"],

  shipped: ["delivered"],

  delivered: ["completed"],

  completed: [],

  cancelled: [],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Can't move an order from ${order.status} to ${newStatus}.`,
    );
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: newStatus,
    })
    .eq("id", orderId)
    .eq("seller_id", order.seller_id);

  if (error) {
    throw new Error(error.message || "Couldn't update order.");
  }

  revalidatePath("/seller/dashboard/orders");

  revalidatePath(`/orders/${orderId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/notifications");
}

export async function cancelSellerOrder(orderId: string) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  if (!["placed", "confirmed"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  /*
   * cancel_order() should:
   *
   * - change the order to cancelled
   * - restore inventory
   * - reactivate out-of-stock products
   * - prevent double inventory restoration
   */
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Seller cancellation failed:", error);

    throw new Error(error.message || "Couldn't cancel order.");
  }

  revalidatePath("/seller/dashboard/orders");

  revalidatePath(`/orders/${orderId}`);

  revalidatePath("/seller/dashboard");

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/notifications");
}
