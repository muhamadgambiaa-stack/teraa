import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Call at the top of any admin page or server action. Redirects non-admins
 * away. Relies on the `users.role = 'admin'` check — RLS policies also
 * enforce this at the database level via `is_admin()`, this is just the
 * page-level gate so non-admins don't even see the UI.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return { supabase, user };
}
