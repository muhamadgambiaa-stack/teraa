"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMMISSION_RATE } from "@/lib/constants";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const productId = formData.get("productId") as string;

  if (!user) {
    redirect(`/login?redirect=/products/${productId}/checkout`);
  }

  const quantity = Number(formData.get("quantity") ?? 1);
  const paymentMethod = formData.get("paymentMethod") as "wave" | "cod";
  const deliveryCity = formData.get("deliveryCity") as string;
  const deliveryNotes = formData.get("deliveryNotes") as string;

  // Re-fetch the product server-side — never trust a client-submitted price.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, price, stock_quantity, status, seller_id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    redirect(`/products/${productId}?error=not_found`);
  }

  if (product.status !== "active" || product.stock_quantity < quantity) {
    redirect(`/products/${productId}?error=out_of_stock`);
  }

  if (!deliveryCity) {
    redirect(`/products/${productId}/checkout?error=missing_city`);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: product.seller_id,
      payment_method: paymentMethod,
      payment_status: "pending",
      delivery_city: deliveryCity,
      delivery_notes: deliveryNotes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect(`/products/${productId}/checkout?error=order_failed`);
  }

  await supabase.from("order_items").insert({
    order_id: order!.id,
    product_id: product.id,
    quantity,
    price_at_purchase: product.price,
  });

  const commissionAmount = Number(product.price) * quantity * COMMISSION_RATE;
  await supabase.from("commissions").insert({
    order_id: order!.id,
    commission_rate: COMMISSION_RATE * 100,
    commission_amount: commissionAmount,
    seller_payout_status: "pending",
  });

  // Reduce stock, and flip status to out_of_stock once it hits zero so the
  // item stops appearing in the public feed and search results (which
  // filter on status = 'active'). Not a fully atomic decrement, acceptable
  // at v1 volume, revisit with a Postgres function + row lock once
  // concurrent orders on the same low-stock item become common.
  const remainingStock = product.stock_quantity - quantity;
  await supabase
    .from("products")
    .update({
      stock_quantity: remainingStock,
      status: remainingStock <= 0 ? "out_of_stock" : "active",
    })
    .eq("id", product.id);

  redirect(`/orders/${order!.id}`);
}
