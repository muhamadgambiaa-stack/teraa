"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/notifications");
  }

  return {
    supabase,
    user,
  };
}

export async function markNotificationRead(notificationId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Couldn't update notification.");
  }

  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message || "Couldn't update notifications.");
  }

  revalidatePath("/notifications");
}
