"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin, error } = await supabase.rpc("current_user_is_admin");

  if (error || !isAdmin) {
    redirect("/");
  }

  return {
    supabase,
    user,
  };
}

export async function claimSupportThread(threadId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("claim_support_thread", {
    p_thread_id: threadId,
  });

  if (error) {
    throw new Error(error.message || "Couldn't claim this support request.");
  }

  revalidateSupport(threadId);
}

export async function sendAdminSupportMessage(
  threadId: string,
  formData: FormData,
) {
  const { supabase } = await requireAdmin();

  const message = String(formData.get("message") ?? "").trim();

  if (!message || message.length > 4000) {
    throw new Error("Message must be between 1 and 4000 characters.");
  }

  const { error } = await supabase.rpc("send_support_message", {
    p_thread_id: threadId,
    p_message: message,
  });

  if (error) {
    throw new Error(error.message || "Couldn't send support message.");
  }

  revalidateSupport(threadId);
}

export async function resolveSupportThread(threadId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("resolve_support_thread", {
    p_thread_id: threadId,
  });

  if (error) {
    throw new Error(error.message || "Couldn't resolve this support request.");
  }

  revalidateSupport(threadId);
}

function revalidateSupport(threadId: string) {
  revalidatePath("/admin/support");

  revalidatePath(`/admin/support/${threadId}`);

  revalidatePath("/account/support");

  revalidatePath(`/account/support/${threadId}`);
}
