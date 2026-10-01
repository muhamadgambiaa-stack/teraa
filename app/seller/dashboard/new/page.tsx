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

  if (!user) redirect("/login?redirect=/seller/dashboard/new");

  const [{ data: seller, error: sellerError }, { count: coverageCount, error: coverageError }] = await Promise.all([
    supabase
      .from("sellers")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("seller_delivery_areas")
      .select("seller_id", { count: "exact", head: true })
      .eq("seller_id", user.id),
  ]);

  if (sellerError || coverageError) {
    throw new Error("Could not load your seller details. Please try again.");
  }

  if (!seller) redirect("/seller/register");

  if (seller.verification_status !== "approved") {
    redirect("/seller/dashboard");
  }

  if (!coverageCount) {
    redirect("/seller/dashboard/settings");
  }

  return (
    <>
      <SiteHeader />
      <NewListingForm />
    </>
  );
}
