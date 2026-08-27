"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function messageSeller(productId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/products/${productId}`);
  }

  /*
   * Buyer account must still be active.
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
   * Find the listing.
   */
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      `
      id,
      seller_id,
      status,
      stock_quantity
    `,
    )
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    throw new Error("This listing could not be found.");
  }

  /*
   * Seller cannot message themselves as a buyer.
   */
  if (product.seller_id === user.id) {
    redirect(`/seller/dashboard/products/${productId}`);
  }

  /*
   * Hidden/admin-hidden listings cannot start
   * new marketplace conversations.
   */
  if (product.status === "admin_hidden" || product.status === "hidden") {
    throw new Error("This listing is currently unavailable.");
  }

  /*
   * Check seller availability through the secure
   * database helper.
   *
   * This avoids exposing the seller's private users row
   * to the buyer.
   */
  const { data: sellerAvailable, error: sellerAvailabilityError } =
    await supabase.rpc("marketplace_seller_is_available", {
      p_seller_id: product.seller_id,
    });

  if (sellerAvailabilityError) {
    console.error("Seller availability check failed:", sellerAvailabilityError);

    throw new Error("Couldn't check whether this seller is available.");
  }

  if (!sellerAvailable) {
    throw new Error("This seller account is currently unavailable.");
  }

  /*
   * Reuse the existing conversation for this
   * buyer + seller + product.
   */
  const { data: existingConversation, error: lookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_id", product.seller_id)
    .eq("product_id", product.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Couldn't open conversation.");
  }

  if (existingConversation) {
    redirect(`/messages/${existingConversation.id}`);
  }

  /*
   * Create the conversation.
   *
   * RLS independently checks that:
   * - buyer_id is the authenticated user
   * - seller is available
   * - product belongs to that seller
   */
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      buyer_id: user.id,
      seller_id: product.seller_id,
      product_id: product.id,
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    console.error("Conversation creation failed:", conversationError);

    throw new Error(
      conversationError?.message || "Couldn't start conversation.",
    );
  }

  redirect(`/messages/${conversation.id}`);
}
