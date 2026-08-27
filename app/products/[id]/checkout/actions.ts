"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const productId = String(formData.get("productId") ?? "").trim();

  if (!user) {
    redirect(`/login?redirect=/products/${productId}/checkout`);
  }

  /*
   * BASIC FORM VALIDATION
   */
  if (!productId) {
    throw new Error("Product is missing.");
  }

  const quantity = Number(formData.get("quantity") ?? 1);

  const paymentMethodValue = String(formData.get("paymentMethod") ?? "").trim();

  const deliveryCity = String(formData.get("deliveryCity") ?? "").trim();

  const deliveryNotes = String(formData.get("deliveryNotes") ?? "").trim();

  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect(`/products/${productId}/checkout?error=invalid_quantity`);
  }

  if (!paymentMethodValue) {
    redirect(`/products/${productId}/checkout?error=missing_payment`);
  }

  if (!deliveryCity) {
    redirect(`/products/${productId}/checkout?error=missing_city`);
  }

  const isCod = paymentMethodValue === "cod";

  /*
   * Digital payment values contain the seller
   * payment-method UUID.
   *
   * COD does not use one.
   */
  const sellerPaymentMethodId = isCod ? null : paymentMethodValue;

  /*
   * Sensitive marketplace logic happens in
   * PostgreSQL now.
   *
   * The RPC:
   *
   * - checks buyer account status
   * - checks seller status
   * - checks seller verification
   * - validates the product
   * - validates stock
   * - validates payment method
   * - creates the order
   * - creates the order item
   * - reduces stock
   *
   * All inside one database transaction.
   */
  const { data: orderId, error } = await supabase.rpc(
    "create_marketplace_order",
    {
      p_product_id: productId,

      p_quantity: quantity,

      p_payment_method: isCod ? "cod" : "digital",

      p_seller_payment_method_id: sellerPaymentMethodId,

      p_delivery_city: deliveryCity,

      p_delivery_notes: deliveryNotes || null,
    },
  );

  if (error || !orderId) {
    console.error("Order creation failed:", error);

    /*
     * Convert known database failures into
     * friendly checkout responses.
     */
    const message = error?.message?.toLowerCase() ?? "";

    if (
      message.includes("not enough stock") ||
      message.includes("product is not available")
    ) {
      redirect(`/products/${productId}/checkout?error=out_of_stock`);
    }

    if (message.includes("payment method")) {
      redirect(`/products/${productId}/checkout?error=missing_payment`);
    }

    if (message.includes("buyer account is not active")) {
      redirect("/account/status");
    }

    if (
      message.includes("seller is unavailable") ||
      message.includes("seller is not verified")
    ) {
      redirect(`/products/${productId}?error=seller_unavailable`);
    }

    redirect(`/products/${productId}/checkout?error=order_failed`);
  }

  /*
   * We intentionally do NOT create a
   * commissions record here yet.
   *
   * Teraa is currently operating without
   * marketplace commissions during the
   * early-growth phase.
   *
   * When monetization is activated later,
   * commission creation should be added
   * inside the protected database
   * transaction rather than allowing
   * buyers to write commissions directly.
   */

  redirect(`/orders/${orderId}`);
}
