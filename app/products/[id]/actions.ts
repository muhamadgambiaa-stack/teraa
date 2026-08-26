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
   * Check the buyer/user account first.
   *
   * Restricted, suspended and banned users
   * may still browse Teraa, but cannot start
   * new marketplace conversations.
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
   * Find the product and seller.
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
   * Do not allow people to start
   * a buyer conversation with themselves.
   */
  if (product.seller_id === user.id) {
    redirect(`/seller/dashboard/products/${productId}`);
  }

  /*
   * Do not start conversations from
   * listings removed by administration
   * or manually hidden by the seller.
   */
  if (product.status === "admin_hidden" || product.status === "hidden") {
    throw new Error("This listing is currently unavailable.");
  }

  /*
   * Make sure the seller account itself
   * can still participate in the marketplace.
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
    throw new Error("This seller is no longer available.");
  }

  if (seller.account_status !== "active") {
    throw new Error("This seller account is currently unavailable.");
  }

  /*
   * Also check the seller's general
   * user account status.
   *
   * Seller moderation and general user
   * moderation are separate systems.
   */
  const { data: sellerUser, error: sellerUserError } = await supabase
    .from("users")
    .select(
      `
      id,
      account_status
      `,
    )
    .eq("id", product.seller_id)
    .maybeSingle();

  if (sellerUserError || !sellerUser) {
    throw new Error("This seller account is unavailable.");
  }

  if (sellerUser.account_status !== "active") {
    throw new Error("This seller account is currently unavailable.");
  }

  /*
   * Reuse the existing conversation
   * for this buyer + seller + product.
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
   * Create a new conversation only when
   * one does not already exist.
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
    throw new Error(
      conversationError?.message || "Couldn't start conversation.",
    );
  }

  redirect(`/messages/${conversation.id}`);
}
