import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

import { createClient } from "@/lib/supabase/server";

export default async function SellEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/sell");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");

  const { data: seller } = await supabase.from("sellers")
    .select("id, verification_status, account_status")
    .eq("id", user.id).maybeSingle();

  if (seller) {
    const canUpload = seller.verification_status === "approved" && seller.account_status === "active";
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-6">
          <h1 className="font-display text-2xl mb-5">Selling</h1>
          <div className="grid gap-3">
            {canUpload && <Link href="/seller/dashboard/new" className="primary-button flex items-center justify-center gap-2 py-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
              Upload a product
            </Link>}
            <Link href="/seller/dashboard" className="secondary-button text-center py-4">{canUpload ? "Seller dashboard" : "View seller application and dashboard"}</Link>
          </div>
        </main>
      </>
    );
  }

  if (profile?.role === "seller") redirect("/seller/dashboard");
  redirect("/seller/register");
}
