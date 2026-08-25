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

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.seller_id !== user.id) {
    throw new Error("Not authorized to update this order.");
  }

  return {
    supabase,
    order,
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
    .eq("id", orderId);

  if (error) {
    throw new Error("Couldn't update order.");
  }

  revalidatePath("/seller/dashboard/orders");

  revalidatePath(`/orders/${orderId}`);
}

export async function cancelSellerOrder(orderId: string) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  if (!["placed", "confirmed"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  /*
   * The database function:
   *
   * - changes order to cancelled
   * - restores inventory
   * - reactivates products that were out of stock
   * - prevents double stock restoration
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
}
