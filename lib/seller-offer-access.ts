import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireOfferSeller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/seller/dashboard/offers");
  const [{ data: profile }, { data: seller }] = await Promise.all([
    supabase.from("users").select("account_status").eq("id", user.id).maybeSingle(),
    supabase.from("sellers").select("verification_status, account_status").eq("id", user.id).maybeSingle(),
  ]);
  if (profile?.account_status !== "active") redirect("/account/status");
  if (!seller) redirect("/seller/register");
  if (seller.verification_status !== "approved" || seller.account_status !== "active") redirect("/seller/dashboard");
  return { supabase, user };
}
