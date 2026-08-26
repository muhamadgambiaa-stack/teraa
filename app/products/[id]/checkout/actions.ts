"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { COMMISSION_RATE } from "@/lib/constants";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const productId = String(formData.get("productId") ?? "");

  if (!user) {
    redirect(`/login?redirect=/products/${productId}/checkout`);
  }

  /*
   * Check buyer account moderation status.
   *
   * Restricted / suspended / banned users
   * may browse and view their history,
   * but cannot create new marketplace orders.
   */
  const { data: buyerProfile, error: buyerProfileError } = await supabase
    .from("users")
    .select("id, account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (buyerProfileError || !buyerProfile) {
    throw new Error("Could not load your Teraa account.");
  }

  if (buyerProfile.account_status !== "active") {
    redirect("/account/status");
  }

  const quantity = Number(formData.get("quantity") ?? 1);
  const paymentMethodValue = String(formData.get("paymentMethod") ?? "");
  const deliveryCity = String(formData.get("deliveryCity") ?? "").trim();
  const deliveryNotes = String(formData.get("deliveryNotes") ?? "").trim();

  if (!productId) {
    throw new Error("Product is missing.");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect(`/products/${productId}/checkout?error=invalid_quantity`);
  }

  if (!paymentMethodValue) {
    redirect(`/products/${productId}/checkout?error=missing_payment`);
  }

  const isCod = paymentMethodValue === "cod";

  let sellerPaymentMethodId: string | null = null;

  /*
   * Always re-fetch product server-side.
   * Never trust submitted price or seller data.
   */
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      `
      id,
      price,
      stock_quantity,
      status,
      seller_id
      `,
    )
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    redirect(`/products/${productId}?error=not_found`);
  }

  /*
   * Do not allow a seller to buy their own product.
   */
  if (product.seller_id === user.id) {
    redirect(`/seller/dashboard/products/${product.id}`);
  }

  if (product.status !== "active" || product.stock_quantity < quantity) {
    redirect(`/products/${productId}?error=out_of_stock`);
  }

  /*
   * Seller marketplace status.
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
    .eq("id", product.seller_id)
    .maybeSingle();

  if (sellerError || !seller) {
    throw new Error("Seller account could not be found.");
  }

  if (
    seller.account_status !== "active" ||
    seller.verification_status !== "approved"
  ) {
    redirect(`/products/${productId}?error=seller_unavailable`);
  }

  /*
   * General user moderation status for seller.
   */
  const { data: sellerUser, error: sellerUserError } = await supabase
    .from("users")
    .select("id, account_status")
    .eq("id", product.seller_id)
    .maybeSingle();

  if (sellerUserError || !sellerUser) {
    throw new Error("Seller account could not be found.");
  }

  if (sellerUser.account_status !== "active") {
    redirect(`/products/${productId}?error=seller_unavailable`);
  }

  if (!deliveryCity) {
    redirect(`/products/${productId}/checkout?error=missing_city`);
  }

  /*
   * If digital payment was chosen,
   * verify the payment method really belongs
   * to this seller and is currently active.
   */
  if (!isCod) {
    const { data: method, error: methodError } = await supabase
      .from("seller_payment_methods")
      .select("id")
      .eq("id", paymentMethodValue)
      .eq("seller_id", product.seller_id)
      .eq("is_active", true)
      .maybeSingle();

    if (methodError || !method) {
      redirect(`/products/${productId}/checkout?error=missing_payment`);
    }

    sellerPaymentMethodId = method.id;
  }

  /*
   * Create order.
   */
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
    console.error("Order creation failed:", orderError);

    redirect(`/products/${productId}/checkout?error=order_failed`);
  }

  /*
   * Save purchase snapshot.
   */
  const { error: orderItemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    quantity,
    price_at_purchase: product.price,
  });

  if (orderItemError) {
    console.error("Order item creation failed:", orderItemError);

    throw new Error(
      "The order was created but the product could not be attached to it.",
    );
  }

  /*
   * Commission record.
   */
  const commissionAmount = Number(product.price) * quantity * COMMISSION_RATE;

  const { error: commissionError } = await supabase.from("commissions").insert({
    order_id: order.id,
    commission_rate: COMMISSION_RATE * 100,
    commission_amount: commissionAmount,
    seller_payout_status: "pending",
  });

  if (commissionError) {
    console.error("Commission creation failed:", commissionError);
  }

  /*
   * Reduce stock.
   *
   * Still not fully atomic at high concurrency.
   * For early Teraa volume this is workable,
   * but eventually this should move into one
   * Postgres transaction/RPC with row locking.
   */
  const remainingStock = product.stock_quantity - quantity;

  const { error: stockError } = await supabase
    .from("products")
    .update({
      stock_quantity: remainingStock,
      status: remainingStock <= 0 ? "out_of_stock" : "active",
    })
    .eq("id", product.id);

  if (stockError) {
    console.error("Stock update failed:", stockError);
  }

  redirect(`/orders/${order.id}`);
}
