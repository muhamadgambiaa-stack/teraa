"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markOrderReceived(orderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== user!.id) {
    throw new Error("Not authorized to update this order.");
  }

  if (!["shipped", "delivered", "confirmed", "placed"].includes(order.status)) {
    throw new Error("This order can't be marked received.");
  }

  await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orderId = formData.get("orderId") as string;
  const sellerId = formData.get("sellerId") as string;
  const rating = Number(formData.get("rating"));
  const comment = formData.get("comment") as string;

  await supabase.from("reviews").insert({
    order_id: orderId,
    buyer_id: user!.id,
    seller_id: sellerId,
    rating,
    comment: comment || null,
  });

  // sellers.rating_avg updates automatically via a DB trigger — no app-side
  // write needed (and the buyer wouldn't have RLS permission to do it anyway).
  revalidatePath(`/orders/${orderId}`);
}
