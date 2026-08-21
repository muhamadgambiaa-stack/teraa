"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

async function requireSellerOwnsOrder(orderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.seller_id !== user!.id) {
    throw new Error("Not authorized to update this order.");
  }

  return { supabase, order };
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Can't move an order from ${order.status} to ${newStatus}.`);
  }

  await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);

  revalidatePath("/seller/dashboard/orders");
  revalidatePath(`/orders/${orderId}`);
}
