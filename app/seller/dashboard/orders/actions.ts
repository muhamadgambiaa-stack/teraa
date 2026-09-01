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
   * General Teraa account status.
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
   * Seller account status.
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
   * Verify that this order belongs to the seller.
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

/*
 * ============================================================
 * MESSAGE BUYER
 * ============================================================
 *
 * seller_open_order_conversation() must already exist in
 * Supabase from the secure order messaging migration.
 *
 * It verifies that this seller genuinely owns an order
 * involving this buyer before creating a conversation.
 */
export async function messageBuyerFromOrder(orderId: string) {
  const { supabase } = await requireSellerOwnsOrder(orderId);

  const { data: conversationId, error } = await supabase.rpc(
    "seller_open_order_conversation",
    {
      p_order_id: orderId,
    },
  );

  if (error) {
    console.error("Could not open buyer conversation:", error);

    throw new Error(
      error.message || "Couldn't open a conversation with this buyer.",
    );
  }

  if (!conversationId) {
    throw new Error("Couldn't open a conversation with this buyer.");
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

export async function respondToDeliveryIssue(
  orderId: string,
  formData: FormData,
) {
  const { supabase } = await requireSellerOwnsOrder(orderId);
  const response = String(formData.get("response") ?? "").trim();

  if (response.length < 20 || response.length > 2000) {
    throw new Error("Your response must be between 20 and 2,000 characters.");
  }

  const { error } = await supabase.rpc("seller_respond_to_delivery_issue", {
    p_order_id: orderId,
    p_response: response,
  });

  if (error) {
    console.error("Could not submit delivery dispute response:", error);
    throw new Error(error.message || "Couldn't submit your response.");
  }

  revalidatePath(`/seller/dashboard/orders/${orderId}`);
  revalidatePath("/seller/dashboard/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/notifications");
  revalidatePath("/admin/disputes");
}

/*
 * ============================================================
 * ALLOWED SELLER ORDER TRANSITIONS
 * ============================================================
 *
 * Seller:
 *
 * placed -> confirmed
 * confirmed -> shipped
 * shipped -> delivered
 *
 * Buyer completes the order after receiving it.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed"],

  confirmed: [],

  shipped: ["delivered"],

  delivered: [],

  completed: [],

  cancelled: [],
};

export async function markOrderShipped(orderId: string, formData: FormData) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  if (order.status !== "confirmed") {
    throw new Error("Only confirmed orders can be marked as shipped.");
  }

  const deliveryHandler = String(formData.get("deliveryHandler") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const trackingReference = String(
    formData.get("trackingReference") ?? "",
  ).trim();

  if (!contactName || !contactPhone) {
    throw new Error("Enter the delivery contact name and phone number.");
  }

  const { error } = await supabase.rpc("seller_mark_order_shipped", {
    p_order_id: orderId,
    p_delivery_handler: deliveryHandler,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_tracking_reference: trackingReference || null,
  });

  if (error) {
    console.error("Could not mark order as shipped:", error);
    throw new Error(error.message || "Couldn't mark this order as shipped.");
  }

  revalidatePath(`/seller/dashboard/orders/${orderId}`);
  revalidatePath("/seller/dashboard/orders");
  revalidatePath("/seller/dashboard");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/notifications");
}

/*
 * ============================================================
 * UPDATE ORDER STATUS
 * ============================================================
 */
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
    console.error("Seller order update failed:", error);

    throw new Error(error.message || "Couldn't update order.");
  }

  revalidatePath(`/seller/dashboard/orders/${orderId}`);

  revalidatePath("/seller/dashboard/orders");

  revalidatePath("/seller/dashboard");

  revalidatePath(`/orders/${orderId}`);

  revalidatePath("/orders");

  revalidatePath("/notifications");
}

/*
 * ============================================================
 * CANCEL ORDER
 * ============================================================
 */
export async function cancelSellerOrder(orderId: string) {
  const { supabase, order } = await requireSellerOwnsOrder(orderId);

  if (!["placed", "confirmed"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Seller cancellation failed:", error);

    throw new Error(error.message || "Couldn't cancel order.");
  }

  revalidatePath(`/seller/dashboard/orders/${orderId}`);

  revalidatePath("/seller/dashboard/orders");

  revalidatePath("/seller/dashboard");

  revalidatePath(`/orders/${orderId}`);

  revalidatePath("/orders");

  revalidatePath("/");

  revalidatePath("/search");

  revalidatePath("/notifications");
}
