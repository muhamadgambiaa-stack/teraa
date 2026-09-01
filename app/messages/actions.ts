"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function removeConversation(conversationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/messages");
  }

  const { error } = await supabase.rpc("remove_conversation_from_inbox", {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("Could not remove conversation:", error);
    throw new Error(error.message || "Could not delete this conversation.");
  }

  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect("/messages");
}
