import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AccountStatus = "active" | "restricted" | "suspended" | "banned";

export async function requireActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select(
      `
      id,
      role,
      full_name,
      account_status,
      restriction_reason
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
    profile,
  };
}
