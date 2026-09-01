"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isValidGambianLocalNumber,
  toGambianPhoneNumber,
} from "@/lib/gambian-phone";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const productId = String(formData.get("productId") ?? "").trim();

  if (!user) {
    redirect(`/login?redirect=/products/${productId}/checkout`);
  }

  if (!productId) {
    throw new Error("Product is missing.");
  }

  const quantity = Number(formData.get("quantity") ?? 1);

  const paymentMethodValue = String(formData.get("paymentMethod") ?? "").trim();

  const deliveryCoverage = String(formData.get("deliveryCoverage") ?? "").trim();

  let deliveryRegion = "";
  let deliveryTown = "";

  try {
    const parsed = JSON.parse(deliveryCoverage) as {
      region?: unknown;
      area?: unknown;
    };
    deliveryRegion = typeof parsed.region === "string" ? parsed.region.trim() : "";
    deliveryTown = typeof parsed.area === "string" ? parsed.area.trim() : "";
  } catch {
    // Invalid or manipulated form value is handled by the validation below.
  }

  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();

  const deliveryPhoneLocal = String(
    formData.get("deliveryPhone") ?? "",
  ).trim();

  const deliveryLandmark = String(formData.get("deliveryLandmark") ?? "").trim();

  const deliveryNotes = String(formData.get("deliveryNotes") ?? "").trim();

  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect(`/products/${productId}/checkout?error=invalid_quantity`);
  }

  /*
   * TERAA V1 IS COD ONLY.
   *
   * This check is server-side so a user
   * cannot manipulate the browser form and
   * submit a digital payment method.
   */
  if (paymentMethodValue !== "cod") {
    redirect(`/products/${productId}/checkout?error=missing_payment`);
  }

  if (!deliveryRegion || !deliveryTown) {
    redirect(`/products/${productId}/checkout?error=missing_area`);
  }

  if (!deliveryAddress) {
    redirect(`/products/${productId}/checkout?error=missing_address`);
  }

  if (!deliveryPhoneLocal) {
    redirect(`/products/${productId}/checkout?error=missing_phone`);
  }

  if (!isValidGambianLocalNumber(deliveryPhoneLocal)) {
    redirect(`/products/${productId}/checkout?error=invalid_phone`);
  }

  const deliveryPhone = toGambianPhoneNumber(deliveryPhoneLocal);

  /*
   * Secure marketplace RPC handles:
   *
   * - buyer account check
   * - seller status
   * - seller verification
   * - product availability
   * - stock validation
   * - order creation
   * - order item creation
   * - atomic stock reduction
   */
  const { data: orderId, error } = await supabase.rpc(
    "create_marketplace_order_v2",
    {
      p_product_id: productId,

      p_quantity: quantity,

      p_delivery_region: deliveryRegion,

      p_delivery_town: deliveryTown,

      p_delivery_address: deliveryAddress,

      p_delivery_phone: deliveryPhone,

      p_delivery_landmark: deliveryLandmark || null,

      p_delivery_notes: deliveryNotes || null,
    },
  );

  if (error || !orderId) {
    console.error("Order creation failed:", error);

    const message = error?.message?.toLowerCase() ?? "";

    if (
      message.includes("not enough stock") ||
      message.includes("product is not available")
    ) {
      redirect(`/products/${productId}/checkout?error=out_of_stock`);
    }

    if (message.includes("buyer account is not active")) {
      redirect("/account/status");
    }

    if (message.includes("seller does not deliver")) {
      redirect(`/products/${productId}/checkout?error=delivery_unavailable`);
    }

    if (
      message.includes("seller is unavailable") ||
      message.includes("seller is not verified")
    ) {
      redirect(`/products/${productId}?error=seller_unavailable`);
    }

    redirect(`/products/${productId}/checkout?error=order_failed`);
  }

  redirect(`/orders/${orderId}`);
}
