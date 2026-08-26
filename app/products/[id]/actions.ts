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

  // Find the product and its seller.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      `
      id,
      seller_id,
      status
      `,
    )
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    throw new Error("This listing could not be found.");
  }

  // Prevent somebody messaging themselves
  // through their own listing.
  if (product.seller_id === user.id) {
    redirect(`/seller/dashboard/products/${productId}`);
  }

  // Make sure the seller still exists.
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
   * First look for an existing conversation
   * between this user + seller + product.
   *
   * This prevents creating a new chat every
   * time someone presses Message seller.
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
   * No conversation exists yet,
   * so create one.
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
