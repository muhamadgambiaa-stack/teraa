"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const SUPPORT_CATEGORIES = [
  "order",
  "delivery",
  "seller_account",
  "account",
  "payment",
  "report",
  "other",
] as const;

async function requireActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/support");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select(
      `
      id,
      account_status
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    throw new Error("Could not load your Teraa account.");
  }

  if (profile.account_status !== "active") {
    redirect("/account/status");
  }

  return {
    supabase,
    user,
  };
}

export async function createSupportThread(formData: FormData) {
  const { supabase } = await requireActiveUser();

  const category = String(formData.get("category") ?? "").trim();

  const subject = String(formData.get("subject") ?? "").trim();

  const message = String(formData.get("message") ?? "").trim();

  const orderIdRaw = String(formData.get("orderId") ?? "").trim();

  const orderId = orderIdRaw.length > 0 ? orderIdRaw : null;

  if (
    !SUPPORT_CATEGORIES.includes(
      category as (typeof SUPPORT_CATEGORIES)[number],
    )
  ) {
    throw new Error("Choose a valid support category.");
  }

  if (subject.length < 3 || subject.length > 150) {
    throw new Error("Subject must be between 3 and 150 characters.");
  }

  if (!message || message.length > 4000) {
    throw new Error("Message must be between 1 and 4000 characters.");
  }

  const { data: threadId, error } = await supabase.rpc(
    "create_support_thread",
    {
      p_category: category,
      p_subject: subject,
      p_message: message,
      p_order_id: orderId,
    },
  );

  if (error) {
    console.error("Support thread creation failed:", error);

    throw new Error(error.message || "Couldn't create your support request.");
  }

  if (!threadId) {
    throw new Error("Couldn't create your support request.");
  }

  redirect(`/account/support/${threadId}`);
}

export async function sendSupportMessage(threadId: string, formData: FormData) {
  const { supabase } = await requireActiveUser();

  const message = String(formData.get("message") ?? "").trim();

  if (!message || message.length > 4000) {
    throw new Error("Message must be between 1 and 4000 characters.");
  }

  const { error } = await supabase.rpc("send_support_message", {
    p_thread_id: threadId,
    p_message: message,
  });

  if (error) {
    console.error("Support message failed:", error);

    throw new Error(error.message || "Couldn't send your message.");
  }

  revalidatePath(`/account/support/${threadId}`);

  revalidatePath("/account/support");

  revalidatePath("/admin/support");

  revalidatePath(`/admin/support/${threadId}`);
}
