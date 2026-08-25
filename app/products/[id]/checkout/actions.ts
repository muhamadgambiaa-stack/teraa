"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMMISSION_RATE } from "@/lib/constants";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const productId = formData.get("productId") as string;

  // Buyers must be signed in to complete an order. The checkout page
  // itself already redirects unauthenticated visitors before they see
  // the form, this is the second, non-bypassable layer: even a direct
  // POST to this action without a session gets sent to log in first.
  if (!user) {
    redirect(`/login?redirect=/products/${productId}/checkout`);
  }

  const quantity = Number(formData.get("quantity") ?? 1);
  const paymentMethodValue = formData.get("paymentMethod") as string;
  const deliveryCity = formData.get("deliveryCity") as string;
  const deliveryNotes = formData.get("deliveryNotes") as string;

  if (!paymentMethodValue) {
    redirect(`/products/${productId}/checkout?error=missing_payment`);
  }

  // The form submits either "cod" or a real seller_payment_methods.id.
  const isCod = paymentMethodValue === "cod";
  let sellerPaymentMethodId: string | null = null;

  // Re-fetch the product server-side, never trust a client-submitted price.
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

  if (!isCod) {
    // Confirm the chosen payment method actually belongs to this seller
    // and is active, never trust the submitted id blindly.
    const { data: method } = await supabase
      .from("seller_payment_methods")
      .select("id")
      .eq("id", paymentMethodValue)
      .eq("seller_id", product.seller_id)
      .eq("is_active", true)
      .single();

    if (!method) {
      redirect(`/products/${productId}/checkout?error=missing_payment`);
    }
    sellerPaymentMethodId = method!.id;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: product.seller_id,
      payment_method: isCod ? "cod" : "digital",
      seller_payment_method_id: sellerPaymentMethodId,
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
