"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/require-admin";

type UserAccountStatus = "active" | "restricted" | "suspended" | "banned";

async function updateUserStatus(
  userId: string,
  status: UserAccountStatus,
  reason: string | null,
) {
  const { supabase, user: admin } = await requireAdmin();

  if (admin.id === userId) {
    throw new Error("You cannot moderate your own admin account.");
  }

  const { data: target, error: targetError } = await supabase
    .from("users")
    .select("id, role, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !target) {
    throw new Error("User account not found.");
  }

  if (target.role === "admin") {
    throw new Error("Admin accounts cannot be moderated from this page.");
  }

  const { error } = await supabase
    .from("users")
    .update({
      account_status: status,
      restriction_reason: reason,
      restricted_at: status === "active" ? null : new Date().toISOString(),
      restricted_by: status === "active" ? null : admin.id,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message || "Couldn't update user account.");
  }

  revalidatePath("/admin/users");

  revalidatePath(`/admin/users/${userId}`);

  revalidatePath(`/profile/${userId}`);

  revalidatePath("/admin");
}

export async function restrictUser(userId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a restriction reason.");
  }

  await updateUserStatus(userId, "restricted", reason);
}

export async function suspendUser(userId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a suspension reason.");
  }

  await updateUserStatus(userId, "suspended", reason);
}

export async function banUser(userId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Please provide a ban reason.");
  }

  await updateUserStatus(userId, "banned", reason);
}

export async function restoreUser(userId: string) {
  await updateUserStatus(userId, "active", null);
}
