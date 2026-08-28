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
    .select("id, account_status")
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

/*
 * ============================================================
 * CLICKED APPROVED QUESTION
 * ============================================================
 */

export async function createSupportThreadFromAnswer(
  answerId: string,
  _formData: FormData,
) {
  const { supabase } = await requireActiveUser();

  const { data: threadId, error } = await supabase.rpc(
    "create_support_thread_from_answer",
    {
      p_answer_id: answerId,
    },
  );

  if (error) {
    console.error("Could not open support answer:", error);

    throw new Error(error.message || "Could not open this support question.");
  }

  if (!threadId) {
    throw new Error("Could not create the support conversation.");
  }

  revalidatePath("/account/support");
  revalidatePath("/admin/support");

  redirect(`/account/support/${threadId}`);
}

/*
 * ============================================================
 * CUSTOM QUESTION
 * ============================================================
 */

export async function createSupportThread(formData: FormData) {
  const { supabase } = await requireActiveUser();

  const rawCategory = String(formData.get("category") ?? "other").trim();

  const category = SUPPORT_CATEGORIES.includes(
    rawCategory as (typeof SUPPORT_CATEGORIES)[number],
  )
    ? rawCategory
    : "other";

  const message = String(formData.get("message") ?? "").trim();

  const enteredSubject = String(formData.get("subject") ?? "").trim();

  const orderIdRaw = String(formData.get("orderId") ?? "").trim();

  const orderId = orderIdRaw.length > 0 ? orderIdRaw : null;

  if (message.length < 3) {
    throw new Error(
      "Please enter a little more information about your question.",
    );
  }

  if (message.length > 4000) {
    throw new Error("Your message is too long.");
  }

  const subject =
    enteredSubject.length >= 3
      ? enteredSubject.slice(0, 150)
      : message.slice(0, 150);

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

    throw new Error(error.message || "Could not create your support request.");
  }

  if (!threadId) {
    throw new Error("Could not create your support request.");
  }

  revalidatePath("/account/support");
  revalidatePath("/admin/support");

  redirect(`/account/support/${threadId}`);
}

/*
 * ============================================================
 * SEND MESSAGE
 * ============================================================
 */

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

    throw new Error(error.message || "Could not send your message.");
  }

  revalidatePath(`/account/support/${threadId}`);

  revalidatePath("/account/support");
  revalidatePath("/admin/support");

  revalidatePath(`/admin/support/${threadId}`);
}
