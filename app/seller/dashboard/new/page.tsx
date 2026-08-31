import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { NewListingForm } from "./NewListingForm";

// Server-side gate: only a signed-in, approved seller can reach the listing
// form at all. The database also enforces this at the RLS level (see
// products_insert_own_seller), this is the page-level check so an
// unverified seller doesn't even see the form, not just get blocked on
// submit.
export default async function NewListingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: seller } = await supabase
    .from("sellers")
    .select("verification_status, delivery_regions")
    .eq("id", user.id)
    .single();

  if (!seller || seller.verification_status !== "approved") {
    redirect("/seller/dashboard");
  }

  if (!seller.delivery_regions?.length) {
    redirect("/seller/dashboard/settings");
  }

  return (
    <>
      <SiteHeader />
      <NewListingForm />
    </>
  );
}
