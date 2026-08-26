"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireConversation(conversationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/messages/${conversationId}`);
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conversation) {
    throw new Error("Conversation not found.");
  }

  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
    throw new Error("You cannot access this conversation.");
  }

  return {
    supabase,
    conversation,
    user,
  };
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const { supabase, user } = await requireConversation(conversationId);

  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    return;
  }

  if (content.length > 2000) {
    throw new Error("Message is too long.");
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content,
  });

  if (error) {
    throw new Error(error.message || "Couldn't send message.");
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}

export async function markConversationRead(conversationId: string) {
  const { supabase, user } = await requireConversation(conversationId);

  const { error } = await supabase
    .from("messages")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("Could not mark messages read:", error);
  }

  revalidatePath("/messages");
}
